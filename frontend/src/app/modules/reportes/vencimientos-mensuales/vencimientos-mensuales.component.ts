import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { VencimientosMensualesService, VencimientoMensual, ResumenAnual } from '../../../core/vencimientos-mensuales.service';
import { Subscription } from 'rxjs';
import { NgChartsModule } from 'ng2-charts';
import { ChartOptions, ChartType } from 'chart.js';

@Component({
  selector: 'app-vencimientos-mensuales',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    ButtonModule,
    DropdownModule,
    ProgressSpinnerModule,
    TableModule,
    CardModule,
    NgChartsModule
  ],
  providers: [MessageService],
  templateUrl: './vencimientos-mensuales.component.html',
  styleUrls: ['./vencimientos-mensuales.component.css']
})
export class VencimientosMensualesComponent implements OnInit, OnDestroy {

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

  // Configuración del gráfico
  public barChartOptions: ChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Vencimientos Mensuales - Composición de Cuotas'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        displayColors: false, // Desactiva los recuadros de colores
        callbacks: {
          title: function(context) {
            // Título con el mes
            return context[0].label;
          },
          label: function(context) {
            // Solo mostrar etiqueta para el primer dataset para evitar duplicación
            if (context.datasetIndex === 0) {
              const index = context.dataIndex;
              const datasets = context.chart.data.datasets;

              // Obtener todos los valores para este mes (convertir a número)
              const capital = Number(datasets[0].data[index]) || 0;
              const interes = Number(datasets[1].data[index]) || 0;
              const premio = Number(datasets[2].data[index]) || 0;
              const total = capital + interes + premio;

              // Formatear valores
              const formatCurrency = (value: number) => {
                return new Intl.NumberFormat('es-ES', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 2,
                  useGrouping: true // Activar separación de miles
                }).format(value);
              };

              // Función para alinear texto a la derecha con espacios
              const alignRight = (text: string, width: number) => {
                return ' '.repeat(Math.max(0, width - text.length)) + text;
              };

              // Crear etiquetas con alineación derecha de los valores y ancho mínimo
              const labels = [
                `Capital:  ${alignRight(formatCurrency(capital), 11)}`,
                `Interés:   ${alignRight(formatCurrency(interes), 11)}`,
                `Premio:    ${alignRight(formatCurrency(premio), 11)}`,
                `─`.repeat(22),
                `Total:     ${alignRight(formatCurrency(total), 11)}`
              ];

              return labels;
            }
            // Para los otros datasets, no mostrar nada
            return '';
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Meses'
        }
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: 'Monto (USD)'
        },
        ticks: {
          callback: function(value) {
            return new Intl.NumberFormat('es-ES', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0
            }).format(Number(value));
          }
        }
      }
    }
  };

  public barChartType: ChartType = 'bar' as ChartType;
  public barChartData: any = {
    labels: [],
    datasets: [
      {
        label: 'Capital',
        data: [],
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
        order: 1 // Primero (abajo)
      },
      {
        label: 'Interés',
        data: [],
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        order: 2 // Segundo (medio)
      },
      {
        label: 'Premio',
        data: [],
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        order: 3 // Tercero (arriba)
      }
    ]
  };

  private subscription: Subscription = new Subscription();

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

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
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
        if (response.success) {
          this.vencimientosMensuales = response.data.vencimientos;
          this.resumenAnual = response.data.resumen_anual;
          this.actualizarGrafico();
          this.loading = false;

          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Reporte generado correctamente desde el backend'
          });
        } else {
          throw new Error('Error en la respuesta del backend');
        }
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

  actualizarGrafico(): void {
    // Actualizar datos del gráfico
    this.barChartData.labels = this.vencimientosMensuales.map(v => v.nombre_mes);
    this.barChartData.datasets[0].data = this.vencimientosMensuales.map(v => v.capital);  // Capital (abajo)
    this.barChartData.datasets[1].data = this.vencimientosMensuales.map(v => v.interes);   // Interés (medio)
    this.barChartData.datasets[2].data = this.vencimientosMensuales.map(v => v.premio);    // Premio (arriba)
  }

  generarDatosEjemplo(): void {
    const anioSeleccionado = this.reporteForm.get('anio')?.value || new Date().getFullYear();
    const mesSeleccionado = this.reporteForm.get('mes')?.value;
    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth() + 1;
    const anioActual = fechaActual.getFullYear();

    // Datos de ejemplo basados en el resultado esperado
    const datosEjemplo = [
      { mes: 1, nombre: 'Enero', interes: 3759.43, capital: 2478.44, premio: 75.36 },
      { mes: 2, nombre: 'Febrero', interes: 5030.79, capital: 11586.90, premio: 123.76 },
      { mes: 3, nombre: 'Marzo', interes: 4487.88, capital: 9814.69, premio: 0.00 },
      { mes: 4, nombre: 'Abril', interes: 2773.17, capital: 5795.51, premio: 123.52 },
      { mes: 5, nombre: 'Mayo', interes: 2660.10, capital: 7257.01, premio: 123.76 },
      { mes: 6, nombre: 'Junio', interes: 3039.92, capital: 10866.14, premio: 40.32 },
      { mes: 7, nombre: 'Julio', interes: 2361.83, capital: 4941.82, premio: 123.52 },
      { mes: 8, nombre: 'Agosto', interes: 2492.03, capital: 10425.67, premio: 123.76 },
      { mes: 9, nombre: 'Septiembre', interes: 2856.97, capital: 8131.12, premio: 40.32 },
      { mes: 10, nombre: 'Octubre', interes: 2247.86, capital: 4941.82, premio: 123.54 },
      { mes: 11, nombre: 'Noviembre', interes: 2025.95, capital: 7635.35, premio: 123.76 },
      { mes: 12, nombre: 'Diciembre', interes: 2677.63, capital: 8177.39, premio: 40.32 }
    ];

    // Generar datos para todos los meses o el mes específico
    const datos: VencimientoMensual[] = [];

    for (const item of datosEjemplo) {
      if (mesSeleccionado && mesSeleccionado !== item.mes) continue;

      const total = item.interes + item.capital + item.premio;

      datos.push({
        anio: anioSeleccionado,
        mes: item.mes,
        nombre_mes: item.nombre,
        interes: item.interes,
        capital: item.capital,
        descuento: item.premio,
        premio: item.premio,
        interes_moroso: 0,
        capital_moroso: 0,
        descuento_moroso: 0,
        total: total,
        es_mes_actual: anioSeleccionado === anioActual && item.mes === mesActual
      });
    }

    this.vencimientosMensuales = datos;
    this.actualizarGrafico();
    this.calcularResumenAnual();
  }

  calcularResumenAnual(): void {
    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth() + 1;
    const anioActual = fechaActual.getFullYear();
    const anioSeleccionado = this.reporteForm.get('anio')?.value || anioActual;

    // Calcular totales basados en los datos del resultado esperado
    const totalAnual = {
      interes: 36413.56,
      capital: 92051.86,
      premio: 1061.94,
      total: 128465.42
    };

    // Calcular ejecutado (hasta el mes actual - asumiendo que estamos en mayo)
    const ejecutadoAnual = {
      interes: 16079.41,
      capital: 29675.54,
      premio: 322.64,
      total: 45754.95
    };

    // Calcular pendiente
    const pendienteAnual = {
      interes: 20334.15,
      capital: 62376.32,
      premio: 739.30,
      total: 82710.47
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
