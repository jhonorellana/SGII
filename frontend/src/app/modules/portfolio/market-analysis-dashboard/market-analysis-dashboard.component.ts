import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MercadoIndicadoresService } from '../../../services/mercado-indicadores/mercado-indicadores.service';
import { SnapshotCarteraDiaria } from '../../../services/portfolio-indicadores/portfolio-indicadores.service';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-market-analysis-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './market-analysis-dashboard.component.html',
  styleUrl: './market-analysis-dashboard.component.css',
  providers: [MercadoIndicadoresService]
})
export class MarketAnalysisDashboardComponent implements OnInit {
  indicadores: SnapshotCarteraDiaria[] = [];
  loading = true;
  error = '';

  constructor(private mercadoService: MercadoIndicadoresService) {}

  ngOnInit(): void {
    this.loadIndicadores();
  }

  loadIndicadores() {
    this.loading = true;
    this.mercadoService.getIndicadores().subscribe({
      next: (response) => {
        if (response.success) {
          this.indicadores = response.data;
        } else {
          this.error = 'No se pudieron cargar los indicadores de mercado.';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error de conexión al cargar los indicadores de mercado.';
        console.error(err);
        this.loading = false;
      }
    });
  }

  getAlertClass(alerta: string): string {
    const alertLower = alerta.toLowerCase();
    if (alertLower.includes('no realizado >') || alertLower.includes('variacion diaria >') || alertLower.includes('variación diaria >')) return 'alert-success-badge';
    if (alertLower.includes('no realizado <') || alertLower.includes('variacion diaria <') || alertLower.includes('variación diaria <')) return 'alert-danger-badge';
    if (alertLower.includes('rsi')) return 'alert-warning-badge';
    return 'alert-info-badge';
  }

  getAlertTooltip(alerta: string): string {
    const alertLower = alerta.toLowerCase();
    if (alertLower.includes('no realizado >')) return 'P&L no realizado positivo (simulado si no se posee).';
    if (alertLower.includes('no realizado <')) return 'P&L no realizado negativo (simulado si no se posee).';
    if (alertLower.includes('variacion diaria >') || alertLower.includes('variación diaria >')) return 'El precio de la acción subió significativamente hoy.';
    if (alertLower.includes('variacion diaria <') || alertLower.includes('variación diaria <')) return 'El precio de la acción bajó significativamente hoy.';
    if (alertLower.includes('vr >')) return 'El volumen de negociación reciente es anormalmente alto comparado a su promedio.';
    if (alertLower.includes('sin negociacion') || alertLower.includes('sin negociación')) return 'La acción no ha registrado operaciones en el mercado por un período prolongado.';
    return 'Alerta generada por el sistema';
  }
}

