import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CalendarModule } from 'primeng/calendar';
import { ToastModule } from 'primeng/toast';
import { ChartModule } from 'primeng/chart';
import { PatrimonioService, PatrimonioItem } from '../../../core/patrimonio.service';
import { GrupoFamiliarService } from '../../../core/grupo-familiar.service';
import { PersonaService } from '../../../core/persona.service';
import { AuthService } from '../../../core/auth.service';
import { ChartData } from 'chart.js';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UserOptions } from 'jspdf-autotable';

@Component({
  selector: 'app-patrimonio-consolidado',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    ButtonModule,
    DropdownModule,
    ProgressSpinnerModule,
    CalendarModule,
    ChartModule
  ],
  providers: [MessageService],
  templateUrl: './patrimonio-consolidado.component.html',
  styleUrls: ['./patrimonio-consolidado.component.css']
})
export class PatrimonioConsolidadoComponent implements OnInit {

  reporteForm!: FormGroup;
  patrimonio: PatrimonioItem[] = [];
  total: number = 0;
  loading = false;

  // Gráfico
  chartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: []
  };
  chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    layout: {
      padding: 20
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        titleFont: {
          size: 13,
          weight: '600'
        },
        bodyFont: {
          size: 12
        },
        padding: 12,
        cornerRadius: 6,
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const formattedValue = this.formatCurrency(Number(value));
            const total = context.chart.data.datasets[0].data.reduce((sum: number, val: number) => sum + Number(val), 0);
            const percentage = ((Number(value) / total) * 100).toFixed(2);
            return [
              label,
              formattedValue,
              `${percentage}%`
            ];
          }
        }
      }
    }
  };

  // Dropdowns
  gruposFamiliares: any[] = [];
  personas: any[] = [];

  // Usuario actual
  currentUser: any = null;

  // Leyenda de colores
  leyendaColores: { color: string; label: string; valor: number; porcentaje: string }[] = [];

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private patrimonioService: PatrimonioService,
    private grupoFamiliarService: GrupoFamiliarService,
    private personaService: PersonaService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.inicializarFormulario();
    this.loadCurrentUser();
    this.loadInitialData();
  }

  loadCurrentUser(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  inicializarFormulario(): void {
    // Fecha inicio: hoy
    const fechaInicio = new Date();
    // Fecha fin: último día del undécimo mes después de la fecha actual
    const fechaFin = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth() + 12, 0);

    this.reporteForm = this.fb.group({
      fecha_inicio: [fechaInicio, Validators.required],
      fecha_fin: [fechaFin, Validators.required],
      id_grupo_familiar: [null],
      id_propietario: [null]
    });

    // Establecer valores por defecto basados en el usuario actual
    setTimeout(() => {
      const defaultValues: any = {};

      if (this.currentUser?.persona) {
        defaultValues.id_propietario = this.currentUser.persona.id_persona;
      }

      if (this.currentUser?.persona) {
        const grupoFamiliarPatriarca = this.gruposFamiliares.find(
          gf => gf.id_patriarca === this.currentUser.persona.id_persona
        );
        if (grupoFamiliarPatriarca) {
          defaultValues.id_grupo_familiar = grupoFamiliarPatriarca.id_grupo_familiar;
        }
      }

      this.reporteForm.patchValue(defaultValues);

      // Generar reporte automáticamente con los valores por defecto
      setTimeout(() => {
        this.generarReporte();
      }, 600);
    }, 500);
  }

  loadInitialData(): void {
    // Cargar grupos familiares
    this.grupoFamiliarService.getGruposFamiliares().subscribe({
      next: (response) => {
        if (response.success) {
          this.gruposFamiliares = response.data || [];
        }
      },
      error: (error) => {
        console.error('Error cargando grupos familiares:', error);
      }
    });

    // Cargar personas
    this.personaService.getAll().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.personas = response.data.map((p: any) => ({
            id: p.id_persona,
            nombre_completo: `${p.nombres} ${p.apellidos}`
          })) || [];
        }
      },
      error: (error) => {
        console.error('Error cargando personas:', error);
      }
    });
  }

  generarReporte(): void {
    if (this.reporteForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Por favor complete los campos requeridos'
      });
      return;
    }

    this.loading = true;

    const params = {
      fecha_inicio: this.formatDate(this.reporteForm.get('fecha_inicio')?.value),
      fecha_fin: this.formatDate(this.reporteForm.get('fecha_fin')?.value),
      id_grupo_familiar: this.reporteForm.get('id_grupo_familiar')?.value,
      id_propietario: this.reporteForm.get('id_propietario')?.value
    };

    this.patrimonioService.getPatrimonioConsolidado(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.patrimonio = response.data.patrimonio;
          this.total = response.data.total;
          this.loading = false;

          // Actualizar gráfico
          this.actualizarGrafico();

          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Reporte generado correctamente'
          });
        } else {
          throw new Error('Error en la respuesta del backend');
        }
      },
      error: (error) => {
        console.error('Error al generar reporte:', error);
        this.loading = false;

        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo generar el reporte. Por favor, verifique la conexión.'
        });
      }
    });
  }

  exportarExcel(): void {
    const params = {
      fecha_inicio: this.formatDate(this.reporteForm.get('fecha_inicio')?.value),
      fecha_fin: this.formatDate(this.reporteForm.get('fecha_fin')?.value),
      id_grupo_familiar: this.reporteForm.get('id_grupo_familiar')?.value,
      id_propietario: this.reporteForm.get('id_propietario')?.value
    };

    this.patrimonioService.exportarExcel(params).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.generarExcelFrontend(response.data, params.fecha_inicio, params.fecha_fin);
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Formato de datos inválido para generar Excel'
          });
        }
      },
      error: (error) => {
        console.error('Error al exportar Excel:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo exportar el archivo Excel. Verifique la conexión con el servidor.'
        });
      }
    });
  }

  exportarPDF(): void {
    const params = {
      fecha_inicio: this.formatDate(this.reporteForm.get('fecha_inicio')?.value),
      fecha_fin: this.formatDate(this.reporteForm.get('fecha_fin')?.value),
      id_grupo_familiar: this.reporteForm.get('id_grupo_familiar')?.value,
      id_propietario: this.reporteForm.get('id_propietario')?.value
    };

    this.patrimonioService.exportarPDF(params).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.generarPDFFrontend(response.data, params.fecha_inicio, params.fecha_fin);
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Formato de datos inválido para generar PDF'
          });
        }
      },
      error: (error) => {
        console.error('Error al exportar PDF:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo exportar el archivo PDF. Verifique la conexión con el servidor.'
        });
      }
    });
  }

  // Método helper para descargar archivos
  private descargarArchivo(blob: Blob, extension: string, fechaInicio: string, fechaFin: string, tipo: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patrimonio-consolidado-${fechaInicio}-${fechaFin}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    this.messageService.add({
      severity: 'success',
      summary: 'Exportación',
      detail: `Archivo ${tipo} descargado correctamente`
    });
  }

  // Método para generar PDF en frontend
  private generarPDFFrontend(data: any, fechaInicio: string, fechaFin: string): void {
    try {
      // Crear documento PDF
      const doc = new jsPDF();

      // Configurar fuente
      doc.setFontSize(20);

      // Agregar título
      doc.text('Reporte de Patrimonio Consolidado', 105, 20, { align: 'center' });

      // Agregar período
      doc.setFontSize(12);
      doc.text(`Período: ${fechaInicio} - ${fechaFin}`, 105, 30, { align: 'center' });

      // Crear tabla manualmente sin autoTable
      let yPosition = 50;

      // Encabezados de la tabla
      doc.setFillColor(59, 130, 246);
      doc.setTextColor(255);
      doc.setFontSize(10);

      // Dibujar celdas de encabezado
      doc.rect(20, yPosition, 80, 10, 'F');
      doc.rect(100, yPosition, 80, 10, 'F');
      doc.text('Detalle', 60, yPosition + 7, { align: 'center' });
      doc.text('Valor', 140, yPosition + 7, { align: 'center' });

      yPosition += 10;

      // Datos de la tabla (excluir el TOTAL del array)
      const datosSinTotal = data.patrimonio.filter((item: PatrimonioItem) => item.detalle !== 'TOTAL');

      doc.setTextColor(0);
      doc.setFontSize(10);

      datosSinTotal.forEach((item: PatrimonioItem) => {
        // Filas normales - fondo blanco
        doc.setFillColor(255, 255, 255);
        doc.setTextColor(0);

        // Dibujar celdas
        doc.rect(20, yPosition, 80, 10, 'F');
        doc.rect(100, yPosition, 80, 10, 'F');

        // Agregar texto - detalle centrado, valor alineado a la derecha
        doc.text(item.detalle, 60, yPosition + 7, { align: 'center' });
        doc.text(this.formatCurrency(item.valor), 175, yPosition + 7, { align: 'right' });

        yPosition += 10;
      });

      // Fila de total separada
      yPosition += 5;
      doc.setFillColor(34, 197, 94);
      doc.setTextColor(255);
      doc.setFontSize(10);

      doc.rect(20, yPosition, 80, 10, 'F');
      doc.rect(100, yPosition, 80, 10, 'F');
      doc.text('TOTAL', 60, yPosition + 7, { align: 'center' });
      doc.text(this.formatCurrency(data.total), 175, yPosition + 7, { align: 'right' });

      // Agregar pie de página
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(`Generado el ${new Date().toLocaleDateString('es-CO')}`, 105, 280, { align: 'center' });

      // Guardar PDF
      const fileName = `patrimonio-consolidado-${fechaInicio}-${fechaFin}.pdf`;
      doc.save(fileName);

      this.messageService.add({
        severity: 'success',
        summary: 'Exportación',
        detail: 'Archivo PDF generado y descargado correctamente'
      });

    } catch (error) {
      console.error('Error al generar PDF en frontend:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el archivo PDF. Intente nuevamente.'
      });
    }
  }

  formatDate(date: Date): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Método para generar Excel en frontend
  private generarExcelFrontend(data: any, fechaInicio: string, fechaFin: string): void {
    try {
      // Crear workbook
      const wb = XLSX.utils.book_new();

      // Preparar datos para el Excel
      const wsData = [
        ['Reporte de Patrimonio Consolidado'],
        [`Período: ${fechaInicio} - ${fechaFin}`],
        [],
        ['Detalle', 'Valor'],
        ...data.patrimonio.map((item: PatrimonioItem) => [item.detalle, item.valor]),
        [],
        ['Total', data.total]
      ];

      // Crear worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Configurar anchos de columnas
      ws['!cols'] = [
        { wch: 30 }, // Columna Detalle
        { wch: 15 }  // Columna Valor
      ];

      // Agregar worksheet al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Patrimonio Consolidado');

      // Generar y descargar archivo
      const fileName = `patrimonio-consolidado-${fechaInicio}-${fechaFin}.xlsx`;
      XLSX.writeFile(wb, fileName);

      this.messageService.add({
        severity: 'success',
        summary: 'Exportación',
        detail: 'Archivo Excel generado y descargado correctamente'
      });

    } catch (error) {
      console.error('Error al generar Excel en frontend:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el archivo Excel. Intente nuevamente.'
      });
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  isTotal(item: PatrimonioItem): boolean {
    return item.detalle === 'TOTAL';
  }

  actualizarGrafico(): void {
    // Filtrar el TOTAL para no incluirlo en el gráfico
    const datosSinTotal = this.patrimonio.filter(item => item.detalle !== 'TOTAL');

    // Calcular el total
    const total = datosSinTotal.reduce((sum, item) => sum + item.valor, 0);

    // Ordenar de mayor a menor por valor
    const datosOrdenados = [...datosSinTotal].sort((a: any, b: any) => b.valor - a.valor);

    // Paleta de colores financieros extendida para más categorías
    const coloresFinancieros = [
      '#2E8B57', // Sea Green - Total Corriente
      '#1E90FF', // Dodger Blue - Capital bonos
      '#8A2BE2', // Blue Violet - Papeles Comerciales
      '#FF8C00', // Dark Orange - Obligaciones
      '#4169E1', // Royal Blue - Acciones
      '#9370DB', // Medium Purple - Titularizaciones
      '#FF6384', // Red
      '#3CB371', // Medium Sea Green
      '#FFA500', // Orange
      '#FFCE56', // Yellow
      '#4BC0C0', // Teal
      '#9966FF', // Purple
      '#FF9F40', // Light Orange
      '#C9CBCF', // Gray
      '#7CB342', // Green
      '#20B2AA'  // Light Sea Green
    ];

    // Configuración del gráfico de donut
    this.chartData = {
      labels: datosOrdenados.map((item: any) => item.detalle),
      datasets: [{
        data: datosOrdenados.map((item: any) => item.valor),
        backgroundColor: coloresFinancieros.slice(0, datosOrdenados.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };

    // Configuración de opciones del gráfico
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false // Ocultamos la leyenda del gráfico porque tenemos una personalizada
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const label = context.label || '';
              const value = context.raw || 0;
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value)} (${percentage}%)`;
            }
          }
        }
      },
      cutout: '70%'
    };

    // Calcular leyenda de colores
    this.leyendaColores = datosOrdenados.map((item: any, index: number) => ({
      color: coloresFinancieros[index % coloresFinancieros.length],
      label: item.detalle,
      valor: item.valor,
      porcentaje: ((item.valor / total) * 100).toFixed(1)
    }));
  }
}
