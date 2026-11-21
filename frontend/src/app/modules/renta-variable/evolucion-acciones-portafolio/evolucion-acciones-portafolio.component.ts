import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { 
  SharesHistoryService, 
  PortfolioShareItem, 
  ShareDetailRecord, 
  SharesHistoryRecord 
} from '../../../core/shares-history.service';
import * as XLSX from 'xlsx';
import 'chartjs-adapter-date-fns';
import { es } from 'date-fns/locale';
import { 
  Chart, 
  TimeScale, 
  TimeSeriesScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  LineController, 
  BarController, 
  Tooltip, 
  Legend 
} from 'chart.js';

Chart.register(
  TimeScale, 
  TimeSeriesScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  LineController, 
  BarController, 
  Tooltip, 
  Legend
);

@Component({
  selector: 'app-evolucion-acciones-portafolio',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropdownModule,
    MultiSelectModule,
    ChartModule,
    TableModule,
    DialogModule,
    TooltipModule,
    InputTextModule,
    ButtonModule
  ],
  templateUrl: './evolucion-acciones-portafolio.component.html',
  styleUrls: ['./evolucion-acciones-portafolio.component.css']
})
export class EvolucionAccionesPortafolioComponent implements OnInit {
  // Datos
  emisores: PortfolioShareItem[] = [];
  filteredEmisores: PortfolioShareItem[] = [];
  loading = false;
  error: string | null = null;

  // Filtros
  anos: any[] = [
    { label: 'Año 2026', value: 2026 },
    { label: 'Año 2025', value: 2025 },
    { label: 'Año 2024', value: 2024 },
    { label: 'Año 2023', value: 2023 },
    { label: 'Año 2022', value: 2022 },
    { label: 'Año 2021', value: 2021 },
    { label: 'Año 2020', value: 2020 },
    { label: 'Histórico Completo (Todos los años)', value: 0 }
  ];
  selectedAnio: number = 2026;
  searchFilter: string = '';

  // Modo de visualización: columnas del grid (1, 2 o 3)
  gridColumns: number = 2;

  // Totales Globales del Portafolio
  totalAccionesGlobal: number = 0;
  totalValorMercadoGlobal: number = 0;
  totalCapitalInvertidoGlobal: number = 0;
  totalPlusvaliaGlobal: number = 0;
  porcentajePlusvaliaGlobal: number = 0;

  // Plugins para líneas divisorias de meses/años
  chartPlugins: any[] = [];

  // Modal de Detalle Diario
  displayDetalleDialog = false;
  detalleTransacciones: ShareDetailRecord[] = [];
  detalleLoading = false;
  selectedDetalleFecha = '';
  selectedDetalleEmisor = '';
  detalleTotalCantidad = 0;
  detalleTotalValorEfectivo = 0;
  detallePrecioPonderado = 0;

  constructor(
    private sharesService: SharesHistoryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializePlugins();
    this.loadData();
  }

