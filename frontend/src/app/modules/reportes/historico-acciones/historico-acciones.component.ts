import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { CatalogoService, CatalogoValor } from '../../../core/catalogo.service';
import { SharesHistoryService, SharesHistoryRecord } from '../../../core/shares-history.service';
import * as XLSX from 'xlsx';
import 'chartjs-adapter-date-fns';
import { es } from 'date-fns/locale';
import { Chart, TimeScale, TimeSeriesScale } from 'chart.js';

// Register the required temporal scales globally in Chart.js
Chart.register(TimeScale, TimeSeriesScale);

@Component({
  selector: 'app-historico-acciones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropdownModule,
    ChartModule,
    TableModule
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
    this.loadEmpresas();
  }

  initializePlugins(): void {
    this.chartPlugins = [];
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
    this.sharesHistoryService.getHistorico(this.selectedEmpresa, this.selectedAnio).subscribe({
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

  buildChart(): void {
    if (!this.hasData) {
      this.chartData = null;
      return;
    }

    // Re-initialize chart options to dynamically apply selected year settings (min/max range)
    this.setupChartOptions();

    const prices = this.historicoRecords.map(rec => {
      const x = new Date(rec.fecha + 'T00:00:00').getTime();
      const y = typeof rec.precio === 'string' ? parseFloat(rec.precio) : (rec.precio || 0);
      return { x, y };
    });

    const volumes = this.historicoRecords.map(rec => {
      const x = new Date(rec.fecha + 'T00:00:00').getTime();
      const y = typeof rec.valor === 'string' ? parseFloat(rec.valor) : (rec.valor || 0);
      return { x, y };
    });

    this.hasPrepended = false;

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
                const index = tooltipItems[0].dataIndex;
                const record = this.historicoRecords[index];
                if (!record) return '';
                return [
                  `Emisor: ${record.emisor || ''}`,
                  `Fecha: ${record.fecha}`
                ];
              }
              return '';
            },
            label: (context: any) => {
              const datasetLabel = context.dataset.label || '';
              const rawVal = context.raw;
              const value = typeof rawVal === 'object' && rawVal !== null ? rawVal.y : rawVal;
              if (datasetLabel.includes('Precio')) {
                return ` Precio Promedio: ${this.formatCurrency(value)}`;
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
          grid: {
            display: true,
            drawTicks: false,
            color: () => 'rgba(234, 179, 8, 0.6)'
          },
          ticks: {
            color: '#6c757d',
            font: {
              size: 10,
              weight: '600'
            },
            autoSkip: false,
            callback: (value: any) => {
              const d = new Date(value);
              if (Number(this.selectedAnio) === 0) {
                if (d.getMonth() === 0 && d.getDate() === 1) {
                  return d.getFullYear().toString();
                }
                return '';
              } else {
                const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                if (d.getDate() === 1) {
                  return `${monthNames[d.getMonth()]} ${this.selectedAnio}`;
                }
                return '';
              }
            }
          },
          afterBuildTicks: (scale: any) => {
            const tickDates: Date[] = [];
            if (Number(this.selectedAnio) === 0) {
              for (let y = 2017; y <= 2026; y++) {
                tickDates.push(new Date(y, 0, 1));
              }
              tickDates.push(new Date(2026, 11, 31, 23, 59, 59));
            } else {
              const y = Number(this.selectedAnio);
              for (let m = 0; m < 12; m++) {
                tickDates.push(new Date(y, m, 1));
              }
              tickDates.push(new Date(y, 11, 31, 23, 59, 59));
            }
            scale.ticks = tickDates.map(d => ({
              value: d.getTime()
            }));
          },
          min: Number(this.selectedAnio) === 0
            ? new Date('2017-01-01T00:00:00').getTime()
            : new Date(`${this.selectedAnio}-01-01T00:00:00`).getTime(),
          max: Number(this.selectedAnio) === 0
            ? new Date('2026-12-31T23:59:59').getTime()
            : new Date(`${this.selectedAnio}-12-31T23:59:59`).getTime()
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
          display: true,
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
}
