import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { DividendRadarService, DividendOpportunityItem, SimulationResponse, PortfolioPositionItem } from '../../core/dividend-radar.service';

@Component({
  selector: 'app-dividend-radar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TooltipModule,
    DialogModule,
    TagModule
  ],
  templateUrl: './dividend-radar.component.html',
  styleUrl: './dividend-radar.component.css'
})
export class DividendRadarComponent implements OnInit {
  activeTab: 'radar' | 'portafolio' = 'radar';
  
  loading: boolean = false;
  loadingSimulation: boolean = false;
  loadingPortfolio: boolean = false;
  
  radarItems: DividendOpportunityItem[] = [];
  filteredItems: DividendOpportunityItem[] = [];
  radarViewMode: 'table' | 'cards' = 'cards';
  
  yieldPromedioMercado: number = 0;
  totalEmisoresEvaluados: number = 0;
  topYieldEmisor: DividendOpportunityItem | null = null;
  
  // State de Mi Portafolio
  portfolioItems: PortfolioPositionItem[] = [];
  filteredPortfolioItems: PortfolioPositionItem[] = [];
  portfolioViewMode: 'table' | 'cards' = 'cards';
  selectedPersonaId: number = 0;
  consolidarPortafolio: boolean = false;
  titulares: { id_persona: number; persona: string }[] = [];
  
  totalValorPortafolioUsd: number = 0;
  totalDividendosAnualesUsd: number = 0;
  yieldPromedioPonderadoPct: number = 0;
  portfolioSearchTerm: string = '';

  // Filtros Radar
  minYieldFilter: number = 0;
  searchTerm: string = '';
  
  // Modal de Simulación
  displaySimulationModal: boolean = false;
  selectedEmisorForSim: DividendOpportunityItem | null = null;
  montoASimular: number = 10000;
  simulationResult: SimulationResponse['data'] | null = null;
  errorSimulation: string = '';

  constructor(private radarService: DividendRadarService) {}

  ngOnInit(): void {
    this.cargarRadar();
    this.cargarPortafolio();
  }

  cambiarTab(tab: 'radar' | 'portafolio'): void {
    this.activeTab = tab;
    if (tab === 'portafolio' && this.portfolioItems.length === 0) {
      this.cargarPortafolio();
    }
  }

