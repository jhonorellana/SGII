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
import { ChartModule } from 'primeng/chart';
import { 
  FixedIncomeRadarService, 
  FixedIncomeMarketInstrument, 
  FixedIncomeKPIs, 
  FixedIncomePortfolioHolding, 
  InvestmentDetailResponse,
  FixedIncomeCurvePoint,
  FixedIncomeCurveMilestone,
  FixedIncomePortfolioCurvePoint,
  FixedIncomeCurveResponse
} from '../../core/fixed-income-radar.service';

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
    DialogModule,
    ChartModule
  ],
  templateUrl: './fixed-income-radar.component.html',
  styleUrl: './fixed-income-radar.component.css'
})
export class FixedIncomeRadarComponent implements OnInit {
  activeTab: 'MERCADO' | 'PORTAFOLIO' | 'CURVA' = 'MERCADO';
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

  // Datos Curva de Rendimiento Cero Cupón
  curveLoading: boolean = false;
  selectedCurveDate: string = '';
  availableCurveDates: Array<{ label: string; value: string }> = [];
  selectedHorizonDays: number = 3600; // Por defecto 10 años (óptimo para visualizar el 100% de títulos sin comprimir)

  curveData: FixedIncomeCurveResponse['data'] | null = null;
  curveChartData: any = null;
  curveChartOptions: any = null;
  curveSearchTerm: string = '';
  curveSpreadFilter: 'TODOS' | 'SOBRE' | 'BAJO' = 'TODOS';

  horizonOptions = [
    { label: '1 Año', value: 360, desc: 'Corto Plazo (360 días)' },
    { label: '3 Años', value: 1080, desc: 'Mediano Plazo (1080 días)' },
    { label: '5 Años', value: 1800, desc: 'Institucional (1800 días)' },
    { label: '10 Años', value: 3600, desc: 'Recomendado Cartera (3600 días)' },
    { label: '30 Años', value: 10800, desc: 'Curva Completa BVQ (10800 días)' }
  ];

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

  loadYieldCurve(): void {
    this.curveLoading = true;
    this.fixedIncomeService.getYieldCurve({
      fecha_vector: this.selectedCurveDate || undefined,
      max_plazo_dias: this.selectedHorizonDays
    }).subscribe({
      next: (res) => {
        this.curveLoading = false;
        if (res.status === 'success') {
          this.curveData = res.data;
          this.selectedCurveDate = res.data.fecha_vector;
          if (res.data.fechas_disponibles && res.data.fechas_disponibles.length > 0) {
            this.availableCurveDates = res.data.fechas_disponibles.map(f => ({
              label: `Vector BVQ: ${f}`,
              value: f
            }));
          }
          this.setupCurveChart();
        }
      },
      error: (err) => {
        this.curveLoading = false;
        console.error('Error cargando Curva de Rendimiento:', err);
      }
    });
  }