  initializePlugins(): void {
    this.chartPlugins = [
      {
        id: 'portfolioVerticalYearLines',
        beforeDatasetsDraw: (chart: any) => {
          const ctx = chart.ctx;
          const xScale = chart.scales.x;
          const yScale = chart.scales.y;
          
          if (!xScale || !yScale) return;
          
          const minYear = new Date(xScale.min).getFullYear();
          const maxYear = new Date(xScale.max).getFullYear();
          
          ctx.save();
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.65)'; // Líneas amarillas divisorias de meses
          ctx.lineWidth = 1.5;
          
          if (Number(this.selectedAnio) === 0) {
            // Línea al inicio de cada año
            for (let year = minYear; year <= maxYear + 1; year++) {
              const dateVal = new Date(year, 0, 1).getTime();
              if (dateVal >= xScale.min && dateVal <= xScale.max) {
                const xPos = xScale.getPixelForValue(dateVal);
                ctx.beginPath();
                ctx.moveTo(xPos, yScale.top);
                ctx.lineTo(xPos, yScale.bottom);
                ctx.stroke();
              }
            }
          } else {
            // Línea al inicio de cada mes
            const year = Number(this.selectedAnio);
            for (let month = 0; month < 12; month++) {
              const dateVal = new Date(year, month, 1).getTime();
              if (dateVal >= xScale.min && dateVal <= xScale.max) {
                const xPos = xScale.getPixelForValue(dateVal);
                ctx.beginPath();
                ctx.moveTo(xPos, yScale.top);
                ctx.lineTo(xPos, yScale.bottom);
                ctx.stroke();
              }
            }
          }

          // Línea de cierre al final del periodo
          const closingVal = xScale.max;
          if (closingVal >= xScale.min) {
            const xPos = xScale.getPixelForValue(closingVal);
            ctx.beginPath();
            ctx.moveTo(xPos, yScale.top);
            ctx.lineTo(xPos, yScale.bottom);
            ctx.stroke();
          }

          ctx.restore();
        }
      }
    ];
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    this.sharesService.getHistoricoPortafolio(this.selectedAnio).subscribe({
      next: (response: any) => {
        this.loading = false;
        if (response && response.success && response.data) {
          this.emisores = response.data;
          this.calculateGlobalTotals();
          this.setupChartsForAllEmisores();
          this.applyFilter();
        } else {
          this.emisores = [];
          this.filteredEmisores = [];
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        this.error = 'No se pudieron cargar los datos de evolución de los emisores del portafolio.';
        console.error('Error al cargar evolución de portafolio:', err);
        this.cdr.detectChanges();
      }
    });
  }

  calculateGlobalTotals(): void {
    this.totalAccionesGlobal = this.emisores.reduce((sum, e) => sum + (e.cantidad_acciones || 0), 0);
    this.totalValorMercadoGlobal = this.emisores.reduce((sum, e) => sum + (e.valor_mercado || 0), 0);
    this.totalCapitalInvertidoGlobal = this.emisores.reduce((sum, e) => sum + (e.capital_invertido || 0), 0);
    this.totalPlusvaliaGlobal = this.totalValorMercadoGlobal - this.totalCapitalInvertidoGlobal;
    this.porcentajePlusvaliaGlobal = this.totalCapitalInvertidoGlobal > 0 
      ? (this.totalPlusvaliaGlobal / this.totalCapitalInvertidoGlobal) * 100 
      : 0;
  }

  setupChartsForAllEmisores(): void {
    this.emisores.forEach(emisor => {
      this.buildChartForEmisor(emisor);
    });
  }

