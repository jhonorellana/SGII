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
import { createStackedTooltipOptions } from '../../../core/utils/chart-options.util';

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
  detalleItemsLunes: any[] = [];
  loadingDetalle = false;
  fechasIncluidas: string[] = [];
  esLunes = false;
  totalConsolidado = 0;
  totalLunes = 0;

  public barChartPlugins = [ChartDataLabels];

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
    plugins: {
      datalabels: {
        display: false
      },
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
      tooltip: createStackedTooltipOptions('US$')
    },
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
        barThickness: 120,
        maxBarThickness: 140,
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
        barThickness: 120,
        maxBarThickness: 140,
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'top',
          formatter: function(value: any, context: any) {
            const index = context.dataIndex;
            const datasets = context.chart.data.datasets;

            const capital = Number(datasets[0].data[index]) || 0;
            const interes = Number(datasets[1].data[index]) || 0;
            const total = capital + interes;

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
          barThickness: 120,
          maxBarThickness: 140,
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
          barThickness: 120,
          maxBarThickness: 140,
          datalabels: {
            display: true,
            anchor: 'end',
            align: 'top',
            formatter: function(value: any, context: any) {
              const index = context.dataIndex;
              const datasets = context.chart.data.datasets;

              const capital = Number(datasets[0].data[index]) || 0;
              const interes = Number(datasets[1].data[index]) || 0;
              const total = capital + interes;

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

  mostrarDetalle(item: VencimientoSemanal): void {
    this.detalleSeleccionado = item;
    this.loadingDetalle = true;
    this.mostrarModalDetalle = true;
    this.fechasIncluidas = [];
    this.esLunes = false;
    this.detalleItemsLunes = [];

    this.vencimientosService.getDetalleVencimientosSemanales(item.fecha).subscribe({
      next: (response) => {
        this.loadingDetalle = false;
        this.detalleItems = response.data || [];
        this.detalleItemsLunes = response.data_lunes || [];
        this.fechasIncluidas = response.fechas_incluidas || [];
        this.esLunes = response.es_lunes || false;

        // Si es lunes, calcular el total consolidado de todas las fechas
        if (this.esLunes) {
          this.totalConsolidado = this.detalleItems.reduce((sum, item) => sum + item.total, 0);
          this.totalLunes = this.detalleItemsLunes.reduce((sum, item) => sum + item.total, 0);
        } else {
          this.totalConsolidado = item.total;
          this.totalLunes = 0;
        }
      },
      error: () => {
        this.loadingDetalle = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar el detalle'
        });
      }
    });
  }

  // Método para cerrar el modal de detalle
  cerrarModalDetalle(): void {
    this.mostrarModalDetalle = false;
    this.detalleSeleccionado = null;
    this.detalleItems = [];
    this.detalleItemsLunes = [];
    this.fechasIncluidas = [];
    this.esLunes = false;
    this.totalConsolidado = 0;
    this.totalLunes = 0;
  }

  // Método para exportar el detalle a Excel
  exportarDetalle(): void {
    if (this.detalleItems.length === 0 && this.detalleItemsLunes.length === 0) {
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
      'Id',
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

    // Si es lunes, crear hoja para lunes
    if (this.esLunes && this.detalleItemsLunes.length > 0) {
      const datosLunes = this.detalleItemsLunes.map(item => [
        item.id_inversion_amortizacion,
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

      const wsDataLunes = [
        ['Vencimientos del Lunes'],
        ['Total lunes: ' + this.formatCurrency(this.totalLunes)],
        [],
        headers,
        ...datosLunes
      ];

      const wsLunes = XLSX.utils.aoa_to_sheet(wsDataLunes);
      wsLunes['!cols'] = [
        {wch: 18}, {wch: 25}, {wch: 25}, {wch: 20}, {wch: 15},
        {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}
      ];

      // Formatear columnas numéricas
      const rangeLunes = XLSX.utils.decode_range(wsLunes['!ref'] || 'A1');
      for (let row = 4; row <= rangeLunes.e.r; row++) {
        for (let col = rangeLunes.s.c + 5; col <= rangeLunes.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({r: row, c: col});
          if (wsLunes[cellAddress]) {
            wsLunes[cellAddress].z = '#,##0.00';
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, wsLunes, 'Vencimientos Lunes');
    }

    // Datos del detalle consolidado
    const datosDetalle = this.detalleItems.map(item => [
      item.id_inversion_amortizacion,
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

    // Crear worksheet con información de rango de fechas si es lunes
    let wsData = [headers, ...datosDetalle];
    if (this.esLunes && this.fechasIncluidas.length > 0) {
      const rangoFechas = this.fechasIncluidas[0] + ' al ' + this.fechasIncluidas[this.fechasIncluidas.length - 1];
      const infoHeader = ['Vencimientos Consolidados (Sábado, Domingo, Lunes)'];
      const rangoHeader = ['Rango de fechas: ' + rangoFechas];
      const totalHeader = ['Total consolidado: ' + this.formatCurrency(this.totalConsolidado)];
      wsData = [infoHeader, rangoHeader, totalHeader, [], headers, ...datosDetalle];
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ancho de columnas
    ws['!cols'] = [
      {wch: 18}, // Id
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
    const startRow = this.esLunes ? 5 : 1; // Empezar después de los headers de info si es lunes
    for (let row = startRow; row <= range.e.r; row++) {
      for (let col = range.s.c + 5; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({r: row, c: col});
        if (ws[cellAddress]) {
          ws[cellAddress].z = '#,##0.00';
        }
      }
    }

    // Nombre de la hoja consolidado
    const nombreHoja = this.esLunes ? 'Vencimientos Consolidados' : 'Vencimientos';
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);

    // Descargar archivo
    const fecha = new Date().toISOString().split('T')[0];
    const nombreArchivo = this.esLunes
      ? `detalle-vencimientos-semanales-sab-dom-lun-${fecha}.xlsx`
      : `detalle-vencimientos-semanales-${fecha}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);

    this.messageService.add({
      severity: 'success',
      summary: 'Exportación',
      detail: 'Archivo Excel del detalle descargado correctamente'
    });
  }

  // Método para exportar solo el detalle del lunes
  exportarDetalleLunes(): void {
    if (this.detalleItemsLunes.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No hay datos del lunes para exportar'
      });
      return;
    }

    const wb = XLSX.utils.book_new();

    const headers = [
      'Id',
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

    const datosLunes = this.detalleItemsLunes.map(item => [
      item.id_inversion_amortizacion,
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

    const wsData = [
      ['Vencimientos del Lunes'],
      ['Total: ' + this.formatCurrency(this.totalLunes)],
      [],
      headers,
      ...datosLunes
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      {wch: 18}, {wch: 25}, {wch: 25}, {wch: 20}, {wch: 15},
      {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}
    ];

    // Formatear columnas numéricas
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = 4; row <= range.e.r; row++) {
      for (let col = range.s.c + 5; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({r: row, c: col});
        if (ws[cellAddress]) {
          ws[cellAddress].z = '#,##0.00';
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Vencimientos Lunes');

    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `vencimientos-lunes-${fecha}.xlsx`);

    this.messageService.add({
      severity: 'success',
      summary: 'Exportación',
      detail: 'Archivo Excel del lunes descargado correctamente'
    });
  }
}
