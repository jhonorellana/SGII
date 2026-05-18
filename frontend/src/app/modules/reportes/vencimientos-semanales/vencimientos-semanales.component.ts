import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { VencimientosSemanalesService, VencimientoSemanal, ResumenSemanal } from '../../../core/vencimientos-semanales.service';
import { ModalActionsComponent } from '../../../core/modal-actions';
import { Subscription } from 'rxjs';
import { NgChartsModule } from 'ng2-charts';
import { ChartOptions, ChartType } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';
import { LayoutService } from '../../../core/layout.service';

@Component({
  selector: 'app-vencimientos-semanales',
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
    CalendarModule,
    DialogModule,
    NgChartsModule,
    ModalActionsComponent
  ],
  providers: [MessageService, ModalActionsComponent],
  templateUrl: './vencimientos-semanales.component.html',
  styleUrls: ['./vencimientos-semanales.component.css']
})
export class VencimientosSemanalesComponent implements OnInit, OnDestroy {

  reporteForm!: FormGroup;
  vencimientosSemanales: VencimientoSemanal[] = [];
  resumenSemanal: ResumenSemanal[] = [];
  loading = false;

  // Propiedades para el modal de detalle
  mostrarModalDetalle = false;
  detalleSeleccionado: VencimientoSemanal | null = null;
  detalleItems: any[] = [];
  loadingDetalle = false;

