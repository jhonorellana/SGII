import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { HistoricoIndicadorService } from '../../core/historico-indicador.service';
import { createStackedTooltipOptions } from '../../core/utils/chart-options.util';

@Component({
  selector: 'app-tendencias-historicas',
  standalone: true,
  imports: [CommonModule, ChartModule],
  templateUrl: './tendencias-historicas.component.html',
  styleUrls: ['./tendencias-historicas.component.css']
})
export class TendenciasHistoricasComponent implements OnInit {
  historicoData: any[] = [];
  
  // Chart 1: Crecimiento
  chartCrecimientoData: any;
  chartCrecimientoOptions: any;

  // Chart 2: Riesgo
  chartRiesgoData: any;
  chartRiesgoOptions: any;

  // Chart 3: Renta Variable
  chartRentaVariableData: any;
  chartRentaVariableOptions: any;

  // Chart 4: Notas de Crédito
  chartNCData: any;
  chartNCOptions: any;

  loading = true;

  constructor(private historicoService: HistoricoIndicadorService) {}

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.historicoService.getHistorico().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.historicoData = res.data;
          this.inicializarGraficos();
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Error al cargar históricos', err);
        this.loading = false;
      }
    });
  }

  inicializarGraficos() {
    if (this.historicoData.length === 0) return;

    const labels = this.historicoData.map(h => h.fecha_captura);
    
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color') || '#495057';
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary') || '#6c757d';
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border') || '#dfe7ef';

    // 1. Crecimiento Patrimonial
    this.chartCrecimientoData = {
      labels: labels,
      datasets: [
        {
          label: 'Patrimonio Base',
          data: this.historicoData.map(h => h.patrimonio_base),
          fill: true,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.2)',
          tension: 0.4
        },
        {
          label: 'Patrimonio Consolidado',
          data: this.historicoData.map(h => h.patrimonio_consolidado),
          fill: true,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          tension: 0.4
        },
        {
          label: 'Proyectado (1 Año)',
          data: this.historicoData.map(h => h.patrimonio_proyectado_consolidado),
          fill: false,
          borderColor: '#f59e0b',
          borderDash: [5, 5],
          tension: 0.4
        }
      ]
    };

    this.chartCrecimientoOptions = {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: createStackedTooltipOptions('$'),
        datalabels: { display: false }
      },
      scales: {
        x: { ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
        y: { ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } }
      }
    };

    // 2. Distribución de Riesgo
    this.chartRiesgoData = {
      labels: labels,
      datasets: [
        {
          label: 'Renta Fija',
          data: this.historicoData.map(h => h.capital_renta_fija),
          fill: true,
          backgroundColor: '#3b82f6',
          borderColor: '#3b82f6',
          tension: 0.4
        },
        {
          label: 'Renta Variable',
          data: this.historicoData.map(h => h.capital_renta_variable),
          fill: true,
          backgroundColor: '#ec4899',
          borderColor: '#ec4899',
          tension: 0.4
        },
        {
          label: 'Notas de Crédito',
          data: this.historicoData.map(h => h.capital_notas_credito),
          fill: true,
          backgroundColor: '#8b5cf6',
          borderColor: '#8b5cf6',
          tension: 0.4
        }
      ]
    };

    this.chartRiesgoOptions = {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: createStackedTooltipOptions('$'),
        datalabels: { display: false }
      },
      scales: {
        x: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
        y: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } }
      }
    };

    // 3. Renta Variable
    this.chartRentaVariableData = {
      labels: labels,
      datasets: [
        {
          type: 'line',
          label: 'Plusvalía Acciones',
          data: this.historicoData.map(h => h.plusvalia_acciones),
          borderColor: '#14b8a6',
          tension: 0.4,
          fill: false,
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: 'Dividendos Efectivo',
          data: this.historicoData.map(h => h.dividendos_efectivo),
          backgroundColor: '#0ea5e9'
        },
        {
          type: 'bar',
          label: 'Dividendos Acciones',
          data: this.historicoData.map(h => h.dividendos_acciones),
          backgroundColor: '#6366f1'
        }
      ]
    };

    this.chartRentaVariableOptions = {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: createStackedTooltipOptions('$'),
        datalabels: { display: false }
      },
      scales: {
        x: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
        y: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } }
      }
    };

    // 4. Notas de Crédito
    this.chartNCData = {
      labels: labels,
      datasets: [
        {
          type: 'bar',
          label: 'Valor Compra',
          data: this.historicoData.map(h => h.valor_compra_nc),
          backgroundColor: '#ef4444'
        },
        {
          type: 'bar',
          label: 'Valor Venta',
          data: this.historicoData.map(h => h.valor_venta_nc),
          backgroundColor: '#22c55e'
        },
        {
          type: 'line',
          label: 'Utilidad',
          data: this.historicoData.map(h => h.utilidad_nc),
          borderColor: '#eab308',
          tension: 0.4,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    };

    this.chartNCOptions = {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: createStackedTooltipOptions('$'),
        datalabels: { display: false }
      },
      scales: {
        x: { ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
        y: { type: 'linear', display: true, position: 'left', ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
        y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: textColorSecondary } }
      }
    };
  }
}
