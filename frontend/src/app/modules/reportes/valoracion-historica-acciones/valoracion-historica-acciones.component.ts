import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ValoracionHistoricaService, ValoracionSerieRecord, ValoracionResumen } from '../../../core/valoracion-historica.service';
import * as XLSX from 'xlsx';
import 'chartjs-adapter-date-fns';
import { 
  Chart, 
  TimeScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  LineController, 
  Tooltip, 
  Legend 
} from 'chart.js';

Chart.register(
  TimeScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  LineController, 
  Tooltip, 
  Legend
);

@Component({
  selector: 'app-valoracion-historica-acciones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropdownModule,
    ChartModule,
    TableModule
  ],
  templateUrl: './valoracion-historica-acciones.component.html',
  styleUrls: ['./valoracion-historica-acciones.component.css']
})
export class ValoracionHistoricaAccionesComponent implements OnInit {
  // Filtros
  fechaInicio: string = '2026-01-01';
  fechaFin: string = new Date().toISOString().split('T')[0];

  empresas: any[] = [];
  selectedEmpresa: any = null; // null = Todos los emisores

  // Data
  serieRecords: ValoracionSerieRecord[] = [];
  resumen: ValoracionResumen = {
    valor_mercado_actual: 0,
    cantidad_actual: 0,
    costo_actual: 0,
    plusvalia_actual_monto: 0,
    plusvalia_actual_pct: 0
  };

  loading = false;
  hasData = false;

  // Chart config
  chartData: any = null;
  chartOptions: any = null;

  rowsPerPage = 10;

  constructor(
    private valoracionService: ValoracionHistoricaService,
    private cdr: ChangeDetectorRef
  ) {
    this.setupChartOptions();
  }

  ngOnInit(): void {
    this.loadReporte();
  }

  setupChartOptions(): void {
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        datalabels: {
          display: false
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            font: { family: "'Inter', sans-serif", size: 12, weight: 'bold' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title: (items: any[]) => {
              if (!items || items.length === 0) return '';
              const dateVal = new Date(items[0].parsed.x);
              return dateVal.toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' });
            },
            label: (context: any) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y || 0;
              const formattedVal = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);
              return `${label}: ${formattedVal}`;
            },
            afterBody: (items: any[]) => {
              if (!items || items.length === 0) return [];
              const index = items[0].dataIndex;
              const record = this.serieRecords[index];
              if (!record) return [];
              return [
                `• Acciones Poseídas: ${new Intl.NumberFormat('es-EC').format(record.cantidad_acciones)}`,
                `• Precio Prom. Mercado: $${record.precio_promedio_mercado.toFixed(4)}`,
                `• Plusvalía: ${new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(record.plusvalia_monto)} (${record.plusvalia_pct}%)`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'month',
            displayFormats: {
              month: 'MMM yyyy'
            }
          },
          grid: {
            color: 'rgba(226, 232, 240, 0.6)'
          },
          ticks: {
            font: { size: 11 }
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Valor de Mercado ($)',
            font: { size: 12, weight: 'bold' }
          },
          ticks: {
            callback: (val: any) => '$' + new Intl.NumberFormat('es-EC').format(val)
          },
          grid: {
            color: 'rgba(226, 232, 240, 0.6)'
          }
        }
      }
    };
  }

  loadReporte(): void {
    this.loading = true;
    this.valoracionService.getValoracionHistorica({
      fecha_inicio: this.fechaInicio,
      fecha_fin: this.fechaFin,
      id_emisor: this.selectedEmpresa
    }).subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
          this.serieRecords = response.data.serie || [];
          this.resumen = response.data.resumen || {
            valor_mercado_actual: 0,
            cantidad_actual: 0,
            costo_actual: 0,
            plusvalia_actual_monto: 0,
            plusvalia_actual_pct: 0
          };

          // Poblar selector de emisores si aún no tiene opciones
          if (response.data.emisores && this.empresas.length === 0) {
            this.empresas = [
              { label: 'Todos los Emisores', value: null },
              ...response.data.emisores.map(e => ({ label: e.nombre, value: e.id_emisor }))
            ];
          }

          this.hasData = this.serieRecords.length > 0;
          this.buildChart();
        } else {
          this.serieRecords = [];
          this.hasData = false;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar valoración histórica de acciones:', err);
        this.serieRecords = [];
        this.hasData = false;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFiltersChange(): void {
    this.loadReporte();
  }

  buildChart(): void {
    if (!this.hasData) {
      this.chartData = null;
      return;
    }

    const valorMercadoData = this.serieRecords.map(r => ({
      x: new Date(r.fecha),
      y: r.valor_mercado
    }));

    const costoInvertidoData = this.serieRecords.map(r => ({
      x: new Date(r.fecha),
      y: r.costo_invertido
    }));

    this.chartData = {
      datasets: [
        {
          type: 'line',
          label: 'Valor de Mercado ($)',
          data: valorMercadoData,
          borderColor: '#10b981', // Verde esmeralda elegante
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2.5,
          pointRadius: 2,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.2,
          datalabels: { display: false }
        },
        {
          type: 'line',
          label: 'Costo Invertido ($)',
          data: costoInvertidoData,
          borderColor: '#3b82f6', // Azul profesional
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.2,
          datalabels: { display: false }
        }
      ]
    };
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val || 0);
  }

  formatNumber(val: number): string {
    return new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 }).format(val || 0);
  }

  exportarExcel(): void {
    if (!this.hasData) return;

    const dataToExport = this.serieRecords.map(r => ({
      'Fecha': r.fecha,
      'Acciones en Posesión': r.cantidad_acciones,
      'Precio Promedio Mercado ($)': r.precio_promedio_mercado,
      'Valor de Mercado ($)': r.valor_mercado,
      'Costo Invertido ($)': r.costo_invertido,
      'Plusvalía ($)': r.plusvalia_monto,
      'Plusvalía (%)': r.plusvalia_pct + '%'
    }));

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook: XLSX.WorkBook = { Sheets: { 'Valoración Acciones': worksheet }, SheetNames: ['Valoración Acciones'] };
    XLSX.writeFile(workbook, `Valoracion_Historica_Acciones_${this.fechaInicio}_${this.fechaFin}.xlsx`);
  }
}