  cargarRadar(): void {
    this.loading = true;
    this.radarService.getRadar().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.radarItems = res.data;
          this.filteredItems = [...res.data];
          this.totalEmisoresEvaluados = res.total_emisores_evaluados;
          this.yieldPromedioMercado = res.yield_promedio_mercado;
          if (this.radarItems.length > 0) {
            this.topYieldEmisor = this.radarItems[0];
          }
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Error al cargar radar de dividendos:', err);
      }
    });
  }

  cargarPortafolio(): void {
    this.loadingPortfolio = true;
    this.radarService.getMiPortafolio(this.selectedPersonaId).subscribe({
      next: (res) => {
        this.loadingPortfolio = false;
        if (res.success) {
          this.portfolioItems = res.data;
          this.filteredPortfolioItems = [...res.data];
          this.totalValorPortafolioUsd = res.total_valor_portafolio_usd;
          this.totalDividendosAnualesUsd = res.total_dividendos_anuales_usd;
          this.yieldPromedioPonderadoPct = res.yield_promedio_ponderado_pct;
          this.titulares = res.titulares || [];
          this.aplicarFiltrosPortafolio();
        }
      },
      error: (err) => {
        this.loadingPortfolio = false;
        console.error('Error al cargar mi portafolio:', err);
      }
    });
  }

  aplicarFiltros(): void {
    let result = [...this.radarItems];

    if (this.searchTerm.trim() !== '') {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(item => item.emisor.toLowerCase().includes(term));
    }

    if (this.minYieldFilter > 0) {
      result = result.filter(item => item.yield_pct >= this.minYieldFilter);
    }

    this.filteredItems = result;
  }

  aplicarFiltrosPortafolio(): void {
    let result = [...this.portfolioItems];

    if (this.selectedPersonaId > 0) {
      result = result.filter(item => Number(item.id_persona) === Number(this.selectedPersonaId));
    }

    if (this.portfolioSearchTerm.trim() !== '') {
      const term = this.portfolioSearchTerm.toLowerCase();
      result = result.filter(item => 
        item.emisor.toLowerCase().includes(term) || 
        item.persona.toLowerCase().includes(term)
      );
    }

    if (this.consolidarPortafolio && Number(this.selectedPersonaId) === 0) {
      const grouped: { [key: number]: PortfolioPositionItem } = {};
      result.forEach(item => {
        const key = item.id_emisor;
        if (!grouped[key]) {
          grouped[key] = {
            ...item,
            senales: [...(item.senales || [])]
          };
          (grouped[key] as any).personas_list = [item.persona];
        } else {
          grouped[key].cantidad_actual += item.cantidad_actual;
          grouped[key].capital_invertido += item.capital_invertido;
          grouped[key].valor_mercado += item.valor_mercado;
          grouped[key].ganancia_perdida += item.ganancia_perdida;
          grouped[key].dividendo_acciones_cant += item.dividendo_acciones_cant;
          grouped[key].val_div_acciones += item.val_div_acciones;
          grouped[key].div_efectivo_recibido += item.div_efectivo_recibido;
          grouped[key].ingreso_anual_estimado_usd += item.ingreso_anual_estimado_usd;

          const pList = (grouped[key] as any).personas_list;
          if (!pList.includes(item.persona)) {
            pList.push(item.persona);
          }
          grouped[key].persona = pList.join(', ');
          grouped[key].costo_promedio = grouped[key].cantidad_actual > 0
            ? Number((grouped[key].capital_invertido / grouped[key].cantidad_actual).toFixed(2))
            : 0;
        }
      });
      result = Object.values(grouped);
    }

    this.filteredPortfolioItems = result;
  }

  abrirSimulador(item: DividendOpportunityItem): void {
    this.selectedEmisorForSim = item;
    this.displaySimulationModal = true;
    this.errorSimulation = '';
    this.simulationResult = null;
    this.ejecutarSimulacion();
  }

  abrirSimuladorDesdePortafolio(item: PortfolioPositionItem): void {
    const opportunityItem: DividendOpportunityItem = {
      id_emisor: item.id_emisor,
      emisor: item.emisor,
      precio_mercado: item.precio_ultimo,
      ultimo_dividendo_acc: item.dividendo_por_accion,
      dividendo_proyectado_d1: Number((item.dividendo_por_accion * 1.03).toFixed(4)),
      yield_pct: item.dividend_yield_pct,
      estrellas_consistencia: item.estrellas_consistencia,
      mes_probable_pago: item.mes_probable_pago,
      precio_teorico_gordon: Number(((item.dividendo_por_accion * 1.03) / (0.10 - 0.03)).toFixed(2)),
      margen_oportunidad_pct: 0,
      total_dividendos_registrados: 0
    };
    this.montoASimular = Math.max(1000, Math.round(item.valor_mercado));
    this.abrirSimulador(opportunityItem);
  }

  ejecutarSimulacion(): void {
    if (!this.selectedEmisorForSim || this.montoASimular <= 0) return;

    this.loadingSimulation = true;
    this.errorSimulation = '';

    this.radarService.simularInversion(this.montoASimular, this.selectedEmisorForSim.id_emisor).subscribe({
      next: (res) => {
        this.loadingSimulation = false;
        if (res.success && res.data) {
          this.simulationResult = res.data;
        } else {
          this.errorSimulation = res.message || 'Error al calcular la simulación';
        }
      },
      error: (err) => {
        this.loadingSimulation = false;
        this.errorSimulation = err.error?.message || 'Error de conexión con el servidor';
      }
    });
  }

  cerrarSimulador(): void {
    this.displaySimulationModal = false;
  }

  getStarArray(count: number): number[] {
    return Array(count).fill(0);
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
}
