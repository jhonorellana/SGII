import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { RecuperacionAnualService, RecuperacionAnualItem } from '../../../core/recuperacion-anual.service';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CardModule } from 'primeng/card';
import { Chart, registerables } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { LayoutService } from '../../../core/layout.service';
import { Subscription } from 'rxjs';

Chart.register(...registerables);
Chart.register(ChartDataLabels);

@Component({
  selector: 'app-proyeccion-interes-anual',
  standalone: true,
  imports: [
    CommonModule,
    ToastModule,
    ButtonModule,
    ProgressSpinnerModule,
    CardModule
  ],
  providers: [MessageService],
  templateUrl: './proyeccion-interes-anual.component.html',
  styleUrls: ['./proyeccion-interes-anual.component.css']
})
export class ProyeccionInteresAnualComponent implements OnInit, AfterViewInit, OnDestroy {
  loading = false;
  datos: RecuperacionAnualItem[] = [];

  chartData: any;
  chartOptions: any;
  chart: any;

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  private layoutSubscription: Subscription | null = null;

  constructor(
    private recuperacionAnualService: RecuperacionAnualService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
    private layoutService: LayoutService
  ) {}

  ngOnInit(): void {
    this.loadDatos();
    this.setupLayoutListener();
  }

  setupLayoutListener(): void {
    this.layoutSubscription = this.layoutService.sidebarCollapsed$.subscribe(() => {
      // Wait for the sidebar transition to complete before resizing the chart
      setTimeout(() => {
        if (this.chart) {
          this.chart.resize();
        }
      }, 350); // 350ms to account for the 300ms transition + buffer
    });
  }

  ngAfterViewInit(): void {
    this.tryInitChart();
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
    this.recuperacionAnualService.getRecuperacionAnual(1).subscribe({
      next: (data) => {
        this.datos = data;
        this.loading = false;

        // Esperar a que Angular pinte el canvas antes de crear el gráfico
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
          detail: 'Error al cargar datos de proyección de interés anual'
        });
        this.loading = false;
      }
    });
  }

  initChart(): void {
    if (!this.chartCanvas || !this.chartCanvas.nativeElement) {
      console.error('Canvas no disponible');
      return;
    }

    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('No se pudo obtener contexto 2D del canvas');
      return;
    }

    const labels = this.datos.map(item => item.anio);
    const interesData = this.datos.map(item => item.interes);

    // Generar colores diferentes para cada barra
    const colors = this.generateColors(labels.length);

    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: 'Interés',
          data: interesData,
          backgroundColor: colors,
          borderColor: colors.map(color => this.darkenColor(color, 20)),
          borderWidth: 1,
          barPercentage: 0.95,
          categoryPercentage: 0.95
        }
      ]
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        autoPadding: false,
        padding: {
          top: 20,
          right: 5,
          bottom: 5,
          left: 5
        }
      },
      plugins: {
        legend: {
          display: false
        },
        datalabels: {
          anchor: 'end',
          align: 'top',
          formatter: (value: number) => {
            return this.formatCurrencyShort(value);
          },
          font: {
            weight: 'bold',
            size: 12
          },
          color: '#333',
          offset: 2
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += this.formatCurrency(context.raw);
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Año',
            font: {
              size: 13,
              weight: 'bold'
            },
            padding: { top: 4 }
          },
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 12
            },
            padding: 4
          }
        },
        y: {
          title: {
            display: true,
            text: 'Valor (US$)',
            font: {
              size: 13,
              weight: 'bold'
            },
            padding: { bottom: 4 }
          },
          grid: {
            color: '#e5e7eb'
          },
          ticks: {
            callback: (value: number) => {
              return this.formatCurrencyShort(value);
            },
            font: {
              size: 11
            },
            padding: 4
          },
          beginAtZero: true,
          suggestedMax: this.datos.length > 0 ? Math.max(...this.datos.map(d => d.interes)) * 1.1 : 60000
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
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatCurrencyShort(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
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

  darkenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (0x1000000 +
      (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
  }

  ngOnDestroy(): void {
    if (this.layoutSubscription) {
      this.layoutSubscription.unsubscribe();
    }
  }
}
