import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { VencimientosMensualesService, VencimientoMensual, ResumenAnual } from '../../../core/vencimientos-mensuales.service';

@Component({
  selector: 'app-vencimientos-mensuales',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DropdownModule,
    TableModule,
    ToastModule,
    ProgressSpinnerModule
  ],
  providers: [
    MessageService,
    VencimientosMensualesService
  ],
  templateUrl: './vencimientos-mensuales.component.html',
  styleUrls: ['./vencimientos-mensuales.component.css']
})
export class VencimientosMensualesComponent implements OnInit {

  reporteForm!: FormGroup;
  vencimientosMensuales: VencimientoMensual[] = [];
  resumenAnual: ResumenAnual[] = [];
  loading = false;

  // Opciones para los dropdowns
  anios: number[] = [];
  meses: any[] = [
    { label: 'Todos', value: null },
    { label: 'Enero', value: 1 },
    { label: 'Febrero', value: 2 },
    { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 },
    { label: 'Mayo', value: 5 },
    { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 },
    { label: 'Agosto', value: 8 },
    { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 },
    { label: 'Noviembre', value: 11 },
    { label: 'Diciembre', value: 12 }
  ];

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private vencimientosService: VencimientosMensualesService
  ) {}

  ngOnInit(): void {
    this.inicializarFormulario();
    this.cargarAnios();
    this.generarDatosEjemplo();
  }

  inicializarFormulario(): void {
    this.reporteForm = this.fb.group({
      anio: [new Date().getFullYear(), Validators.required],
      mes: [null]
    });
  }

  cargarAnios(): void {
    const anioActual = new Date().getFullYear();
    this.anios = [];
    for (let i = anioActual - 5; i <= anioActual + 5; i++) {
      this.anios.push(i);
    }
  }

  generarReporte(): void {
    if (this.reporteForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Por favor seleccione un año'
      });
      return;
    }

    this.loading = true;

    const anio = this.reporteForm.get('anio')?.value;
    const mes = this.reporteForm.get('mes')?.value;

    // Llamar al servicio real
    this.vencimientosService.getVencimientosMensuales(anio, mes).subscribe({
      next: (response) => {
        this.vencimientosMensuales = response.vencimientos;
        this.resumenAnual = response.resumen_anual;
        this.loading = false;

        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Reporte generado correctamente'
        });
      },
      error: (error) => {
        console.error('Error al generar reporte:', error);
        // Si falla el servicio, usar datos de ejemplo
        this.generarDatosEjemplo();
        this.loading = false;

        this.messageService.add({
          severity: 'info',
          summary: 'Información',
          detail: 'Usando datos de ejemplo - Servicio no disponible'
        });
      }
    });
  }

  generarDatosEjemplo(): void {
    const anioSeleccionado = this.reporteForm.get('anio')?.value || new Date().getFullYear();
    const mesSeleccionado = this.reporteForm.get('mes')?.value;
    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth() + 1;
    const anioActual = fechaActual.getFullYear();

    // Generar datos de ejemplo para todos los meses
    const datos: VencimientoMensual[] = [];
    const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    for (let mes = 1; mes <= 12; mes++) {
      if (mesSeleccionado && mesSeleccionado !== mes) continue;

      const interes = Math.round((Math.random() * 5000 + 1000) * 100) / 100;
      const capital = Math.round((Math.random() * 10000 + 5000) * 100) / 100;
      const premio = Math.round((Math.random() * 2000 + 500) * 100) / 100;
      const total = interes + capital + premio;

      datos.push({
        anio: anioSeleccionado,
        mes: mes,
        nombre_mes: nombresMeses[mes - 1],
        interes: interes,
        capital: capital,
        premio: premio,
        total: total,
        es_mes_actual: anioSeleccionado === anioActual && mes === mesActual
      });
    }

    this.vencimientosMensuales = datos;
    this.calcularResumenAnual();
  }

  calcularResumenAnual(): void {
    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth() + 1;
    const anioActual = fechaActual.getFullYear();
    const anioSeleccionado = this.reporteForm.get('anio')?.value || anioActual;

    // Calcular totales
    const totalAnual = this.vencimientosMensuales.reduce(
      (acc, item) => ({
        interes: acc.interes + item.interes,
        capital: acc.capital + item.capital,
        premio: acc.premio + item.premio,
        total: acc.total + item.total
      }),
      { interes: 0, capital: 0, premio: 0, total: 0 }
    );

    // Calcular ejecutado (hasta el mes actual)
    const mesesEjecutados = this.vencimientosMensuales.filter(
      item => item.anio < anioActual ||
              (item.anio === anioActual && item.mes <= mesActual)
    );

    const ejecutadoAnual = mesesEjecutados.reduce(
      (acc, item) => ({
        interes: acc.interes + item.interes,
        capital: acc.capital + item.capital,
        premio: acc.premio + item.premio,
        total: acc.total + item.total
      }),
      { interes: 0, capital: 0, premio: 0, total: 0 }
    );

    // Calcular pendiente
    const pendienteAnual = {
      interes: totalAnual.interes - ejecutadoAnual.interes,
      capital: totalAnual.capital - ejecutadoAnual.capital,
      premio: totalAnual.premio - ejecutadoAnual.premio,
      total: totalAnual.total - ejecutadoAnual.total
    };

    this.resumenAnual = [
      { tipo: 'TOTAL', ...totalAnual },
      { tipo: 'EJECUTADO', ...ejecutadoAnual },
      { tipo: 'PENDIENTE', ...pendienteAnual }
    ];
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  exportarExcel(): void {
    const anio = this.reporteForm.get('anio')?.value;
    const mes = this.reporteForm.get('mes')?.value;

    this.vencimientosService.exportarExcel(anio, mes).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vencimientos-mensuales-${anio}-${mes || 'todos'}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.messageService.add({
          severity: 'success',
          summary: 'Exportación',
          detail: 'Archivo Excel descargado correctamente'
        });
      },
      error: (error) => {
        console.error('Error al exportar Excel:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo exportar el archivo Excel'
        });
      }
    });
  }

  exportarPDF(): void {
    const anio = this.reporteForm.get('anio')?.value;
    const mes = this.reporteForm.get('mes')?.value;

    this.vencimientosService.exportarPDF(anio, mes).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vencimientos-mensuales-${anio}-${mes || 'todos'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.messageService.add({
          severity: 'success',
          summary: 'Exportación',
          detail: 'Archivo PDF descargado correctamente'
        });
      },
      error: (error) => {
        console.error('Error al exportar PDF:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo exportar el archivo PDF'
        });
      }
    });
  }
}