  buildChartForEmisor(emisor: PortfolioShareItem): void {
    const records = emisor.historico || [];
    const recordsAsc = [...records].sort((a, b) => a.fecha.localeCompare(b.fecha));

    const prices = recordsAsc.map(rec => {
      const parts = rec.fecha.split('-');
      const x = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const y = typeof rec.precio === 'string' ? parseFloat(rec.precio) : (rec.precio || 0);
      const cantidad = typeof rec.cantidad === 'string' ? parseFloat(rec.cantidad) : (rec.cantidad || 0);
      const transacciones = typeof rec.transacciones === 'string' ? parseInt(rec.transacciones, 10) : (rec.transacciones || 0);
      return { 
        x, 
        y, 
        fecha: rec.fecha,
        cantidad, 
        transacciones 
      };
    });

    const volumes = recordsAsc.map(rec => {
      const parts = rec.fecha.split('-');
      const x = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const y = typeof rec.valor === 'string' ? parseFloat(rec.valor) : (rec.valor || 0);
      const cantidad = typeof rec.cantidad === 'string' ? parseFloat(rec.cantidad) : (rec.cantidad || 0);
      const transacciones = typeof rec.transacciones === 'string' ? parseInt(rec.transacciones, 10) : (rec.transacciones || 0);
      return { 
        x, 
        y, 
        fecha: rec.fecha,
        cantidad, 
        transacciones 
      };
    });

    emisor.chartData = {
      datasets: [
        {
          type: 'line',
          label: 'Precio Promedio ($)',
          data: prices,
          yAxisID: 'y',
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          borderWidth: 1.8,
          pointRadius: recordsAsc.length > 150 ? 0 : 2,
          pointHoverRadius: 6,
          tension: 0.2,
          fill: true
        },
        {
          type: 'bar',
          label: 'Volumen Transado ($)',
          data: volumes,
          yAxisID: 'y1',
          backgroundColor: 'rgba(34, 197, 94, 0.45)',
          borderColor: 'rgba(34, 197, 94, 0.85)',
          borderWidth: 1,
          barThickness: Number(this.selectedAnio) === 0 ? 1.5 : 3.5
        }
      ]
    };

    emisor.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      layout: {
        padding: { top: 5, bottom: 0, left: 5, right: 5 }
      },
      plugins: {
        datalabels: { display: false },
        legend: {
          position: 'top',
          labels: {
            color: '#334155',
            font: { size: 10, weight: '600' },
            boxWidth: 10,
            padding: 8,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          footerColor: '#4ade80',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            title: (tooltipItems: any[]) => {
              if (tooltipItems.length > 0) {
                const raw = tooltipItems[0].raw;
                if (raw && raw.fecha) {
                  const parts = raw.fecha.split('-');
                  if (parts.length === 3) {
                    return [
                      `Emisor: ${emisor.emisor_nombre}`,
                      `Fecha: ${parts[2]}/${parts[1]}/${parts[0]}`
                    ];
                  }
                }
              }
              return '';
            },
            label: (context: any) => {
              const datasetLabel = context.dataset.label || '';
              const rawVal = context.raw;
              const value = typeof rawVal === 'object' && rawVal !== null ? rawVal.y : rawVal;
              if (datasetLabel.includes('Precio')) {
                return ` ${datasetLabel}: ${this.formatCurrency(value)}`;
              } else {
                return ` Volumen Transado: ${this.formatCurrency(value)}`;
              }
            },
            footer: (tooltipItems: any[]) => {
              if (tooltipItems.length > 0) {
                const raw = tooltipItems[0].raw;
                if (raw && (raw.cantidad !== undefined || raw.transacciones !== undefined)) {
                  return [
                    `Acciones: ${this.formatInteger(raw.cantidad || 0)}`,
                    `Transacciones: ${this.formatInteger(raw.transacciones || 0)}`
                  ].join('\n');
                }
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          adapters: {
            date: { locale: es }
          },
          time: {
            unit: Number(this.selectedAnio) === 0 ? 'year' : 'month',
            tooltipFormat: 'yyyy-MM-dd',
            displayFormats: {
              year: 'yyyy',
              month: 'MMM'
            }
          },
          offset: false,
          bounds: 'ticks',
          grid: {
            display: true,
            drawOnChartArea: false,
            drawTicks: true,
            color: '#cbd5e1'
          },
          ticks: {
            color: '#64748b',
            font: { size: 9, weight: '600' },
            autoSkip: false,
            callback: (value: any, index: number, ticks: any[]) => {
              if (!ticks || !ticks[index]) return '';
              const d = new Date(ticks[index].value);
              if (Number(this.selectedAnio) === 0) {
                return d.getFullYear().toString();
              } else {
                const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                return monthNames[d.getMonth()];
              }
            }
          },
          min: Number(this.selectedAnio) === 0
            ? new Date(2017, 0, 1).getTime()
            : new Date(Number(this.selectedAnio), 0, 1).getTime(),
          max: Number(this.selectedAnio) === 0
            ? new Date(2026, 11, 31, 23, 59, 59).getTime()
            : new Date(Number(this.selectedAnio), 11, 31, 23, 59, 59).getTime()
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: false,
          title: {
            display: true,
            text: 'Precio ($)',
            color: '#334155',
            font: { size: 9, weight: 'bold' }
          },
          ticks: {
            color: '#64748b',
            font: { size: 9 },
            callback: (val: any) => '$' + Number(val).toFixed(2)
          },
          grid: { color: '#f1f5f9' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Volumen ($)',
            color: '#334155',
            font: { size: 9, weight: 'bold' }
          },
          ticks: {
            color: '#64748b',
            font: { size: 9 },
            callback: (val: any) => {
              if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'k';
              return '$' + val;
            }
          },
          grid: { drawOnChartArea: false }
        }
      }
    };
  }

  applyFilter(): void {
    if (!this.searchFilter.trim()) {
      this.filteredEmisores = [...this.emisores];
    } else {
      const q = this.searchFilter.toLowerCase().trim();
      this.filteredEmisores = this.emisores.filter(e => 
        e.emisor_nombre.toLowerCase().includes(q) ||
        (e.socios && e.socios.some(s => s.persona.toLowerCase().includes(q)))
      );
    }
  }

  onAnioChange(): void {
    this.loadData();
  }

  setGridColumns(cols: number): void {
    this.gridColumns = cols;
  }

  getChartHeight(): string {
    if (this.gridColumns === 1) return '450px';
    if (this.gridColumns === 2) return '350px';
    return '290px';
  }

  verDetallesDiarios(emisor: PortfolioShareItem, fecha: string): void {
    if (!emisor.id_emisor_legacy || !fecha) return;

    this.selectedDetalleEmisor = emisor.emisor_nombre;
    this.selectedDetalleFecha = fecha;
    this.detalleLoading = true;
    this.displayDetalleDialog = true;

    this.sharesService.getDetallesDiarios(emisor.id_emisor_legacy, fecha).subscribe({
      next: (response: any) => {
        this.detalleLoading = false;
        if (response && response.success) {
          this.detalleTransacciones = response.data || [];
          this.calcularTotalesPopup();
        } else {
          this.detalleTransacciones = [];
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.detalleLoading = false;
        console.error('Error al cargar detalle de transacciones:', err);
        this.cdr.detectChanges();
      }
    });
  }

  private calcularTotalesPopup(): void {
    this.detalleTotalCantidad = this.detalleTransacciones.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
    this.detalleTotalValorEfectivo = this.detalleTransacciones.reduce((sum, item) => sum + (Number(item.valor_efectivo) || 0), 0);
    this.detallePrecioPonderado = this.detalleTotalCantidad > 0 
      ? this.detalleTotalValorEfectivo / this.detalleTotalCantidad 
      : 0;
  }

  exportarExcelEmisor(emisor: PortfolioShareItem): void {
    const dataToExport = (emisor.historico || []).map(item => ({
      Fecha: item.fecha,
      Emisor: emisor.emisor_nombre,
      'Precio ($)': typeof item.precio === 'string' ? parseFloat(item.precio) : item.precio,
      'Volumen ($)': typeof item.valor === 'string' ? parseFloat(item.valor) : item.valor,
      'Acciones Negociadas': typeof item.cantidad === 'string' ? parseFloat(item.cantidad) : item.cantidad,
      Transacciones: typeof item.transacciones === 'string' ? parseInt(item.transacciones, 10) : item.transacciones
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Historico');
    XLSX.writeFile(workbook, `Historico_${emisor.emisor_nombre.replace(/\s+/g, '_')}_${this.selectedAnio}.xlsx`);
  }

  exportarTodoExcel(): void {
    const workbook = XLSX.utils.book_new();

    this.emisores.forEach(emisor => {
      const dataToExport = (emisor.historico || []).map(item => ({
        Fecha: item.fecha,
        'Precio ($)': typeof item.precio === 'string' ? parseFloat(item.precio) : item.precio,
        'Volumen ($)': typeof item.valor === 'string' ? parseFloat(item.valor) : item.valor,
        'Acciones Negociadas': typeof item.cantidad === 'string' ? parseFloat(item.cantidad) : item.cantidad,
        Transacciones: typeof item.transacciones === 'string' ? parseInt(item.transacciones, 10) : item.transacciones
      }));

      const sheetName = emisor.emisor_nombre.substring(0, 31).replace(/[\\/?*[\]]/g, '');
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    XLSX.writeFile(workbook, `Evolucion_Portafolio_Acciones_${this.selectedAnio}.xlsx`);
  }

  formatCurrency(val: any): string {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  }

  formatInteger(val: any): string {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  }

  formatNumber(val: any, decimals: number = 2): string {
    const num = Number(val) || 0;
    return num.toFixed(decimals);
  }
}
