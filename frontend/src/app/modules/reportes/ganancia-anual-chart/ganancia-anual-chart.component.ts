import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { GananciaAnualService, GananciaAnualItem } from '../../../core/ganancia-anual.service';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Chart, registerables } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { LayoutService } from '../../../core/layout.service';
import { Subscription } from 'rxjs';

Chart.register(...registerables);
Chart.register(ChartDataLabels);

@Component({
  selector: 'app-ganancia-anual-chart',
  standalone: true,
  imports: [
    CommonModule,
    ToastModule,
    ButtonModule,
    ProgressSpinnerModule
  ],
  providers: [MessageService],
  templateUrl: './ganancia-anual-chart.component.html',
  styleUrls: ['./ganancia-anual-chart.component.css']
})
export class GananciaAnualChartComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  loading = false;
  datos: GananciaAnualItem[] = [];

  chartData: any;
  chartOptions: any;
  chart: any;

  @Input() active: boolean = false; // To know if the tab is active
  private hasInitialized: boolean = false;

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  private layoutSubscription: Subscription | null = null;

  constructor(
    private gananciaAnualService: GananciaAnualService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
    private layoutService: LayoutService
  ) {}

  ngOnInit(): void {
    this.setupLayoutListener();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['active'] && changes['active'].currentValue === true) {
      this.onTabActivate();
    }
  }
  
  // Expose a method to be called when the tab becomes active
  public onTabActivate(): void {
    if (!this.hasInitialized) {
      this.loadDatos();
      this.hasInitialized = true;
    } else {
      setTimeout(() => {
        if (this.chart) {
          this.chart.resize();
        }
      }, 100);
    }
  }

  setupLayoutListener(): void {
    this.layoutSubscription = this.layoutService.sidebarCollapsed$.subscribe(() => {
      setTimeout(() => {
        if (this.chart) {
          this.chart.resize();
        }
      }, 350);
    });
  }

  ngAfterViewInit(): void {
    if (this.active) {
      this.onTabActivate();
    }
  }

  tryInitChart(): void {
    if (!this.chartCanvas || !this.chartCanvas.nativeElement) {
      return;
    }
    if (!this.datos || this.datos.length === 0) {
      return;
    }
    this.initChart();
  }

  loadDatos(): void {
    this.loading = true;
    this.gananciaAnualService.getGananciaAnual().subscribe({
      next: (data) => {
        this.datos = data;
        this.loading = false;

        this.cdr.detectChanges();
        setTimeout(() => {
          this.tryInitChart();
        }, 100);
      },
      error: (err) => {
        console.error('Error al cargar datos:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar datos de ganancia anual'
        });
        this.loading = false;
      }
    });
  }

  initChart(): void {
    if (!this.chartCanvas || !this.chartCanvas.nativeElement) {
      return;
    }

    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const labels = Array.from(new Set(this.datos.map(item => item.anio))).sort();
    
    // Agrupar los tipos de venta y ordenarlos por la ganancia total (de mayor a menor)
    // para que el mayor quede en el fondo (primer dataset)
    let tiposVenta = Array.from(new Set(this.datos.map(item => item.tipo_venta)));
    tiposVenta.sort((a, b) => {
      const sumA = this.datos.filter(d => d.tipo_venta === a).reduce((sum, curr) => sum + Number(curr.ganancia), 0);
      const sumB = this.datos.filter(d => d.tipo_venta === b).reduce((sum, curr) => sum + Number(curr.ganancia), 0);
      return sumB - sumA; // Descendente: mayor abajo
    });

    const colors = this.generateColors(tiposVenta.length);

    const datasets = tiposVenta.map((tipo, index) => {
      const dataForTipo = labels.map(anio => {
        const item = this.datos.find(d => d.anio === anio && d.tipo_venta === tipo);
        return item ? Number(item.ganancia) : 0;
      });

      return {
        label: tipo,
        data: dataForTipo,
        backgroundColor: colors[index],
        borderColor: this.darkenColor(colors[index], 20),
        borderWidth: 1,
        barPercentage: 0.95,
        categoryPercentage: 0.95
      };
    });

    this.chartData = {
      labels: labels,
      datasets: datasets
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      layout: {
        autoPadding: false,
        padding: { top: 20, right: 5, bottom: 5, left: 5 }
      },
      plugins: {
        legend: { display: true, position: 'top' },
        datalabels: {
          // Solo mostrar la etiqueta en el último dataset (el de más arriba) para no repetir
          display: (context: any) => {
            return context.datasetIndex === context.chart.data.datasets.length - 1;
          },
          anchor: 'end',
          align: 'top',
          formatter: (value: number, context: any) => {
            // Calcular el total de toda la pila para este índice
            let total = 0;
            context.chart.data.datasets.forEach((dataset: any) => {
              total += Number(dataset.data[context.dataIndex]) || 0;
            });
            return total !== 0 ? this.formatCurrencyShort(total) : '';
          },
          font: { weight: 'bold', size: 12 },
          color: '#333'
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              label += this.formatCurrency(context.raw);
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          title: { display: true, text: 'Año', font: { size: 13, weight: 'bold' }, padding: { top: 4 } },
          grid: { display: false },
          ticks: { font: { size: 12 }, padding: 4 }
        },
        y: {
          stacked: true,
          title: { display: true, text: 'Valor (US$)', font: { size: 13, weight: 'bold' }, padding: { bottom: 4 } },
          grid: { color: '#e5e7eb' },
          ticks: {
            callback: (value: number) => this.formatCurrencyShort(value),
            font: { size: 11 },
            padding: 4
          },
          beginAtZero: true
        }
      }
    };

    if (this.chart) {
      this.chart.destroy();
    }

    try {
      this.chart = new Chart(ctx, {
        type: 'bar',
        data: this.chartData,
        options: this.chartOptions
      });
    } catch (error) {
      console.error('Error al crear el chart:', error);
    }
  }

  formatCurrency(value: number): string {
    return this.formatCurrencyShort(value) + ' US$';
  }

  formatCurrencyShort(value: number): string {
    // Forzar el separador de miles con punto incluso para números de 4 dígitos
    return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  generateColors(count: number): string[] {
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    return result;
  }

  darkenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  ngOnDestroy(): void {
    if (this.layoutSubscription) {
      this.layoutSubscription.unsubscribe();
    }
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
