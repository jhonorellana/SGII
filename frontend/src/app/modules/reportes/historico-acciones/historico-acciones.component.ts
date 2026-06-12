import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { CatalogoService, CatalogoValor } from '../../../core/catalogo.service';
import { SharesHistoryService, SharesHistoryRecord } from '../../../core/shares-history.service';
import * as XLSX from 'xlsx';

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

  getDecimalMonthsSinceBase(dateStr: string): number {
    if (!dateStr) return 0;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return 0;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10); // 1-12
    const day = parseInt(parts[2], 10);
    
    if (Number(this.selectedAnio) === 0) {
      const yearsDiff = year - 2017;
      const monthsDiff = yearsDiff * 12 + (month - 1);
      const daysInMonth = new Date(year, month, 0).getDate();
      const dayFraction = (day - 1) / daysInMonth;
      return monthsDiff + dayFraction;
    } else {
      const monthsDiff = month - 1;
      const daysInMonth = new Date(year, month, 0).getDate();
      const dayFraction = (day - 1) / daysInMonth;
      return monthsDiff + dayFraction;
    }
  }

  buildChart(): void {
    if (!this.hasData) {
      this.chartData = null;
      return;
    }

    // Re-initialize chart options to dynamically apply selected year settings (min/max range)
    this.setupChartOptions();

    const firstRec = this.historicoRecords[0];
    const initialPrice = typeof firstRec.precio === 'string' ? parseFloat(firstRec.precio) : (firstRec.precio || 0);

    const firstX = this.getDecimalMonthsSinceBase(firstRec.fecha);
    this.hasPrepended = firstX > 0;

    const prices = this.historicoRecords.map(rec => {
      const x = this.getDecimalMonthsSinceBase(rec.fecha);
      const y = typeof rec.precio === 'string' ? parseFloat(rec.precio) : (rec.precio || 0);
      return { x, y };
    });

    const volumes = this.historicoRecords.map(rec => {
      const x = this.getDecimalMonthsSinceBase(rec.fecha);
      const y = typeof rec.valor === 'string' ? parseFloat(rec.valor) : (rec.valor || 0);
      return { x, y };
    });

    // Insertar punto de línea base en Ene 1 si el primer punto no es exactamente el inicio de la escala (x = 0)
    if (prices.length > 0 && this.hasPrepended) {
      prices.unshift({ x: 0, y: initialPrice });
      volumes.unshift({ x: 0, y: 0 });
    }

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
                const rawIndex = tooltipItems[0].dataIndex;
                let index = rawIndex;
                if (this.hasPrepended) {
                  index = Math.max(0, index - 1);
                }
                const record = this.historicoRecords[index];
                if (!record) return '';
                
                let fechaDisplay = record.fecha;
                if (this.hasPrepended && rawIndex === 0) {
                  fechaDisplay = Number(this.selectedAnio) === 0 ? '2017-01-01' : `${this.selectedAnio}-01-01`;
                }
                
                return [
                  `Emisor: ${record.emisor || ''}`,
                  `Fecha: ${fechaDisplay}`
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
                const rawIndex = tooltipItems[0].dataIndex;
                if (this.hasPrepended && rawIndex === 0) {
                  return [
                    `Acciones: 0`,
                    `Transacciones: 0`
                  ].join('\n');
                }
                let index = rawIndex;
                if (this.hasPrepended) {
                  index = index - 1;
                }
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
          type: 'linear',
          bounds: 'ticks',
          offset: false,
          grid: {
            display: false
          },
          ticks: {
            color: '#6c757d',
            font: {
              size: 10,
              weight: '600'
            },
            autoSkip: false,
            callback: (value: any) => {
              const val = Math.round(value);
              if (Number(this.selectedAnio) === 0) {
                const year = 2017 + Math.floor(val / 12);
                if (val % 12 === 0) {
                  return val === 120 ? '' : year.toString();
                }
                return '';
              } else {
                const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                if (val >= 0 && val < 12) {
                  return `${monthNames[val]} ${this.selectedAnio}`;
                }
                return '';
              }
            }
          },
          afterBuildTicks: (scale: any) => {
            const ticks = [];
            if (Number(this.selectedAnio) === 0) {
              for (let y = 2017; y <= 2027; y++) {
                ticks.push({ value: (y - 2017) * 12 });
              }
            } else {
              for (let m = 0; m <= 12; m++) {
                ticks.push({ value: m });
              }
            }
            scale.ticks = ticks;
          },
          min: 0,
          max: Number(this.selectedAnio) === 0 ? 120 : 12
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
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
