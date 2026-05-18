import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { RecuperacionAnualService, RecuperacionAnualItem } from '../../../core/recuperacion-anual.service';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CardModule } from 'primeng/card';
import { Chart, registerables } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(...registerables);
Chart.register(ChartDataLabels);

@Component({
  selector: 'app-recuperacion-anual',
  standalone: true,
  imports: [
    CommonModule,
    ToastModule,
    ButtonModule,
    ProgressSpinnerModule,
    CardModule
  ],
  providers: [MessageService],
  templateUrl: './recuperacion-anual.component.html',
  styleUrls: ['./recuperacion-anual.component.css']
})
export class RecuperacionAnualComponent implements OnInit, AfterViewInit {
  loading = false;
  datos: RecuperacionAnualItem[] = [];

  chartData: any;
  chartOptions: any;
  chart: any;

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(
    private recuperacionAnualService: RecuperacionAnualService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDatos();
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
    this.recuperacionAnualService.getRecuperacionAnual(0).subscribe({
      next: (data) => {
        this.datos = data;
        this.loading = false;

        this.cdr.detectChanges();
        setTimeout(() => {
          this.tryInitChart();
        }, 100);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar datos de recuperación anual'
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

    if (!ctx) {
      return;
    }

    const labels = this.datos.map(item => item.anio);
    const capitalData = this.datos.map(item => item.capital);
    const interesData = this.datos.map(item => item.interes);
    const totalData = this.datos.map(item => item.total);

    // Calcular el valor máximo para suggestedMax
    const maxValue = Math.max(...totalData, ...capitalData, ...interesData);

    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: 'Total',
          data: totalData,
          backgroundColor: '#3b82f6',
          borderColor: '#2563eb',
          borderWidth: 1,
          barPercentage: 1.0,
          barThickness: 45
        },
        {
          label: 'Capital',
          data: capitalData,
          backgroundColor: '#ef4444',
          borderColor: '#dc2626',
          borderWidth: 1,
          barPercentage: 1.0,
          barThickness: 45
        },
        {
          label: 'Interés',
          data: interesData,
          backgroundColor: '#22c55e',
          borderColor: '#16a34a',
          borderWidth: 1,
          barPercentage: 1.0,
          barThickness: 45
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
          position: 'top',
          labels: {
            padding: 30,
            font: {
              size: 12
            },
            usePointStyle: true,
            boxWidth: 12,
            boxHeight: 8
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'top',
          formatter: (value: number) => {
            return this.formatCurrencyShort(value);
          },
          font: {
            weight: 'bold',
            size: 11
          },
          color: '#333',
          offset: 1
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
          },
          categoryPercentage: 0.98,
          barPercentage: 1.0
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
          suggestedMax: maxValue * 1.1
        }
      }
    };

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: this.chartData,
      options: this.chartOptions
    });
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
}