  // Configuración del gráfico
  public barChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 25,
        right: 5,
        bottom: 5,
        left: 5
      }
    },
    plugins: [ChartDataLabels, {
      legend: {
        position: 'top',
        labels: {
          padding: 20,
          font: {
            size: 11
          },
          boxWidth: 5,
          usePointStyle: true
        }
      },
      title: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        displayColors: false,
        callbacks: {
          title: function(context: any) {
            return context[0].label;
          },
          label: function(context: any) {
            if (context.datasetIndex === 0) {
              const index = context.dataIndex;
              const datasets = context.chart.data.datasets;

              const capital = Number(datasets[0].data[index]) || 0;
              const interes = Number(datasets[1].data[index]) || 0;
              const premio = Number(datasets[2].data[index]) || 0;
              const total = capital + interes + premio;

              const formatCurrency = (value: number) => {
                return new Intl.NumberFormat('es-ES', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 2,
                  useGrouping: true
                }).format(value);
              };

              const alignRight = (text: string, width: number) => {
                return ' '.repeat(Math.max(0, width - text.length)) + text;
              };

              const labels = [
                `Capital:  ${alignRight(formatCurrency(capital), 11)}`,
                `Interés:   ${alignRight(formatCurrency(interes), 11)}`,
                `Premio:    ${alignRight(formatCurrency(premio), 11)}`,
                `─`.repeat(22),
                `Total:     ${alignRight(formatCurrency(total), 11)}`
              ];

              return labels;
            }
            return '';
          }
        }
      }
    }],
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Días',
          font: {
            size: 11,
            weight: 'bold'
          },
          padding: { top: 4 }
        },
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 10
          },
          padding: 4
        }
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: 'Monto (USD)',
          font: {
            size: 11,
            weight: 'bold'
          },
          padding: { bottom: 4 }
        },
        grid: {
          color: '#e5e7eb'
        },
        ticks: {
          callback: function(value: any) {
            return new Intl.NumberFormat('es-ES', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0
            }).format(Number(value));
          },
          font: {
            size: 9
          },
          padding: 4
        }
      }
    }
  };

  public barChartType: ChartType = 'bar';
  public barChartData: any = {
    labels: [],
    datasets: [
      {
        label: 'Capital',
        data: [],
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
        order: 1,
        barPercentage: 0.95,
        categoryPercentage: 0.95,
        datalabels: {
          display: false
        }
      },
      {
        label: 'Interés',
        data: [],
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        order: 2,
        barPercentage: 0.95,
        categoryPercentage: 0.95,
        datalabels: {
          display: false
        }
      },
      {
        label: 'Premio',
        data: [],
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
        order: 3,
        barPercentage: 0.95,
        categoryPercentage: 0.95,
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'top',
          formatter: function(value: any, context: any) {
            const index = context.dataIndex;
            const datasets = context.chart.data.datasets;

            const capital = Number(datasets[0].data[index]) || 0;
            const interes = Number(datasets[1].data[index]) || 0;
            const premio = Number(datasets[2].data[index]) || 0;
            const total = capital + interes + premio;

            return new Intl.NumberFormat('es-CO', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }).format(total);
          },
          color: '#333',
          font: {
            weight: 'bold',
            size: 10
          }
        }
      }
    ]
  };

  private subscription: Subscription = new Subscription();
  private layoutSubscription: Subscription | null = null;

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private vencimientosService: VencimientosSemanalesService,
    private layoutService: LayoutService
  ) {}

  ngOnInit(): void {
    this.inicializarFormulario();
    this.setupLayoutListener();

    // Generar reporte automáticamente al cargar la página (sin mostrar mensajes)
    this.generarReporte(false);
  }

  setupLayoutListener(): void {
    this.layoutSubscription = this.layoutService.sidebarCollapsed$.subscribe(() => {
      setTimeout(() => {
        if (this.chartCanvas) {
          const canvas = this.chartCanvas.nativeElement;
          const event = new Event('resize');
          window.dispatchEvent(event);
        }
      }, 350);
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.layoutSubscription) {
      this.layoutSubscription.unsubscribe();
    }
  }

  inicializarFormulario(): void {
    // Fecha: hoy por defecto
    this.reporteForm = this.fb.group({
      fecha: [new Date(), Validators.required]
    });
  }

  generarReporte(mostrarMensaje: boolean = true): void {
    if (this.reporteForm.invalid) {
      if (mostrarMensaje) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Formulario inválido',
          detail: 'Por favor seleccione una fecha'
        });
      }
      return;
    }

    this.loading = true;
    const fecha = this.reporteForm.value.fecha;
    const fechaFormateada = this.formatDate(fecha);

    const sub = this.vencimientosService.getVencimientosSemanales(fechaFormateada).subscribe({
      next: (response: any) => {
        this.vencimientosSemanales = response.data?.vencimientos || [];
        this.resumenSemanal = response.data?.resumen_semanal || [];
        this.actualizarGrafico();

        this.loading = false;

        if (mostrarMensaje) {
          this.messageService.add({
            severity: 'success',
            summary: 'Reporte generado',
            detail: `Se encontraron ${this.vencimientosSemanales.length} registros`
          });
        }
      },
      error: (error: any) => {
        this.loading = false;
        this.vencimientosSemanales = [];
        this.resumenSemanal = [];
        this.actualizarGrafico();

        if (mostrarMensaje) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo generar el reporte'
          });
        }
      }
    });
    this.subscription.add(sub);
  }

  actualizarGrafico(): void {
    const labels = this.vencimientosSemanales.map(item => {
      const nombreDiaAbreviado = item.nombre_dia.substring(0, 3);
      const fecha = new Date(item.fecha);
      const dia = fecha.getDate();
      return `${nombreDiaAbreviado} ${dia}`;
    });
    const capital = this.vencimientosSemanales.map(item => item.capital);
    const interes = this.vencimientosSemanales.map(item => item.interes);
    const premio = this.vencimientosSemanales.map(item => item.premio);

    this.barChartData = {
      labels: labels,
      datasets: [
        {
          label: 'Capital',
          data: capital,
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
          order: 1,
          barPercentage: 0.95,
          categoryPercentage: 0.95,
          datalabels: {
            display: false
          }
        },
        {
          label: 'Interés',
          data: interes,
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          order: 2,
          barPercentage: 0.95,
          categoryPercentage: 0.95,
          datalabels: {
            display: false
          }
        },
        {
          label: 'Premio',
          data: premio,
          backgroundColor: 'rgba(75, 192, 192, 0.8)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
          order: 3,
          barPercentage: 0.95,
          categoryPercentage: 0.95,
          datalabels: {
            display: true,
            anchor: 'end',
            align: 'top',
            formatter: function(value: any, context: any) {
              const index = context.dataIndex;
              const datasets = context.chart.data.datasets;

              const capital = Number(datasets[0].data[index]) || 0;
              const interes = Number(datasets[1].data[index]) || 0;
              const premio = Number(datasets[2].data[index]) || 0;
              const total = capital + interes + premio;

              return new Intl.NumberFormat('es-CO', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }).format(total);
            },
            color: '#333',
            font: {
              weight: 'bold',
              size: 10
            }
          }
        }
      ]
    };
  }

  exportarExcel(): void {
    if (this.vencimientosSemanales.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin datos',
        detail: 'No hay datos para exportar'
      });
      return;
    }

    const fecha = this.reporteForm.value.fecha;
    const fechaFormateada = this.formatDate(fecha);

    const datos = this.vencimientosSemanales.map(item => ({
      'Día': item.nombre_dia,
      'Fecha': item.fecha,
      'Capital': item.capital,
      'Interés': item.interes,
      'Premio': item.premio,
      'Interés Moroso': item.interes_moroso,
      'Capital Moroso': item.capital_moroso,
      'Total': item.total
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vencimientos Semanales');

    // Formatear columnas numéricas en Excel
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      for (let col = range.s.c + 2; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({r: row, c: col});
        if (ws[cellAddress]) {
          ws[cellAddress].z = '#,##0.00';
        }
      }
    }

    XLSX.writeFile(wb, `vencimientos_semanales_${fechaFormateada}.xlsx`);

    this.messageService.add({
      severity: 'success',
      summary: 'Exportación exitosa',
      detail: 'Archivo Excel descargado'
    });
  }

  exportarPDF(): void {
    if (this.vencimientosSemanales.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin datos',
        detail: 'No hay datos para exportar'
      });
      return;
    }

    const doc = new jsPDF();
    const fecha = this.reporteForm.value.fecha;
    const fechaFormateada = this.formatDate(fecha);

    doc.setFontSize(18);
    doc.text('Vencimientos Semanales', 14, 20);
    doc.setFontSize(12);
    doc.text(`Semana del: ${fechaFormateada}`, 14, 30);

    const datos = this.vencimientosSemanales.map(item => [
      item.nombre_dia,
      item.fecha,
      new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.capital),
      new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.interes),
      new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.premio),
      new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.total)
    ]);

    autoTable(doc, {
      head: [['Día', 'Fecha', 'Capital', 'Interés', 'Premio', 'Total']],
      body: datos,
      startY: 40,
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [74, 140, 98],
        textColor: 255
      }
    });

    doc.save(`vencimientos_semanales_${fechaFormateada}.pdf`);

    this.messageService.add({
      severity: 'success',
      summary: 'Exportación exitosa',
      detail: 'Archivo PDF descargado'
    });
  }

  formatDate(date: Date | string): string {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  getResumenTotal(): number {
    const total = this.resumenSemanal.find(r => r.tipo === 'TOTAL');
    return total?.total || 0;
  }

  getResumenEjecutado(): number {
    const ejecutado = this.resumenSemanal.find(r => r.tipo === 'EJECUTADO');
    return ejecutado?.total || 0;
  }

  getResumenPendiente(): number {
    const pendiente = this.resumenSemanal.find(r => r.tipo === 'PENDIENTE');
    return pendiente?.total || 0;
  }

  // Método para mostrar el detalle de una fila
  mostrarDetalle(item: VencimientoSemanal): void {
    this.detalleSeleccionado = item;
    this.loadingDetalle = true;
    this.mostrarModalDetalle = true;

    // Obtener el detalle del backend por fecha
    this.vencimientosService.getDetalleVencimientosSemanales(item.fecha).subscribe({
      next: (response: any) => {
        this.loadingDetalle = false;
        if (response.success) {
          this.detalleItems = response.data || [];
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Advertencia',
            detail: response.message || 'No se pudo obtener el detalle'
          });
        }
      },
      error: (error: any) => {
        this.loadingDetalle = false;
        console.error('Error al obtener detalle:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo conectar con el backend'
        });
      }
    });
  }

  // Método para cerrar el modal de detalle
  cerrarModalDetalle(): void {
    this.mostrarModalDetalle = false;
    this.detalleSeleccionado = null;
    this.detalleItems = [];
  }

  // Método para exportar el detalle a Excel
  exportarDetalle(): void {
    if (this.detalleItems.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No hay datos para exportar'
      });
      return;
    }

    // Generar Excel con los datos del detalle
    const wb = XLSX.utils.book_new();

    // Encabezados para el detalle
    const headers = [
      'Propietario',
      'Emisor',
      'Tipo Inversión',
      '# Instrumentos',
      'Interés',
      'Capital',
      'Premio',
      'Int. Riesgo',
      'Cap. Riesgo',
      'Prem. Riesgo',
      'Total'
    ];

    // Datos del detalle
    const datosDetalle = this.detalleItems.map(item => [
      item.propietario,
      item.emisor,
      item.tipo_inversion,
      item.cantidad_instrumentos,
      item.interes,
      item.capital,
      item.premio,
      item.interes_riesgo,
      item.capital_riesgo,
      item.premio_riesgo,
      item.total
    ]);

    // Crear worksheet
    const wsData = [headers, ...datosDetalle];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Formato de encabezados
    const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({r: 0, c: col});
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          font: {bold: true, color: {rgb: "FFFFFFFF"}},
          fill: {fgColor: {rgb: "FF4472C4"}}
        };
      }
    }

    // Ancho de columnas
    ws['!cols'] = [
      {wch: 25}, // Propietario
      {wch: 25}, // Emisor
      {wch: 20}, // Tipo Inversión
      {wch: 15}, // # Instrumentos
      {wch: 12}, // Interés
      {wch: 12}, // Capital
      {wch: 12}, // Premio
      {wch: 12}, // Int. Riesgo
      {wch: 12}, // Cap. Riesgo
      {wch: 12}, // Prem. Riesgo
      {wch: 12}  // Total
    ];

    // Formatear columnas numéricas en Excel
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      for (let col = range.s.c + 4; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({r: row, c: col});
        if (ws[cellAddress]) {
          ws[cellAddress].z = '#,##0.00';
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Detalle Vencimientos');

    // Descargar archivo
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `detalle-vencimientos-semanales-${fecha}.xlsx`);

    this.messageService.add({
      severity: 'success',
      summary: 'Exportación',
      detail: 'Archivo Excel del detalle descargado correctamente'
    });
  }
}
