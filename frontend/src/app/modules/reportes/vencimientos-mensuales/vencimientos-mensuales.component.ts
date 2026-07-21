import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { VencimientosMensualesService, VencimientoMensual, ResumenAnual } from '../../../core/vencimientos-mensuales.service';
import { Subscription } from 'rxjs';
import { NgChartsModule } from 'ng2-charts';
import { ChartOptions, ChartType } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';
import { LayoutService } from '../../../core/layout.service';
import { DialogModule } from 'primeng/dialog';
import { FlujoCapitalConsolidadoComponent } from '../flujo-capital-consolidado/flujo-capital-consolidado.component';

@Component({
  selector: 'app-vencimientos-mensuales',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    ButtonModule,
    DropdownModule,
    CalendarModule,
    ProgressSpinnerModule,
    TableModule,
    CardModule,
    NgChartsModule,
    DialogModule,
    FlujoCapitalConsolidadoComponent
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

  mostrarModalDetalleMes = false;
  paramsModalDetalle: any = null;
  mesSeleccionado = '';

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
          text: 'Meses',
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

            if (total === 0) {
              return '';
            }

            return new Intl.NumberFormat('es-ES', {
              useGrouping: true,
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(total);
          },
          font: {
            weight: 'bold',
            size: 10
          },
          color: '#333'
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
    private vencimientosService: VencimientosMensualesService,
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
      // Wait for the sidebar transition to complete before resizing the chart
      setTimeout(() => {
        // ng2-charts handles resize automatically with responsive: true
        // Just need to trigger a resize event on the canvas
        if (this.chartCanvas) {
          const canvas = this.chartCanvas.nativeElement;
          const event = new Event('resize');
          window.dispatchEvent(event);
        }
      }, 350);
    });
  }

  abrirDetalleMes(item: VencimientoMensual): void {
    if (!item || !item.nombre_mes) return;
    const parts = item.nombre_mes.split('-');
    if (parts.length < 2) return;
    const mesStr = parts[0];
    const year = parts[1];
    
    const meses: any = {'Ene': '01', 'Feb': '02', 'Mar': '03', 'Abr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Ago': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dic': '12'};
    const mesNum = meses[mesStr];
    if (!mesNum) return;
    
    const fecha_fin = new Date(Number(year), Number(mesNum), 0);
    const lastDay = String(fecha_fin.getDate()).padStart(2, '0');
    
    this.mesSeleccionado = item.nombre_mes;
    this.paramsModalDetalle = {
      fecha_inicio: `${year}-${mesNum}-01`,
      fecha_fin: `${year}-${mesNum}-${lastDay}`,
      id_grupo_familiar: this.reporteForm.get('id_grupo_familiar')?.value,
      id_propietario: this.reporteForm.get('id_propietario')?.value
    };
    
    this.mostrarModalDetalleMes = false;
    setTimeout(() => {
      this.mostrarModalDetalleMes = true;
    }, 0);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    if (this.layoutSubscription) {
      this.layoutSubscription.unsubscribe();
    }
  }

  inicializarFormulario(): void {
    const anioActual = new Date().getFullYear();
    const fechaInicioDefault = new Date(anioActual, 0, 1);
    const fechaFinDefault = new Date(anioActual, 11, 31);

    this.reporteForm = this.fb.group({
      fecha_inicio: [fechaInicioDefault, Validators.required],
      fecha_fin: [fechaFinDefault, Validators.required]
    });
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  }

  generarReporte(mostrarMensaje: boolean = true): void {
    if (this.reporteForm.invalid) {
      if (mostrarMensaje) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Advertencia',
          detail: 'Por favor seleccione las fechas de inicio y fin'
        });
      }
      return;
    }

    this.loading = true;

    const fechaInicioRaw = this.reporteForm.get('fecha_inicio')?.value;
    const fechaFinRaw = this.reporteForm.get('fecha_fin')?.value;

    const fechaInicio = this.formatDate(fechaInicioRaw);
    const fechaFin = this.formatDate(fechaFinRaw);

    // Llamar al servicio real
    this.vencimientosService.getVencimientosMensuales(fechaInicio, fechaFin).subscribe({
      next: (response) => {
        if (response.success) {
          this.vencimientosMensuales = response.data.vencimientos;
          this.resumenAnual = response.data.resumen_anual;
          this.actualizarGrafico();
          this.loading = false;

          if (mostrarMensaje) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Reporte generado correctamente desde el backend'
            });
          }
        } else {
          throw new Error('Error en la respuesta del backend');
        }
      },
      error: (error) => {
        console.error('Error al generar reporte:', error);
        this.loading = false;

        if (mostrarMensaje) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo conectar con el backend. Por favor, verifique la conexión.'
          });
        }
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

  // calcularResumenAnual() ya no es necesario porque el backend calcula el resumen del rango


  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  exportarExcel(): void {
    const fechaInicioRaw = this.reporteForm.get('fecha_inicio')?.value;
    const fechaFinRaw = this.reporteForm.get('fecha_fin')?.value;

    const fechaInicio = this.formatDate(fechaInicioRaw);
    const fechaFin = this.formatDate(fechaFinRaw);

    this.vencimientosService.exportarExcel(fechaInicio, fechaFin).subscribe({
      next: (response) => {
        if (response.success) {
          this.generarExcelFrontend(response.data);
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: response.message || 'No se pudo exportar el archivo Excel'
          });
        }
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

  generarExcelFrontend(datos: any): void {
    try {
      const wb = XLSX.utils.book_new();

      // Preparar datos para el Excel
      const datosReporte = datos.vencimientos || [];
      const resumen = datos.resumen_anual || [];

      // Hoja de vencimientos mensuales
      const wsData = [
        ['Vencimientos Mensuales'],
        [],
        ['Mes', 'Año', 'Interés', 'Capital', 'Premio', 'Total', 'Mes Actual']
      ];

      // Agregar datos de vencimientos
      datosReporte.forEach((item: VencimientoMensual) => {
        wsData.push([
          item.nombre_mes,
          item.anio.toString(),
          item.interes.toString(),
          item.capital.toString(),
          item.premio.toString(),
          item.total.toString(),
          item.es_mes_actual ? 'Sí' : 'No'
        ]);
      });

      // Agregar fila vacía y totales
      wsData.push([]);
      const totalRow = wsData.length;

      // Calcular totales
      const totales = datosReporte.reduce((acc: any, item: VencimientoMensual) => ({
        interes: acc.interes + item.interes,
        capital: acc.capital + item.capital,
        premio: acc.premio + item.premio,
        total: acc.total + item.total
      }), { interes: 0, capital: 0, premio: 0, total: 0 });

      wsData.push([
        'TOTAL',
        '',
        totales.interes.toString(),
        totales.capital.toString(),
        totales.premio.toString(),
        totales.total.toString(),
        ''
      ]);

      // Crear worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Formatos de celdas
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

      // Formato de encabezados
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({r: 2, c: col});
        if (ws[cellAddress]) {
          ws[cellAddress].s = {
            font: {bold: true, color: {rgb: "FFFFFFFF"}},
            fill: {fgColor: {rgb: "FF0072C6"}}
          };
        }
      }

      // Formato de totales
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({r: totalRow, c: col});
        if (ws[cellAddress]) {
          ws[cellAddress].s = {
            font: {bold: true, color: {rgb: "FFFFFFFF"}},
            fill: {fgColor: {rgb: "FF198754"}}
          };
        }
      }

      // Ancho de columnas
      ws['!cols'] = [
        {wch: 15}, // Mes
        {wch: 10}, // Año
        {wch: 12}, // Interés
        {wch: 12}, // Capital
        {wch: 12}, // Premio
        {wch: 12}, // Total
        {wch: 12}  // Mes Actual
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Vencimientos');

      // Hoja de resumen anual
      if (resumen.length > 0) {
        const wsResumenData = [
          ['Resumen Anual'],
          [],
          ['Tipo', 'Interés', 'Capital', 'Premio', 'Total']
        ];

        resumen.forEach((item: ResumenAnual) => {
          wsResumenData.push([
            item.tipo,
            item.interes.toString(),
            item.capital.toString(),
            item.premio.toString(),
            item.total.toString()
          ]);
        });

        const wsResumen = XLSX.utils.aoa_to_sheet(wsResumenData);

        // Formato de encabezados
        for (let col = 0; col <= 4; col++) {
          const cellAddress = XLSX.utils.encode_cell({r: 2, c: col});
          if (wsResumen[cellAddress]) {
            wsResumen[cellAddress].s = {
              font: {bold: true, color: {rgb: "FFFFFFFF"}},
              fill: {fgColor: {rgb: "FF0072C6"}}
            };
          }
        }

        // Formato de filas de datos
        for (let row = 3; row <= 5; row++) {
          for (let col = 0; col <= 4; col++) {
            const cellAddress = XLSX.utils.encode_cell({r: row, c: col});
            if (wsResumen[cellAddress]) {
              const tipo = wsResumenData[row][0];
              if (tipo === 'TOTAL') {
                wsResumen[cellAddress].s = {
                  font: {bold: true, color: {rgb: "FFFFFFFF"}},
                  fill: {fgColor: {rgb: "FF198754"}}
                };
              } else if (tipo === 'EJECUTADO') {
                wsResumen[cellAddress].s = {
                  fill: {fgColor: {rgb: "FFD4ED"}}
                };
              } else if (tipo === 'PENDIENTE') {
                wsResumen[cellAddress].s = {
                  fill: {fgColor: {rgb: "FFF4E6"}}
                };
              }
            }
          }
        }

        wsResumen['!cols'] = [
          {wch: 15}, // Tipo
          {wch: 12}, // Interés
          {wch: 12}, // Capital
          {wch: 12}, // Premio
          {wch: 12}  // Total
        ];

        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
      }

      // Guardar el archivo
      const fechaInicioRaw = this.reporteForm.get('fecha_inicio')?.value;
      const fechaFinRaw = this.reporteForm.get('fecha_fin')?.value;
      const fechaInicio = this.formatDate(fechaInicioRaw);
      const fechaFin = this.formatDate(fechaFinRaw);
      
      const fileName = `vencimientos-mensuales-${fechaInicio}-al-${fechaFin}.xlsx`;
      XLSX.writeFile(wb, fileName);

      this.messageService.add({
        severity: 'success',
        summary: 'Exportación',
        detail: 'Archivo Excel descargado correctamente'
      });

    } catch (error) {
      console.error('Error al generar Excel:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el archivo Excel'
      });
    }
  }

  exportarPDF(): void {
    const fechaInicioRaw = this.reporteForm.get('fecha_inicio')?.value;
    const fechaFinRaw = this.reporteForm.get('fecha_fin')?.value;

    const fechaInicio = this.formatDate(fechaInicioRaw);
    const fechaFin = this.formatDate(fechaFinRaw);

    this.vencimientosService.exportarPDF(fechaInicio, fechaFin).subscribe({
      next: (response) => {
        if (response.success) {
          this.generarPDFFrontend(response.data);
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: response.message || 'No se pudo exportar el archivo PDF'
          });
        }
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

  generarPDFFrontend(datos: any): void {
    try {
      // Crear documento PDF en orientación landscape
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Agregar título
      doc.setFontSize(16);
      doc.text('Reporte de Vencimientos Mensuales', 148, 15, { align: 'center' });

      // Agregar período
      doc.setFontSize(12);
      const fechaInicioRaw = this.reporteForm.get('fecha_inicio')?.value;
      const fechaFinRaw = this.reporteForm.get('fecha_fin')?.value;
      const fechaInicio = this.formatDate(fechaInicioRaw);
      const fechaFin = this.formatDate(fechaFinRaw);
      doc.text(`Período: ${fechaInicio} al ${fechaFin}`, 148, 25, { align: 'center' });

      // Preparar datos para la tabla
      const headers = [
        { title: 'Mes', dataKey: 'nombre_mes' },
        { title: 'Año', dataKey: 'anio' },
        { title: 'Interés', dataKey: 'interes' },
        { title: 'Capital', dataKey: 'capital' },
        { title: 'Premio', dataKey: 'premio' },
        { title: 'Total', dataKey: 'total' },
        { title: 'Mes Actual', dataKey: 'es_mes_actual' }
      ];

      // Datos de la tabla
      const datosReporte = datos.vencimientos || [];
      const tableData = datosReporte.map((item: VencimientoMensual) => ({
        nombre_mes: item.nombre_mes,
        anio: item.anio.toString(),
        interes: this.formatCurrency(item.interes),
        capital: this.formatCurrency(item.capital),
        premio: this.formatCurrency(item.premio),
        total: this.formatCurrency(item.total),
        es_mes_actual: item.es_mes_actual ? 'Sí' : 'No'
      }));

      // Agregar fila de totales
      const totales = datosReporte.reduce((acc: any, item: VencimientoMensual) => ({
        interes: acc.interes + item.interes,
        capital: acc.capital + item.capital,
        premio: acc.premio + item.premio,
        total: acc.total + item.total
      }), { interes: 0, capital: 0, premio: 0, total: 0 });

      tableData.push({
        nombre_mes: 'TOTAL',
        anio: '',
        interes: this.formatCurrency(totales.interes),
        capital: this.formatCurrency(totales.capital),
        premio: this.formatCurrency(totales.premio),
        total: this.formatCurrency(totales.total),
        es_mes_actual: ''
      });

      // Configurar estilos de la tabla
      const tableStyles = {
        headStyles: {
          fillColor: [59, 130, 246] as any,
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold' as any
        },
        bodyStyles: {
          fontSize: 9,
          textColor: 0
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245] as any
        },
        columnStyles: {
          nombre_mes: { cellWidth: 25, halign: 'left' as any },
          anio: { cellWidth: 15, halign: 'center' as any },
          interes: { cellWidth: 25, halign: 'right' as any },
          capital: { cellWidth: 25, halign: 'right' as any },
          premio: { cellWidth: 25, halign: 'right' as any },
          total: { cellWidth: 25, halign: 'right' as any },
          es_mes_actual: { cellWidth: 20, halign: 'center' as any }
        },
        margin: { top: 35, left: 15, right: 15, bottom: 20 },
        styles: {
          overflow: 'linebreak' as any,
          cellPadding: 3
        },
        didParseCell: function(data: any) {
          // Resaltar la fila de totales
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [34, 197, 94] as any;
            data.cell.styles.textColor = 255;
            data.cell.styles.fontStyle = 'bold' as any;
          }

          // Resaltar el mes actual
          if (data.column.dataKey === 'es_mes_actual' && data.cell.raw === 'Sí') {
            data.cell.styles.fillColor = [255, 193, 7] as any;
            data.cell.styles.textColor = 0;
            data.cell.styles.fontStyle = 'bold' as any;
          }
        },
        didDrawCell: function(data: any) {
          // Dibujar bordes para la fila de totales
          if (data.row.index === tableData.length - 1) {
            doc.setDrawColor(34, 197, 94);
            doc.setLineWidth(0.1);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
          }
        }
      };

      // Generar la tabla con autoTable
      autoTable(doc, {
        columns: headers,
        body: tableData,
        ...tableStyles
      });

      // Agregar resumen anual
      const resumen = datos.resumen_anual || [];
      if (resumen.length > 0) {
        const finalY = (doc as any).lastAutoTable.finalY || 200;

        // Título del resumen
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold' as any);
        doc.text('Resumen Anual', 15, finalY + 15);

        // Preparar datos del resumen
        const resumenHeaders = [
          { title: 'Tipo', dataKey: 'tipo' },
          { title: 'Interés', dataKey: 'interes' },
          { title: 'Capital', dataKey: 'capital' },
          { title: 'Premio', dataKey: 'premio' },
          { title: 'Total', dataKey: 'total' }
        ];

        const resumenData = resumen.map((item: ResumenAnual) => ({
          tipo: item.tipo,
          interes: this.formatCurrency(item.interes),
          capital: this.formatCurrency(item.capital),
          premio: this.formatCurrency(item.premio),
          total: this.formatCurrency(item.total)
        }));

        // Estilos para el resumen
        const resumenStyles = {
          headStyles: {
            fillColor: [59, 130, 246] as any,
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold' as any
          },
          bodyStyles: {
            fontSize: 8,
            textColor: 0
          },
          columnStyles: {
            tipo: { cellWidth: 30, halign: 'left' as any },
            interes: { cellWidth: 30, halign: 'right' as any },
            capital: { cellWidth: 30, halign: 'right' as any },
            premio: { cellWidth: 30, halign: 'right' as any },
            total: { cellWidth: 30, halign: 'right' as any }
          },
          margin: { top: finalY + 20, left: 15, right: 15, bottom: 20 },
          styles: {
            overflow: 'linebreak' as any,
            cellPadding: 2
          },
          didParseCell: function(data: any) {
            // Colores según el tipo
            const tipo = data.cell.raw;
            if (tipo === 'TOTAL') {
              data.cell.styles.fillColor = [34, 197, 94] as any;
              data.cell.styles.textColor = 255;
              data.cell.styles.fontStyle = 'bold' as any;
            } else if (tipo === 'EJECUTADO') {
              data.cell.styles.fillColor = [220, 53, 69] as any;
              data.cell.styles.textColor = 255;
              data.cell.styles.fontStyle = 'bold' as any;
            } else if (tipo === 'PENDIENTE') {
              data.cell.styles.fillColor = [255, 193, 7] as any;
              data.cell.styles.textColor = 0;
              data.cell.styles.fontStyle = 'bold' as any;
            }
          }
        };

        // Generar tabla de resumen
        autoTable(doc, {
          columns: resumenHeaders,
          body: resumenData,
          ...resumenStyles
        });
      }

      // Agregar pie de página
      const finalY = (doc as any).lastAutoTable.finalY || 250;
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(`Generado el ${new Date().toLocaleDateString('es-CO')}`, 148, finalY + 10, { align: 'center' });

      // Guardar PDF
      // Las fechas ya fueron declaradas al inicio de la función
      const fileName = `vencimientos-mensuales-${fechaInicio}-al-${fechaFin}.pdf`;
      doc.save(fileName);

      this.messageService.add({
        severity: 'success',
        summary: 'Exportación',
        detail: 'Archivo PDF generado y descargado correctamente'
      });

    } catch (error) {
      console.error('Error al generar PDF:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el archivo PDF'
      });
    }
  }
}
