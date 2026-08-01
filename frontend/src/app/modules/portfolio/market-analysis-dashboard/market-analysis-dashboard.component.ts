import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { MercadoIndicadoresService } from '../../../services/mercado-indicadores/mercado-indicadores.service';
import { SnapshotCarteraDiaria } from '../../../services/portfolio-indicadores/portfolio-indicadores.service';
import { HttpClientModule } from '@angular/common/http';
import { AccionPosicionService } from '../../../core/accion-posicion.service';
import { AccionDividendoService } from '../../../core/accion-dividendo.service';
import { AccionPosicion, AccionDividendo } from '../../../core/models/accion-models';

export interface MarketIndicatorRow extends SnapshotCarteraDiaria {
  myCapitalInvertido?: number;
  myCantidadAcciones?: number;
  myValorActualAcciones?: number;
  myDiferenciaValVsCapital?: number;
  myCantidadDivAcciones?: number;
  myValorDivAccionesActual?: number;
  myDivEfectivoRecibido?: number;
}

@Component({
  selector: 'app-market-analysis-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './market-analysis-dashboard.component.html',
  styleUrl: './market-analysis-dashboard.component.css',
  providers: [MercadoIndicadoresService, AccionPosicionService, AccionDividendoService]
})
export class MarketAnalysisDashboardComponent implements OnInit {
  indicadores: MarketIndicatorRow[] = [];
  loading = true;
  error = '';

  constructor(
    private mercadoService: MercadoIndicadoresService,
    private posicionService: AccionPosicionService,
    private dividendoService: AccionDividendoService
  ) {}

  ngOnInit(): void {
    this.loadIndicadores();
  }

  loadIndicadores() {
    this.loading = true;
    this.error = '';

    forkJoin({
      indicadores: this.mercadoService.getIndicadores(),
      posiciones: this.posicionService.getPosiciones(),
      dividendos: this.dividendoService.getAll()
    }).subscribe({
      next: (res) => {
        if (res.indicadores && res.indicadores.success) {
          const rawIndicadores: SnapshotCarteraDiaria[] = res.indicadores.data || [];
          const posiciones: AccionPosicion[] = (res.posiciones && res.posiciones.success) ? (res.posiciones.data || []) : [];
          const dividendos: AccionDividendo[] = (res.dividendos && res.dividendos.success) 
            ? ((res.dividendos.data || []).filter(d => d.activo && !d.eliminado)) 
            : [];

          this.indicadores = rawIndicadores.map(row => {
            const emisorId = row.id_emisor || row.emisor?.id_emisor;
            const emisorNombre = (row.emisor?.nombre || '').toUpperCase().trim();

            // Filtrar posiciones del emisor
            const rowPosiciones = posiciones.filter(p => {
              if (emisorId && p.id_emisor) {
                return p.id_emisor === emisorId;
              }
              const posEmisor = (p.emisor_nombre || p.instrumento || '').toUpperCase().trim();
              return posEmisor.includes(emisorNombre) || (emisorNombre.length > 3 && emisorNombre.includes(posEmisor));
            });

            // Filtrar dividendos del emisor
            const rowDividendos = dividendos.filter(d => {
              const divEmisorId = d.instrumento?.id_emisor;
              if (emisorId && divEmisorId) {
                return divEmisorId === emisorId;
              }
              const divEmisorName = (d.instrumento?.emisor?.nombre || d.instrumento?.nombre || '').toUpperCase().trim();
              return divEmisorName.includes(emisorNombre) || (emisorNombre.length > 3 && emisorNombre.includes(divEmisorName));
            });

            const precioActual = Number(row.precio_mercado || 0);

            // 1. Capital Invertido
            const capitalInvertido = rowPosiciones.reduce((sum, p) => sum + Number(p.capital_invertido || 0), 0);

            // 2. Cantidad de Acciones poseídas actualmente
            const cantidadAcciones = rowPosiciones.reduce((sum, p) => sum + Number(p.cantidad_actual || 0), 0);

            // 3. Valor Actual de las acciones a precio de mercado
            const valorActualAcciones = cantidadAcciones * precioActual;

            // 3.b Diferencia Valor Actual vs Capital Invertido
            const diferenciaValVsCapital = valorActualAcciones - capitalInvertido;

            // 4. Cantidad de Dividendo en Acciones recibido (unidades)
            const cantidadDivAcciones = rowDividendos.reduce((sum, d) => sum + Number(d.acciones_recibidas || 0), 0);

            // 5. Valor que esos dividendos en acciones representan a precio actual ($)
            const valorDivAccionesActual = cantidadDivAcciones * precioActual;

            // 6. Valor de dividendos en efectivo recibido ($)
            const divEfectivoRecibido = rowDividendos.reduce((sum, d) => {
              const cod = d.tipo_dividendo?.codigo || d.tipoDividendo?.codigo;
              if (cod === 'DIV_EFECTIVO' || cod === 'Efectivo' || (!d.acciones_recibidas && d.valor_neto)) {
                return sum + Number(d.valor_neto || 0);
              }
              return sum;
            }, 0);

            return {
              ...row,
              myCapitalInvertido: capitalInvertido,
              myCantidadAcciones: cantidadAcciones,
              myValorActualAcciones: valorActualAcciones,
              myDiferenciaValVsCapital: diferenciaValVsCapital,
              myCantidadDivAcciones: cantidadDivAcciones,
              myValorDivAccionesActual: valorDivAccionesActual,
              myDivEfectivoRecibido: divEfectivoRecibido
            };
          });
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