  setupCurveChart(): void {
    if (!this.curveData) return;

    const curvePoints = this.curveData.puntos_curva.map(p => ({ x: p.x, y: p.y }));
    const positions = this.curveData.posiciones_portafolio;

    const sobreCurvaPoints = positions
      .filter(p => p.estado === 'SOBRE_CURVA')
      .map(p => ({
        x: p.x,
        y: p.y,
        instrumento: p.nombre_instrumento,
        emisor: p.nombre_emisor,
        rating: p.calificacion_riesgo,
        capital: p.capital_invertido,
        benchmark: p.benchmark_tir,
        spread: p.spread_bps
      }));

    const bajoCurvaPoints = positions
      .filter(p => p.estado === 'BAJO_CURVA')
      .map(p => ({
        x: p.x,
        y: p.y,
        instrumento: p.nombre_instrumento,
        emisor: p.nombre_emisor,
        rating: p.calificacion_riesgo,
        capital: p.capital_invertido,
        benchmark: p.benchmark_tir,
        spread: p.spread_bps
      }));

    this.curveChartData = {
      datasets: [
        {
          type: 'line',
          label: 'Curva Cupón Cero BVQ (Mercado)',
          data: curvePoints,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          order: 3,
          datalabels: { display: false }
        },
        {
          type: 'scatter',
          label: `Tus Inversiones Sobre Curva (${sobreCurvaPoints.length})`,
          data: sobreCurvaPoints,
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: '#059669',
          borderWidth: 1.5,
          pointRadius: 6,
          pointHoverRadius: 9,
          order: 1,
          datalabels: { display: false }
        },
        {
          type: 'scatter',
          label: `Tus Inversiones Bajo Curva (${bajoCurvaPoints.length})`,
          data: bajoCurvaPoints,
          backgroundColor: 'rgba(245, 158, 11, 0.85)',
          borderColor: '#d97706',
          borderWidth: 1.5,
          pointRadius: 6,
          pointHoverRadius: 9,
          order: 2,
          datalabels: { display: false }
        }
      ]
    };

    this.curveChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: true
      },
      plugins: {
        datalabels: {
          display: false
        },
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: {
              size: 13,
              weight: '600',
              family: "'Inter', sans-serif"
            },
            padding: 20
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#ffffff',
          titleFont: { size: 13, weight: 'bold' },
          bodyColor: '#e2e8f0',
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          boxPadding: 4,
          callbacks: {
            title: (items: any[]) => {
              const item = items[0];
              if (item.datasetIndex === 0) {
                const dias = item.parsed.x;
                return `Curva Cero Cupón BVQ (${dias} días / ${(dias / 360).toFixed(1)} años)`;
              }
              const raw = item.raw;
              return raw?.instrumento || `Plazo: ${item.parsed.x} días`;
            },
            label: (context: any) => {
              if (context.datasetIndex === 0) {
                return `TIR Mercado BVQ: ${context.parsed.y.toFixed(2)}%`;
              }
              const raw = context.raw;
              const lines: string[] = [];
              if (raw?.emisor) lines.push(`Emisor: ${raw.emisor}`);
              if (raw?.rating && raw.rating !== '-') lines.push(`Rating: [${raw.rating}]`);
              lines.push(`Tasa Inversión: ${context.parsed.y.toFixed(2)}%`);
              if (raw?.benchmark !== undefined) lines.push(`TIR Curva BVQ: ${raw.benchmark.toFixed(2)}%`);
              if (raw?.spread !== undefined) {
                const sign = raw.spread >= 0 ? '+' : '';
                lines.push(`Spread: ${sign}${raw.spread} bps (${raw.spread >= 0 ? 'Prima a favor' : 'Descuento'})`);
              }
              if (raw?.capital) {
                lines.push(`Saldo Capital: $${Number(raw.capital).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
              }
              lines.push(`Plazo Remanente: ${context.parsed.x} días (~${(context.parsed.x / 360).toFixed(1)} años)`);
              return lines;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          suggestedMax: this.selectedHorizonDays,
          title: {
            display: true,
            text: 'Plazo al Vencimiento (Días / Años)',
            font: { size: 13, weight: 'bold' },
            color: '#475569'
          },
          grid: {
            color: 'rgba(226, 232, 240, 0.7)'
          },
          ticks: {
            callback: (val: any) => {
              const dias = Number(val);
              if (dias === 0) return '0d';
              if (dias < 360) return `${dias}d`;
              const anos = (dias / 360).toFixed(1).replace('.0', '');
              return `${dias}d (${anos}A)`;
            },
            color: '#64748b'
          }
        },
        y: {
          min: 0,
          suggestedMax: 16,
          title: {
            display: true,
            text: 'TIR / Rendimiento (%)',
            font: { size: 13, weight: 'bold' },
            color: '#475569'
          },
          grid: {
            color: 'rgba(226, 232, 240, 0.7)'
          },
          ticks: {
            stepSize: 2,
            callback: (val: any) => `${val}%`,
            color: '#64748b'
          }
        }
      }
    };
  }

  onCurveDateChange(): void {
    this.loadYieldCurve();
  }

  setCurveHorizon(days: number): void {
    this.selectedHorizonDays = days;
    this.loadYieldCurve();
  }

  setCurveSpreadFilter(filter: 'TODOS' | 'SOBRE' | 'BAJO'): void {
    this.curveSpreadFilter = filter;
  }

  get filteredCurvePositions(): FixedIncomePortfolioCurvePoint[] {
    if (!this.curveData?.posiciones_portafolio) return [];
    let list = this.curveData.posiciones_portafolio;
    if (this.curveSpreadFilter === 'SOBRE') {
      list = list.filter(p => p.estado === 'SOBRE_CURVA');
    } else if (this.curveSpreadFilter === 'BAJO') {
      list = list.filter(p => p.estado === 'BAJO_CURVA');
    }
    if (this.curveSearchTerm && this.curveSearchTerm.trim()) {
      const q = this.curveSearchTerm.toLowerCase().trim();
      list = list.filter(p =>
        (p.nombre_instrumento || '').toLowerCase().includes(q) ||
        (p.nombre_emisor || '').toLowerCase().includes(q) ||
        (p.calificacion_riesgo || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  onSearch(): void {
    this.loadMarketRadar();
  }

  setTab(tab: 'MERCADO' | 'PORTAFOLIO' | 'CURVA'): void {
    this.activeTab = tab;
    if (tab === 'CURVA' && !this.curveData) {
      this.loadYieldCurve();
    }
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
