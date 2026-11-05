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
import { InputTextModule } from 'primeng/inputtext';
import { VencimientosSemanalesService, VencimientoSemanal, ResumenSemanal } from '../../../core/vencimientos-semanales.service';
import { InversionService } from '../../../core/inversion.service';
import { AmortizacionService } from '../../../core/amortizacion.service';
import { ModalActionsComponent } from '../../../core/modal-actions';
import { Subscription, forkJoin } from 'rxjs';
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
    InputTextModule,
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

  // Propiedades para modal de edición de amortización
  displayEditAmortizacionDialog = false;
  loadingAmortizacion = false;
  editingAmortizacionId: number | null = null;
  amortizacionOriginal: any = null;
  selectedAmortizacionDetalle: any = null;
  inversionResumen: any = null;
  amortizacionForm!: FormGroup;

  // Propiedades para modal de pago parcial
  displayPagoParcialDialog = false;
  loadingPagoParcial = false;
  pagoParcialForm!: FormGroup;
  saldoRestanteCalculado = { capital: 0, interes: 0, descuento: 0, total: 0 };
  totalPagadoCalculado = 0;

  // Propiedades para modal de historial de pagos
  displayHistorialDialog = false;
  loadingHistorial = false;
  historialPagos: any[] = [];
  cuotaHistorialSeleccionada: any = null;

  // Propiedades para selector de instrumentos múltiples
  displaySelectorInstrumentosDialog = false;
  instrumentosDisponibles: Array<{ id_inversion: number; id_amortizacion: number; raw: string }> = [];
  itemAgrupadoSeleccionado: any = null;

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
      tooltip: createStackedTooltipOptions('$')
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
    private layoutService: LayoutService,
    private inversionService: InversionService,
    private amortizacionService: AmortizacionService
  ) {}

  ngOnInit(): void {
    this.inicializarFormulario();
    this.inicializarAmortizacionForms();
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

  // =========================================================================
  // GESTIÓN Y EDICIÓN DE AMORTIZACIONES DESDE EL DETALLE DIARIO
  // =========================================================================

  inicializarAmortizacionForms(): void {
    this.amortizacionForm = this.fb.group({
      fecha_pago: [null, Validators.required],
      capital: [0, [Validators.required, Validators.min(0)]],
      interes: [0, [Validators.required, Validators.min(0)]],
      descuento: [0, Validators.required]
    });

    this.pagoParcialForm = this.fb.group({
      fecha_pago_hoy: [new Date(), Validators.required],
      capital_pagado: [0, [Validators.required, Validators.min(0)]],
      interes_pagado: [0, [Validators.required, Validators.min(0)]],
      descuento_pagado: [0, Validators.required],
      fecha_compromiso: [null, Validators.required],
      observacion: ['']
    });

    this.pagoParcialForm.valueChanges.subscribe(() => {
      this.recalcularSaldoRestante();
    });
  }

  parseInversionAmortizacion(val: string): Array<{ id_inversion: number; id_amortizacion: number; raw: string }> {
    if (!val) return [];
    return val.split(',').map(s => s.trim()).filter(Boolean).map(part => {
      const parts = part.split('-').map(p => Number(p.trim()));
      return { id_inversion: parts[0] || 0, id_amortizacion: parts[1] || 0, raw: part };
    });
  }

  onRowClick(item: any): void {
    const pairs = this.parseInversionAmortizacion(item.id_inversion_amortizacion);
    if (pairs.length === 1) {
      this.abrirEditarAmortizacion(pairs[0].id_inversion, pairs[0].id_amortizacion, item);
    } else if (pairs.length > 1) {
      this.instrumentosDisponibles = pairs;
      this.itemAgrupadoSeleccionado = item;
      this.displaySelectorInstrumentosDialog = true;
    }
  }

  seleccionarInstrumentoParaEditar(pair: { id_inversion: number; id_amortizacion: number }): void {
    this.displaySelectorInstrumentosDialog = false;
    this.abrirEditarAmortizacion(pair.id_inversion, pair.id_amortizacion, this.itemAgrupadoSeleccionado);
  }

  abrirEditarAmortizacion(id_inversion: number, id_amortizacion: number, fallbackItem?: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!id_amortizacion) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'ID de amortización no válido' });
      return;
    }

    this.displaySelectorInstrumentosDialog = false;
    this.loadingAmortizacion = true;
    this.displayEditAmortizacionDialog = true;
    this.editingAmortizacionId = id_amortizacion;
    this.selectedAmortizacionDetalle = null;
    this.inversionResumen = null;

    forkJoin({
      inv: this.inversionService.getById(id_inversion),
      amortizaciones: this.amortizacionService.getByInversion(id_inversion),
      amortizacion: this.amortizacionService.getById(id_amortizacion)
    }).subscribe({
      next: ({ inv, amortizaciones, amortizacion }: any) => {
        this.amortizacionOriginal = amortizacion;

        const initialFechaCompra = this.formatDateOnlyString(inv?.fecha_compra);
        let initialFechaVencimiento = this.formatDateOnlyString(inv?.instrumento?.fecha_vencimiento);
        if (!initialFechaVencimiento && inv?.instrumento?.nombre) {
          const matches = inv.instrumento.nombre.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
          if (matches && matches.length > 0) {
            initialFechaVencimiento = matches[matches.length - 1];
          }
        }

        const diasCompraVencimiento = this.calculateDaysDifference(initialFechaCompra, initialFechaVencimiento);
        const diasTranscurridosHoy = this.calculateDaysDifference(initialFechaCompra, new Date());

        this.selectedAmortizacionDetalle = {
          id_inversion: inv.id_inversion,
          id_amortizacion: amortizacion.id_amortizacion,
          liquidacion: inv.liquidacion,
          nombre_instrumento: inv.instrumento?.nombre || ('Inversión #' + inv.id_inversion),
          propietario: inv.propietario ? (inv.propietario.nombres + ' ' + (inv.propietario.apellidos || '')) : (fallbackItem?.propietario || '-'),
          cuota: amortizacion.numero_cuota || amortizacion.cuota || '-',
          fecha_compra_formateada: initialFechaCompra,
          fecha_vencimiento_formateada: initialFechaVencimiento,
          dias_compra_vencimiento: diasCompraVencimiento,
          dias_transcurridos_hoy: diasTranscurridosHoy
        };

        let valorNominalOriginal = Number(inv.valor_nominal || 0);
        let capitalInvertidoOriginal = Number(inv.capital_invertido || 0);
        let capitalRecibido = 0;
        let interesRecibido = 0;
        let interesEsperado = 0;

        (amortizaciones || []).forEach((a: any) => {
          const cap = Number(a.capital || 0);
          const int = Number(a.interes || 0);
          const pagada = a.id_estado_amortizacion === 135 || a.estado_amortizacion === 'Pagado' || a.pagada_old === 1;
          interesEsperado += int;
          if (pagada) {
            capitalRecibido += cap;
            interesRecibido += int;
          }
        });

        this.inversionResumen = {
          valorNominalOriginal: valorNominalOriginal,
          valorNominalRecibido: capitalRecibido,
          valorNominalPendiente: Math.max(0, valorNominalOriginal - capitalRecibido),
          capitalInvertidoOriginal: capitalInvertidoOriginal,
          capitalInvertidoRecibido: valorNominalOriginal > 0 ? (capitalRecibido / valorNominalOriginal) * capitalInvertidoOriginal : 0,
          capitalInvertidoPendiente: valorNominalOriginal > 0 ? Math.max(0, capitalInvertidoOriginal - ((capitalRecibido / valorNominalOriginal) * capitalInvertidoOriginal)) : capitalInvertidoOriginal,
          interesTotalEsperado: interesEsperado,
          interesTotalRecibido: interesRecibido,
          interesTotalPendiente: Math.max(0, interesEsperado - interesRecibido),
          fechaCompra: initialFechaCompra,
          fechaVencimiento: initialFechaVencimiento,
          diasCompraVencimiento: diasCompraVencimiento,
          diasTranscurridosHoy: diasTranscurridosHoy
        };

        let parsedDate = null;
        if (amortizacion.fecha_pago) {
          const dateString = amortizacion.fecha_pago.toString().substring(0, 10);
          parsedDate = new Date(dateString + 'T00:00:00');
        }

        this.amortizacionForm.patchValue({
          fecha_pago: parsedDate,
          capital: amortizacion.capital,
          interes: amortizacion.interes,
          descuento: amortizacion.descuento
        });

        this.loadingAmortizacion = false;
      },
      error: (err) => {
        this.loadingAmortizacion = false;
        this.displayEditAmortizacionDialog = false;
        console.error('Error cargando inversión y amortización:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar la amortización seleccionada'
        });
      }
    });
  }

  saveAmortizacion(): void {
    if (this.amortizacionForm.invalid || !this.editingAmortizacionId) return;

    this.loadingAmortizacion = true;
    const formValues = this.amortizacionForm.value;
    const updateData = {
      ...this.amortizacionOriginal,
      fecha_pago: this.formatDate(formValues.fecha_pago),
      capital: formValues.capital,
      interes: formValues.interes,
      descuento: formValues.descuento,
      total: Number(formValues.capital) + Number(formValues.interes) + Number(formValues.descuento)
    };

    this.amortizacionService.update(this.editingAmortizacionId, updateData).subscribe({
      next: () => {
        this.loadingAmortizacion = false;
        this.displayEditAmortizacionDialog = false;
        this.selectedAmortizacionDetalle = null;
        this.inversionResumen = null;
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Amortización actualizada correctamente' });

        if (this.detalleSeleccionado) {
          this.recargarDetalle();
        }
        this.generarReporte(false);
      },
      error: (err) => {
        this.loadingAmortizacion = false;
        console.error('Error actualizando amortización:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar la amortización' });
      }
    });
  }

  cancelEditAmortizacion(): void {
    this.displayEditAmortizacionDialog = false;
    this.editingAmortizacionId = null;
    this.amortizacionOriginal = null;
    this.selectedAmortizacionDetalle = null;
    this.inversionResumen = null;
    this.amortizacionForm.reset();
  }

  recargarDetalle(): void {
    if (!this.detalleSeleccionado) return;
    this.loadingDetalle = true;
    this.vencimientosService.getDetalleVencimientosSemanales(this.detalleSeleccionado.fecha).subscribe({
      next: (response) => {
        this.loadingDetalle = false;
        this.detalleItems = response.data || [];
        this.detalleItemsLunes = response.data_lunes || [];
        this.fechasIncluidas = response.fechas_incluidas || [];
        this.esLunes = response.es_lunes || false;

        if (this.esLunes) {
          this.totalConsolidado = this.detalleItems.reduce((sum: number, item: any) => sum + item.total, 0);
          this.totalLunes = this.detalleItemsLunes.reduce((sum: number, item: any) => sum + item.total, 0);
        } else {
          this.totalConsolidado = this.detalleSeleccionado!.total;
          this.totalLunes = 0;
        }
      },
      error: () => {
        this.loadingDetalle = false;
      }
    });
  }

  abrirModalPagoParcial(): void {
    if (!this.amortizacionOriginal && !this.selectedAmortizacionDetalle) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: 'No se encontraron datos de la cuota para dividir'
      });
      return;
    }

    this.pagoParcialForm.patchValue({
      fecha_pago_hoy: new Date(),
      capital_pagado: 0,
      interes_pagado: 0,
      descuento_pagado: 0,
      fecha_compromiso: null,
      observacion: ''
    }, { emitEvent: false });

    this.recalcularSaldoRestante();
    this.displayPagoParcialDialog = true;
  }

  cancelarPagoParcial(): void {
    this.displayPagoParcialDialog = false;
  }

  recalcularSaldoRestante(): void {
    const origCapital = this.getOriginalCapitalCuota();
    const origInteres = this.getOriginalInteresCuota();
    const origDescuento = this.getOriginalDescuentoCuota();

    const pagadoCapital = Number(this.pagoParcialForm?.get('capital_pagado')?.value || 0);
    const pagadoInteres = Number(this.pagoParcialForm?.get('interes_pagado')?.value || 0);
    const pagadoDescuento = Number(this.pagoParcialForm?.get('descuento_pagado')?.value || 0);

    const capRestante = Math.max(0, Number((origCapital - pagadoCapital).toFixed(2)));
    const intRestante = Math.max(0, Number((origInteres - pagadoInteres).toFixed(2)));
    const descRestante = Number((origDescuento - pagadoDescuento).toFixed(2));
    const totRestante = Number((capRestante + intRestante + descRestante).toFixed(2));

    this.saldoRestanteCalculado = {
      capital: capRestante,
      interes: intRestante,
      descuento: descRestante,
      total: totRestante
    };

    this.totalPagadoCalculado = Number((pagadoCapital + pagadoInteres + pagadoDescuento).toFixed(2));
  }

  guardarPagoParcial(): void {
    if (this.pagoParcialForm.invalid || !this.editingAmortizacionId) {
      this.pagoParcialForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario Incompleto',
        detail: 'Por favor complete todos los campos obligatorios, incluyendo la fecha de compromiso'
      });
      return;
    }

    const formVal = this.pagoParcialForm.value;
    const pagadoCapital = Number(formVal.capital_pagado || 0);
    const pagadoInteres = Number(formVal.interes_pagado || 0);
    const pagadoDescuento = Number(formVal.descuento_pagado || 0);
    const totalPagado = Number((pagadoCapital + pagadoInteres + pagadoDescuento).toFixed(2));

    const origCapital = this.getOriginalCapitalCuota();
    const origInteres = this.getOriginalInteresCuota();

    if (totalPagado <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validación',
        detail: 'El total pagado hoy debe ser mayor a cero'
      });
      return;
    }

    if (pagadoCapital > origCapital) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validación',
        detail: `El capital pagado ($${pagadoCapital}) no puede superar el capital de la cuota ($${origCapital})`
      });
      return;
    }

    if (pagadoInteres > origInteres) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validación',
        detail: `El interés pagado ($${pagadoInteres}) no puede superar el interés de la cuota ($${origInteres})`
      });
      return;
    }

    if (!formVal.fecha_compromiso) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validación',
        detail: 'Debe ingresar la fecha en que el emisor se compromete a pagar el saldo restante'
      });
      return;
    }

    const payload = {
      pago_actual: {
        fecha_pago: this.formatDate(formVal.fecha_pago_hoy),
        capital: pagadoCapital,
        interes: pagadoInteres,
        descuento: pagadoDescuento
      },
      saldo_restante: {
        fecha_pago: this.formatDate(formVal.fecha_compromiso),
        capital: this.saldoRestanteCalculado.capital,
        interes: this.saldoRestanteCalculado.interes,
        descuento: this.saldoRestanteCalculado.descuento
      },
      observacion: formVal.observacion ? formVal.observacion.trim() : null
    };

    this.loadingPagoParcial = true;
    this.amortizacionService.registrarPagoParcial(this.editingAmortizacionId, payload).subscribe({
      next: (res: any) => {
        this.loadingPagoParcial = false;
        this.displayPagoParcialDialog = false;
        this.displayEditAmortizacionDialog = false;
        this.editingAmortizacionId = null;
        this.amortizacionOriginal = null;
        this.selectedAmortizacionDetalle = null;
        this.inversionResumen = null;

        this.messageService.add({
          severity: 'success',
          summary: 'Pago Parcial Registrado',
          detail: res.message || 'La cuota se dividió exitosamente en pagada y pendiente'
        });

        if (this.detalleSeleccionado) {
          this.recargarDetalle();
        }
        this.generarReporte(false);
      },
      error: (err: any) => {
        this.loadingPagoParcial = false;
        console.error('Error al registrar pago parcial:', err);
        const errorMsg = err.error?.message || err.message || 'Error al procesar el pago parcial';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMsg
        });
      }
    });
  }

  verHistorialPagos(item?: any): void {
    const amortizacionItem = item || this.selectedAmortizacionDetalle;
    if (!amortizacionItem || !amortizacionItem.id_amortizacion) return;

    this.cuotaHistorialSeleccionada = amortizacionItem;
    this.loadingHistorial = true;
    this.displayHistorialDialog = true;
    this.historialPagos = [];

    this.amortizacionService.getHistorialPagos(amortizacionItem.id_amortizacion).subscribe({
      next: (res: any) => {
        this.loadingHistorial = false;
        this.historialPagos = res.data || [];
      },
      error: (err: any) => {
        this.loadingHistorial = false;
        console.error('Error cargando historial de pagos:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar el historial de pagos parciales'
        });
      }
    });
  }

  getOriginalCapitalCuota(): number {
    return Number(this.amortizacionForm?.get('capital')?.value ?? this.amortizacionOriginal?.capital ?? 0);
  }

  getOriginalInteresCuota(): number {
    return Number(this.amortizacionForm?.get('interes')?.value ?? this.amortizacionOriginal?.interes ?? 0);
  }

  getOriginalDescuentoCuota(): number {
    return Number(this.amortizacionForm?.get('descuento')?.value ?? this.amortizacionOriginal?.descuento ?? 0);
  }

  getOriginalTotalCuota(): number {
    return Number((this.getOriginalCapitalCuota() + this.getOriginalInteresCuota() + this.getOriginalDescuentoCuota()).toFixed(2));
  }

  formatDateOnlyString(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') {
      const match = val.trim().match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }
    if (val instanceof Date) {
      const year = val.getFullYear();
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const day = String(val.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return String(val);
  }

  parseDateToUTC(val: any): number | null {
    if (!val) return null;
    let year: number, month: number, day: number;
    if (val instanceof Date) {
      year = val.getFullYear();
      month = val.getMonth();
      day = val.getDate();
    } else if (typeof val === 'string') {
      const match = val.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10) - 1;
        day = parseInt(match[3], 10);
      } else {
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        year = d.getFullYear();
        month = d.getMonth();
        day = d.getDate();
      }
    } else {
      return null;
    }
    return Date.UTC(year, month, day);
  }

  calculateDaysDifference(startVal: any, endVal: any): number | null {
    const startUtc = this.parseDateToUTC(startVal);
    const endUtc = this.parseDateToUTC(endVal);
    if (startUtc === null || endUtc === null) return null;
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((endUtc - startUtc) / msPerDay);
  }
}
