import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { CatalogoService, CatalogoValor } from '../../../core/catalogo.service';
import { SharesHistoryService, SharesHistoryRecord, ShareDetailRecord } from '../../../core/shares-history.service';
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

// Register the required temporal scales and elements globally in Chart.js
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
  selector: 'app-historico-acciones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropdownModule,
    MultiSelectModule,
    ChartModule,
    TableModule,
    DialogModule
  ],
  templateUrl: './historico-acciones.component.html',
  styleUrls: ['./historico-acciones.component.css']
})
export class HistoricoAccionesComponent implements OnInit {
  // Catalog options
  empresas: any[] = [];
  selectedEmpresa: any = null;

  // Years options
  anos: any[] = [
    { label: 'Todos los años', value: 0 },
    { label: 'Años solapados (Mensual)', value: -1 },
    { label: '2026', value: 2026 },
    { label: '2025', value: 2025 },
    { label: '2024', value: 2024 },
    { label: '2023', value: 2023 },
    { label: '2022', value: 2022 },
    { label: '2021', value: 2021 },
    { label: '2020', value: 2020 },
    { label: '2019', value: 2019 },
    { label: '2018', value: 2018 },
    { label: '2017', value: 2017 }
  ];
  selectedAnio: number = 0;

  anosDisponibles: any[] = [
    { label: '2026', value: 2026 },
    { label: '2025', value: 2025 },
    { label: '2024', value: 2024 },
    { label: '2023', value: 2023 },
    { label: '2022', value: 2022 },
    { label: '2021', value: 2021 },
    { label: '2020', value: 2020 },
    { label: '2019', value: 2019 },
    { label: '2018', value: 2018 },
    { label: '2017', value: 2017 }
  ];
  selectedAniosSolapados: number[] = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];

  // Data lists
  historicoRecords: SharesHistoryRecord[] = [];
  loading = false;
  hasData = false;

  // KPI indicators
  precioPromedio = 0;
  precioMaximo = 0;
  precioMinimo = 0;
  volumenTotal = 0;
  accionesTotales = 0;
  transaccionesTotales = 0;

  // Detalle popup state
  displayDetalleDialog = false;
  detalleTransacciones: ShareDetailRecord[] = [];
  detalleLoading = false;
  selectedDetalleFecha = '';
  selectedDetalleEmisor = '';
  
  // Totales del popup
  detalleTotalCantidad = 0;
  detalleTotalValorEfectivo = 0;
  detallePrecioPonderado = 0;

  // Table options (cached in localStorage)
  rowsPerPage = 10;
  sortField = '';
  sortOrder = 1;

  // Dual-Axis Chart config
  chartData: any = null;
  chartOptions: any = null;
  chartPlugins: any[] = [];
  hasPrepended = false;
  startOfYearIndices: { year: string; index: number }[] = [];
  startOfMonthIndices: { label: string; index: number }[] = [];

  constructor(
    private catalogoService: CatalogoService,
    private sharesHistoryService: SharesHistoryService,
    private cdr: ChangeDetectorRef
  ) {
    this.setupChartOptions();
    this.initializePlugins();
  }

  ngOnInit(): void {
    this.loadCachedTableState();
    this.loadEmpresas();
  }

  initializePlugins(): void {
    this.chartPlugins = [
      {
        id: 'verticalYearLines',
        beforeDatasetsDraw: (chart: any) => {
          const ctx = chart.ctx;
          const xScale = chart.scales.x;
          const yScale = chart.scales.y;
          
          if (!xScale || !yScale) return;
          
          const minYear = new Date(xScale.min).getFullYear();
          const maxYear = new Date(xScale.max).getFullYear();
          
          ctx.save();
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)'; // Yellow color matching previous design
          ctx.lineWidth = 1.5;
          
          if (Number(this.selectedAnio) === 0) {
            // Draw a line at the start of each year (01/01/year)
            for (let year = minYear; year <= maxYear + 1; year++) {
              // Normalizar a inicio de año en hora local
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
            // Draw a line at the start of each month
            const year = Number(this.selectedAnio) === -1 ? 2000 : Number(this.selectedAnio);
            for (let month = 0; month < 12; month++) {
              // Normalizar a inicio de mes en hora local
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

          // Draw the closing vertical line at the end of the period (e.g. 31/12/2026 or 31/12 of the selected year)
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

  loadEmpresas(): void {
    this.loading = true;
    this.catalogoService.getValoresByCodigo('EMIACC').subscribe({
      next: (response: any) => {
        const valores = response.data || response || [];
        this.empresas = valores.map((val: CatalogoValor) => ({
          label: val.nombre,
          value: val.id_catalogo_valor,
          codigo: val.codigo
        })).sort((a: any, b: any) => a.label.localeCompare(b.label));

        // Seleccionar por defecto Corporacion La Favorita (id_catalogo_valor = 16) si existe
        const favorita = this.empresas.find(emp => emp.value === 16);
        if (favorita) {
          this.selectedEmpresa = favorita.value;
        } else if (this.empresas.length > 0) {
          this.selectedEmpresa = this.empresas[0].value;
        }

        this.loading = false;
        if (this.selectedEmpresa) {
          this.loadHistorico();
        }
      },
      error: (err) => {
        console.error('Error al cargar emisores de acciones:', err);
        this.loading = false;
      }
    });
  }

  loadHistorico(): void {
    if (!this.selectedEmpresa) return;

    this.loading = true;
    const yearQuery = Number(this.selectedAnio) === -1 ? 0 : this.selectedAnio;
    this.sharesHistoryService.getHistorico(this.selectedEmpresa, yearQuery).subscribe({
      next: (response) => {
        this.historicoRecords = response.data || [];
        this.hasData = this.historicoRecords.length > 0;
        
        this.calculateMetrics();
        this.buildChart();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar historial de acciones:', err);
        this.historicoRecords = [];
        this.hasData = false;
        this.calculateMetrics();
        this.buildChart();
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFiltersChange(): void {
    this.loadHistorico();
  }

  calculateMetrics(): void {
    if (this.historicoRecords.length === 0) {
      this.precioPromedio = 0;
      this.precioMaximo = 0;
      this.precioMinimo = 0;
      this.volumenTotal = 0;
      this.accionesTotales = 0;
      this.transaccionesTotales = 0;
      return;
    }

    let sumaPrecios = 0;
    let maxPrecio = -Infinity;
    let minPrecio = Infinity;
    let totalVol = 0;
    let totalAcciones = 0;
    let totalTrans = 0;

    this.historicoRecords.forEach(rec => {
      const precio = typeof rec.precio === 'string' ? parseFloat(rec.precio) : (rec.precio || 0);
      const valor = typeof rec.valor === 'string' ? parseFloat(rec.valor) : (rec.valor || 0);
      const cantidad = typeof rec.cantidad === 'string' ? parseFloat(rec.cantidad) : (rec.cantidad || 0);
      const transacciones = typeof rec.transacciones === 'string' ? parseInt(rec.transacciones, 10) : (rec.transacciones || 0);

      sumaPrecios += precio;
      if (precio > maxPrecio) maxPrecio = precio;
      if (precio < minPrecio) minPrecio = precio;
      
      totalVol += valor;
      totalAcciones += cantidad;
      totalTrans += transacciones;
    });

    this.precioPromedio = sumaPrecios / this.historicoRecords.length;
    this.precioMaximo = maxPrecio;
    this.precioMinimo = minPrecio;
    this.volumenTotal = totalVol;
    this.accionesTotales = totalAcciones;
    this.transaccionesTotales = totalTrans;
  }

  generateColors(count: number): string[] {
    const colors = [
      '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    return result;
  }

  buildChart(): void {
    if (!this.hasData) {
      this.chartData = null;
      return;
    }

    // Re-initialize chart options to dynamically apply selected year settings (min/max range)
    this.setupChartOptions();

    this.hasPrepended = false;

    if (Number(this.selectedAnio) === -1) {
      // Lógica de gráfico solapado
      const groupedByYear: { [year: string]: any[] } = {};
      this.historicoRecords.forEach(rec => {
        const parts = rec.fecha.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        
        // Mapear al año pivote (2000)
        const x = new Date(2000, m, d);
        const price = typeof rec.precio === 'string' ? parseFloat(rec.precio) : (rec.precio || 0);
        const recordYear = y.toString();
        
        if (!groupedByYear[recordYear]) {
          groupedByYear[recordYear] = [];
        }
        groupedByYear[recordYear].push({ x, y: price, originalYear: recordYear });
      });

      const years = Object.keys(groupedByYear).sort((a, b) => Number(a) - Number(b));
      const datasets: any[] = [];
      
      // Solo mantener los años que estén seleccionados en el multiselect
      const filteredYears = years.filter(year => this.selectedAniosSolapados.includes(Number(year)));
      const colors = this.generateColors(filteredYears.length);

      filteredYears.forEach((year, index) => {
        datasets.push({
          type: 'line',
          label: `Precio (${year})`,
          data: groupedByYear[year],
          yAxisID: 'y',
          borderColor: colors[index],
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 6,
          tension: 0.2,
          fill: false
        });
      });

      this.chartData = { datasets };
    } else {
      // Lógica estándar de línea de tiempo
      const prices = this.historicoRecords.map(rec => {
        const parts = rec.fecha.split('-');
        const x = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const y = typeof rec.precio === 'string' ? parseFloat(rec.precio) : (rec.precio || 0);
        return { x, y };
      });

      const volumes = this.historicoRecords.map(rec => {
        const parts = rec.fecha.split('-');
        const x = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const y = typeof rec.valor === 'string' ? parseFloat(rec.valor) : (rec.valor || 0);
        return { x, y };
      });

      this.chartData = {
        datasets: [
          {
            type: 'line',
            label: 'Precio Promedio ($)',
            data: prices,
            yAxisID: 'y',
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            borderWidth: 1.5,
            pointRadius: this.historicoRecords.length > 180 ? 0 : 2,
            pointHoverRadius: 6,
            tension: 0.2,
            fill: true
          },
          {
            type: 'bar',
            label: 'Volumen Transado ($)',
            data: volumes,
            yAxisID: 'y1',
            backgroundColor: 'rgba(34, 197, 94, 0.35)',
            borderColor: 'rgba(34, 197, 94, 0.7)',
            borderWidth: 1,
            barThickness: Number(this.selectedAnio) === 0 ? 1.5 : 3
          }
        ]
      };
    }
  }

  setupChartOptions(): void {
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      layout: {
        padding: {
          top: 0,
          bottom: 0,
          left: 5,
          right: 5
        }
      },
      plugins: {
        datalabels: {
          display: false
        },
        legend: {
          position: 'top',
          labels: {
            color: '#495057',
            font: {
              size: 11,
              weight: '600'
            },
            boxWidth: 12,
            padding: 6,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(33, 37, 41, 0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          footerColor: '#22c55e',
          padding: 12,
          cornerRadius: 6,
          callbacks: {
            title: (tooltipItems: any[]) => {
              if (tooltipItems.length > 0) {
                const dateVal = new Date(tooltipItems[0].raw.x);
                const nombreEmpresa = this.empresas.find(e => e.value === this.selectedEmpresa)?.label || '';
                
                let titleYear = '';
                if (Number(this.selectedAnio) === -1) {
                  titleYear = tooltipItems[0].raw.originalYear || dateVal.getFullYear().toString();
                } else {
                  titleYear = dateVal.getFullYear().toString();
                }
                
                const month = String(dateVal.getMonth() + 1).padStart(2, '0');
                const day = String(dateVal.getDate()).padStart(2, '0');
                return [
                  `Emisor: ${nombreEmpresa}`,
                  `Fecha: ${day}/${month}/${titleYear}`
                ];
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
                const index = tooltipItems[0].dataIndex;
                const record = this.historicoRecords[index];
                if (!record) return '';
                return [
                  `Acciones: ${this.formatInteger(record.cantidad)}`,
                  `Transacciones: ${this.formatInteger(record.transacciones)}`
                ].join('\n');
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
            date: {
              locale: es
            }
          },
          time: {
            unit: Number(this.selectedAnio) === 0 ? 'year' : 'month',
            tooltipFormat: 'yyyy-MM-dd',
            displayFormats: {
              year: 'yyyy',
              month: 'MMM yyyy'
            }
          },
          offset: false,
          bounds: 'ticks',
          grid: {
            display: true,
            drawOnChartArea: false,
            drawTicks: true,
            color: '#e2e8f0'
          },
          ticks: {
            color: '#6c757d',
            font: {
              size: 10,
              weight: '600'
            },
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
            : (Number(this.selectedAnio) === -1 ? new Date(2000, 0, 1).getTime() : new Date(Number(this.selectedAnio), 0, 1).getTime()),
          max: Number(this.selectedAnio) === 0
            ? new Date(2026, 11, 31, 23, 59, 59).getTime()
            : (Number(this.selectedAnio) === -1 ? new Date(2000, 11, 31, 23, 59, 59).getTime() : new Date(Number(this.selectedAnio), 11, 31, 23, 59, 59).getTime())
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: false,
          title: {
            display: true,
            text: 'Precio ($)',
            color: '#495057',
            font: {
              size: 10,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#6c757d',
            font: {
              size: 9
            },
            callback: (val: any) => '$' + Number(val).toFixed(2)
          },
          grid: {
            color: '#f1f3f5'
          }
        },
        y1: {
          type: 'linear',
          display: Number(this.selectedAnio) !== -1,
          position: 'right',
          title: {
            display: true,
            text: 'Volumen ($)',
            color: '#495057',
            font: {
              size: 10,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#6c757d',
            font: {
              size: 9
            },
            callback: (val: any) => {
              if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'k';
              return '$' + val;
            }
          },
          grid: {
            drawOnChartArea: false
          }
        }
      }
    };
  }

  exportarExcel(): void {
    if (this.historicoRecords.length === 0) return;

    const nombreEmpresa = this.empresas.find(e => e.value === this.selectedEmpresa)?.label || 'Empresa';
    const anioTexto = Number(this.selectedAnio) === 0 ? 'Todos' : this.selectedAnio.toString();
    const fileName = `Historial_Acciones_${nombreEmpresa.replace(/\s+/g, '_')}_${anioTexto}.xlsx`;

    const dataExcel = this.historicoRecords.map(rec => ({
      'Fecha': rec.fecha,
      'Emisor': rec.emisor,
      'Cantidad': typeof rec.cantidad === 'string' ? parseFloat(rec.cantidad) : rec.cantidad,
      'Valor ($)': typeof rec.valor === 'string' ? parseFloat(rec.valor) : rec.valor,
      'Precio ($)': typeof rec.precio === 'string' ? parseFloat(rec.precio) : rec.precio,
      'Transacciones': typeof rec.transacciones === 'string' ? parseInt(rec.transacciones, 10) : rec.transacciones
    }));

    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial');

    // Auto-fit Columns
    ws['!cols'] = [
      { wch: 12 }, // Fecha
      { wch: 30 }, // Emisor
      { wch: 15 }, // Cantidad
      { wch: 18 }, // Valor
      { wch: 15 }, // Precio
      { wch: 15 }  // Transacciones
    ];

    // Format number cells in Excel
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      // Cantidad (col index 2)
      const cantCell = XLSX.utils.encode_cell({ r: row, c: 2 });
      if (ws[cantCell]) ws[cantCell].z = '#,##0';

      // Valor (col index 3)
      const valCell = XLSX.utils.encode_cell({ r: row, c: 3 });
      if (ws[valCell]) ws[valCell].z = '#,##0.00';

      // Precio (col index 4)
      const precioCell = XLSX.utils.encode_cell({ r: row, c: 4 });
      if (ws[precioCell]) ws[precioCell].z = '#,##0.00';

      // Transacciones (col index 5)
      const transCell = XLSX.utils.encode_cell({ r: row, c: 5 });
      if (ws[transCell]) ws[transCell].z = '#,##0';
    }

    XLSX.writeFile(wb, fileName);
  }

  // Helper formatting methods for display
  formatCurrency(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return '$0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }

  formatInteger(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return '0';
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  }

  // Caching helper methods for table state persistence
  loadCachedTableState(): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const cachedRows = localStorage.getItem('historico_acciones_rows');
      if (cachedRows) {
        this.rowsPerPage = parseInt(cachedRows, 10);
      }
      const cachedSortField = localStorage.getItem('historico_acciones_sortField');
      if (cachedSortField) {
        this.sortField = cachedSortField;
      }
      const cachedSortOrder = localStorage.getItem('historico_acciones_sortOrder');
      if (cachedSortOrder) {
        this.sortOrder = parseInt(cachedSortOrder, 10);
      }
    }
  }

  onSort(event: any): void {
    if (event.field) {
      this.sortField = event.field;
      this.sortOrder = event.order;
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('historico_acciones_sortField', this.sortField);
        localStorage.setItem('historico_acciones_sortOrder', this.sortOrder.toString());
      }
    }
  }

  onPage(event: any): void {
    if (event.rows) {
      this.rowsPerPage = event.rows;
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('historico_acciones_rows', this.rowsPerPage.toString());
      }
    }
  }

  onRowSelect(event: any): void {
    const record = event.data as SharesHistoryRecord;
    if (!this.selectedEmpresa || !record.fecha) return;

    // Use string manipulation to re-format date from DD/MM/YYYY back to YYYY-MM-DD for the API
    let apiDate = record.fecha;
    if (apiDate.includes('/')) {
      const parts = apiDate.split('/');
      if (parts.length === 3) {
        apiDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    this.selectedDetalleFecha = record.fecha;
    this.selectedDetalleEmisor = record.emisor;
    this.displayDetalleDialog = true;
    this.detalleLoading = true;
    this.detalleTransacciones = [];
    this.detalleTotalCantidad = 0;
    this.detalleTotalValorEfectivo = 0;
    this.detallePrecioPonderado = 0;

    this.sharesHistoryService.getDetallesDiarios(this.selectedEmpresa, apiDate).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.detalleTransacciones = response.data;
          
          // Calcular totales
          this.detalleTotalCantidad = this.detalleTransacciones.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
          this.detalleTotalValorEfectivo = this.detalleTransacciones.reduce((sum, item) => sum + (Number(item.valor_efectivo) || 0), 0);
          
          if (this.detalleTotalCantidad > 0) {
            this.detallePrecioPonderado = this.detalleTotalValorEfectivo / this.detalleTotalCantidad;
          }
        }
        this.detalleLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar el detalle diario:', err);
        this.detalleLoading = false;
      }
    });
  }
}
