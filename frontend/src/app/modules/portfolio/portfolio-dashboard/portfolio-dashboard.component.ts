import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioIndicadoresService, SnapshotCarteraDiaria } from '../../../services/portfolio-indicadores/portfolio-indicadores.service';
import { HttpClientModule } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-portfolio-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, TableModule, InputTextModule, TagModule],
  templateUrl: './portfolio-dashboard.component.html',
  styleUrl: './portfolio-dashboard.component.css',
  providers: [PortfolioIndicadoresService]
})
export class PortfolioDashboardComponent implements OnInit {
  indicadores: SnapshotCarteraDiaria[] = [];
  loading = true;
  error = '';

  constructor(private portfolioService: PortfolioIndicadoresService) {}

  ngOnInit(): void {
    this.loadIndicadores();
  }

  loadIndicadores() {
    this.loading = true;
    this.portfolioService.getIndicadores().subscribe({
      next: (response) => {
        if (response.success) {
          this.indicadores = response.data;
        } else {
          this.error = 'No se pudieron cargar los indicadores.';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error de conexión al cargar los indicadores.';
        console.error(err);
        this.loading = false;
      }
    });
  }

  getAlertClass(alerta: string): string {
    const alertLower = alerta.toLowerCase();
    if (alertLower.includes('no realizado >') || alertLower.includes('variacion diaria >') || alertLower.includes('variación diaria >')) {
      return 'bg-success-subtle text-success border border-success-subtle';
    }
    if (alertLower.includes('no realizado <') || alertLower.includes('variacion diaria <') || alertLower.includes('variación diaria <')) {
      return 'bg-danger-subtle text-danger border border-danger-subtle';
    }
    if (alertLower.includes('rsi')) {
      return 'bg-warning-subtle text-warning border border-warning-subtle';
    }
    return 'bg-secondary-subtle text-secondary border border-secondary-subtle';
  }

  getAlertTooltip(alerta: string): string {
    const alertLower = alerta.toLowerCase();
    if (alertLower.includes('no realizado >')) return 'Su P&L no realizado supera el umbral positivo establecido.';
    if (alertLower.includes('no realizado <')) return 'Su P&L no realizado ha caído por debajo del umbral de pérdida establecido.';
    if (alertLower.includes('variacion diaria >') || alertLower.includes('variación diaria >')) return 'El precio de la acción subió significativamente hoy.';
    if (alertLower.includes('variacion diaria <') || alertLower.includes('variación diaria <')) return 'El precio de la acción bajó significativamente hoy.';
    if (alertLower.includes('vr >')) return 'El volumen de negociación reciente es anormalmente alto comparado a su promedio.';
    if (alertLower.includes('sin negociacion') || alertLower.includes('sin negociación')) return 'La acción no ha registrado operaciones en el mercado por un período prolongado.';
    return 'Alerta generada por el sistema';
  }
}

