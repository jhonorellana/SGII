import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { DialogModule } from 'primeng/dialog';
import { FixedIncomeRadarService, FixedIncomeMarketInstrument, FixedIncomeKPIs, FixedIncomePortfolioHolding, InvestmentDetailResponse } from '../../core/fixed-income-radar.service';

@Component({
  selector: 'app-fixed-income-radar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TooltipModule,
    DropdownModule,
    TagModule,
    ProgressBarModule,
    DialogModule
  ],
  templateUrl: './fixed-income-radar.component.html',
  styleUrl: './fixed-income-radar.component.css'
})
export class FixedIncomeRadarComponent implements OnInit {
  activeTab: 'MERCADO' | 'PORTAFOLIO' = 'MERCADO';
  viewMode: 'CARDS' | 'TABLE' = 'TABLE';

  loading: boolean = false;
  latestDate: string = '';

  // Datos Radar de Mercado
  instruments: FixedIncomeMarketInstrument[] = [];
  filteredInstruments: FixedIncomeMarketInstrument[] = [];
  kpis: FixedIncomeKPIs = {
    total_titulos: 0,
    tir_promedio: 0,
    tasa_cupon_promedio: 0,
    plazo_promedio_dias: 0
  };

  // Filtros
  searchTerm: string = '';
  selectedClase: string = '';
  selectedRating: string = '';

  clasesOptions = [
    { label: 'Todas las Clases', value: '' },
    { label: 'Obligaciones', value: 'OBLIGACIONES' },
    { label: 'Papel Comercial', value: 'PAPEL COMERCIAL' },
    { label: 'Titularización', value: 'TITULARIZACION' },
    { label: 'Bonos del Estado', value: 'BONOS' }
  ];

  ratingOptions = [
    { label: 'Todas las Calificaciones', value: '' },
    { label: 'AAA / AAA-', value: 'AAA' },
    { label: 'AA+ / AA / AA-', value: 'AA' },
    { label: 'A+ / A / A-', value: 'A' }
  ];

  // Datos Mi Portafolio
  portfolioHoldings: FixedIncomePortfolioHolding[] = [];
  portfolioSummary = {
    total_valor_compra: 0,
    total_valor_mercado: 0,
    total_ganancia_usd: 0,
    total_ganancia_pct: 0,
    total_posiciones: 0
  };
  portfolioClaseFilter: string = '';
  includeExpired: boolean = false;

  // Modal Detalle de Inversión y Amortizaciones
  detailDialogVisible: boolean = false;
  selectedHolding: FixedIncomePortfolioHolding | null = null;
  investmentDetail: InvestmentDetailResponse['data'] | null = null;
  loadingDetail: boolean = false;
  updatingVector: boolean = false;
  customVectorInput: string = '';

  constructor(private fixedIncomeService: FixedIncomeRadarService) {}

  ngOnInit(): void {
    this.loadMarketRadar();
    this.loadPortfolio();
  }

  loadMarketRadar(): void {
    this.loading = true;
    this.fixedIncomeService.getMarketRadar({
      clase_titulo: this.selectedClase,
      calificacion_riesgo: this.selectedRating,
      search: this.searchTerm
    }).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.status === 'success') {
          this.latestDate = res.data.latest_date;
          this.kpis = res.data.kpis;
          this.instruments = res.data.instruments;
          this.filteredInstruments = [...this.instruments];
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Error cargando Radar de Renta Fija:', err);
      }
    });
  }

  loadPortfolio(): void {
    this.fixedIncomeService.getUserPortfolio({
      clase_titulo: this.portfolioClaseFilter,
      include_expired: this.includeExpired
    }).subscribe({
      next: (res) => {
        if (res.status === 'success') {
          this.portfolioSummary = res.data.summary;
          this.portfolioHoldings = res.data.holdings;
        }
      },
      error: (err) => {
        console.error('Error cargando Portafolio de Renta Fija:', err);
      }
    });
  }

  onSearch(): void {
    this.loadMarketRadar();
  }

  setTab(tab: 'MERCADO' | 'PORTAFOLIO'): void {
    this.activeTab = tab;
  }

  setViewMode(mode: 'CARDS' | 'TABLE'): void {
    this.viewMode = mode;
  }

  getRatingSeverity(rating: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    if (!rating) return 'secondary';
    const r = rating.toUpperCase();
    if (r.startsWith('AAA')) return 'success';
    if (r.startsWith('AA')) return 'info';
    if (r.startsWith('A')) return 'warning';
    return 'danger';
  }

  getGainSeverity(usd: number): string {
    if (usd > 0) return 'text-success font-bold';
    if (usd < 0) return 'text-danger font-bold';
    return 'text-muted';
  }

  get portfolioTotalCapital(): number {
    return this.portfolioHoldings.reduce((sum, item) => sum + (item.capital_invertido || 0), 0);
  }

  get portfolioTotalM2M(): number {
    return this.portfolioHoldings.reduce((sum, item) => sum + (item.valor_mercado_actual || 0), 0);
  }

  get portfolioTotalGainUsd(): number {
    return this.portfolioHoldings.reduce((sum, item) => sum + (item.ganancia_no_realizada_usd || 0), 0);
  }

  get portfolioTotalGainPct(): number {
    const cap = this.portfolioTotalCapital;
    return cap > 0 ? (this.portfolioTotalGainUsd / cap) * 100 : 0;
  }

  openHoldingDetail(holding: FixedIncomePortfolioHolding, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedHolding = holding;
    this.detailDialogVisible = true;
    this.loadingDetail = true;
    this.investmentDetail = null;
    this.customVectorInput = holding.codigo_titulo_vector || '';

    this.fixedIncomeService.getInvestmentDetail(holding.id_inversion).subscribe({
      next: (res) => {
        this.loadingDetail = false;
        if (res.status === 'success') {
          this.investmentDetail = res.data;
          this.customVectorInput = res.data.inversion.codigo_titulo_vector;
        }
      },
      error: (err) => {
        this.loadingDetail = false;
        console.error('Error cargando detalle de inversión:', err);
      }
    });
  }

  applyVectorSuggestion(idInstrumento: number, codigoVector: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!idInstrumento || !codigoVector) return;

    this.updatingVector = true;
    this.fixedIncomeService.updateVectorCode(idInstrumento, codigoVector).subscribe({
      next: (res) => {
        this.updatingVector = false;
        if (res.status === 'success') {
          // Recargar el portafolio y el detalle si está abierto
          this.loadPortfolio();
          if (this.selectedHolding) {
            this.openHoldingDetail(this.selectedHolding);
          }
        }
      },
      error: (err) => {
        this.updatingVector = false;
        console.error('Error actualizando código de vector:', err);
      }
    });
  }

  saveCustomVectorCode(idInstrumento: number): void {
    if (!this.customVectorInput || !idInstrumento) return;
    this.applyVectorSuggestion(idInstrumento, this.customVectorInput.trim());
  }
}
