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
  FixedIncomeCurveResponse,
  FixedIncomeCountdownHolding,
  FixedIncomeUpcomingPayment,
  FixedIncomeMaturityAlertsResponse
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
  activeTab: 'MERCADO' | 'PORTAFOLIO' | 'CURVA' | 'ALERTAS' = 'MERCADO';
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

  // Modal Recomendación con ChatGPT (IA)
  displayChatGPTModal: boolean = false;
  selectedItemForAI: any = null;
  loadingAI: boolean = false;
  copiedPromptToast: boolean = false;
  aiPrompt: string = '';
  chatGptUrl: string = '';
  aiResponseResult: string = '';

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

  // Datos Centro de Alertas y Conteo Regresivo (Opción B)
  alertsLoading: boolean = false;
  alertsData: FixedIncomeMaturityAlertsResponse['data'] | null = null;
  countdownSearchTerm: string = '';
  countdownUrgencyFilter: 'TODOS' | 'CRITICA' | 'ALTA' | 'MEDIA' = 'TODOS';
  paymentsSearchTerm: string = '';
  paymentsFilter: 'TODOS' | 'HOY' | 'SEMANA' | 'MES' | 'TRIMESTRE' = 'TODOS';

  constructor(private fixedIncomeService: FixedIncomeRadarService) {}

  ngOnInit(): void {
    this.loadMarketRadar();
    this.loadPortfolio();
    this.loadMaturityAlerts();
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

  setTab(tab: 'MERCADO' | 'PORTAFOLIO' | 'CURVA' | 'ALERTAS'): void {
    this.activeTab = tab;
    if (tab === 'CURVA' && !this.curveData) {
      this.loadYieldCurve();
    } else if (tab === 'ALERTAS' && !this.alertsData) {
      this.loadMaturityAlerts();
    }
  }

  loadMaturityAlerts(): void {
    this.alertsLoading = true;
    this.fixedIncomeService.getMaturityAlerts().subscribe({
      next: (res) => {
        this.alertsLoading = false;
        if (res.status === 'success') {
          this.alertsData = res.data;
        }
      },
      error: (err) => {
        this.alertsLoading = false;
        console.error('Error cargando Alertas de Vencimiento:', err);
      }
    });
  }

  get filteredCountdownHoldings(): FixedIncomeCountdownHolding[] {
    if (!this.alertsData?.titulos_conteo_regresivo) return [];
    let list = this.alertsData.titulos_conteo_regresivo;
    if (this.countdownUrgencyFilter !== 'TODOS') {
      list = list.filter(h => h.urgencia === this.countdownUrgencyFilter);
    }
    if (this.countdownSearchTerm && this.countdownSearchTerm.trim()) {
      const q = this.countdownSearchTerm.toLowerCase().trim();
      list = list.filter(h => 
        (h.nombre_instrumento || '').toLowerCase().includes(q) ||
        (h.nombre_emisor || '').toLowerCase().includes(q) ||
        (h.calificacion_riesgo || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  get filteredUpcomingPayments(): FixedIncomeUpcomingPayment[] {
    if (!this.alertsData?.cuotas_proximas) return [];
    let list = this.alertsData.cuotas_proximas;
    if (this.paymentsFilter === 'HOY') {
      list = list.filter(p => p.urgencia_pago === 'HOY');
    } else if (this.paymentsFilter === 'SEMANA') {
      list = list.filter(p => p.urgencia_pago === 'HOY' || p.urgencia_pago === 'SEMANA');
    } else if (this.paymentsFilter === 'MES') {
      list = list.filter(p => p.urgencia_pago === 'HOY' || p.urgencia_pago === 'SEMANA' || p.urgencia_pago === 'MES');
    } else if (this.paymentsFilter === 'TRIMESTRE') {
      list = list.filter(p => p.urgencia_pago !== 'SEMESTRE');
    }
    if (this.paymentsSearchTerm && this.paymentsSearchTerm.trim()) {
      const q = this.paymentsSearchTerm.toLowerCase().trim();
      list = list.filter(p => 
        (p.nombre_instrumento || '').toLowerCase().includes(q) ||
        (p.nombre_emisor || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  get filteredPaymentsTotalLiquidity(): number {
    return this.filteredUpcomingPayments.reduce((acc, curr) => acc + curr.total_cobro, 0);
  }

  getUrgencyBadgeClass(urgencia: string): string {
    switch (urgencia) {
      case 'CRITICA': return 'bg-danger text-white';
      case 'ALTA': return 'bg-warning text-dark';
      case 'MEDIA': return 'bg-info text-dark';
      default: return 'bg-success-subtle text-success border border-success-subtle';
    }
  }

  getUrgencyLabel(urgencia: string): string {
    switch (urgencia) {
      case 'CRITICA': return 'Inminente (< 30d)';
      case 'ALTA': return 'Próximo (31 - 90d)';
      case 'MEDIA': return 'Mediano Plazo (91 - 180d)';
      default: return 'Vigente (> 180d)';
    }
  }

  getPaymentUrgencyBadgeClass(urgencia: string): string {
    switch (urgencia) {
      case 'HOY': return 'bg-danger text-white fw-bold';
      case 'SEMANA': return 'bg-warning text-dark fw-bold';
      case 'MES': return 'bg-primary-subtle text-primary border border-primary-subtle';
      default: return 'bg-light text-muted border';
    }
  }

  openHoldingDetailById(idInversion: number, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedHolding = { id_inversion: idInversion } as any;
    this.detailDialogVisible = true;
    this.loadingDetail = true;
    this.investmentDetail = null;

    this.fixedIncomeService.getInvestmentDetail(idInversion).subscribe({
      next: (res) => {
        this.loadingDetail = false;
        if (res.status === 'success') {
          this.investmentDetail = res.data;
          this.customVectorInput = res.data.inversion.codigo_titulo_vector || '';
        }
      },
      error: (err) => {
        this.loadingDetail = false;
        console.error('Error cargando detalle de inversión:', err);
      }
    });
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

  // ==========================================
  // RECOMENDACIÓN CON CHATGPT (IA) - RENTA FIJA
  // ==========================================
  abrirChatGPTModal(item: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedItemForAI = item;
    this.displayChatGPTModal = true;
    this.loadingAI = false;
    this.copiedPromptToast = false;
    this.aiResponseResult = '';

    // Asignación inmediata del prompt para evitar cuadro en blanco
    this.aiPrompt = this.generarPromptLocal(item);
    this.chatGptUrl = 'https://chatgpt.com/?q=' + encodeURIComponent(this.aiPrompt);

    // Enriquecer en backend con cruce de curva cero cupón, spread oficial y llamada a IA si está configurada
    this.loadingAI = true;
    this.fixedIncomeService.analizarConIa(item).subscribe({
      next: (res) => {
        this.loadingAI = false;
        if (res.success && res.prompt) {
          this.aiPrompt = res.prompt;
          this.chatGptUrl = res.chatgpt_url || ('https://chatgpt.com/?q=' + encodeURIComponent(res.prompt));
          if (res.ai_response) {
            this.aiResponseResult = res.ai_response;
          }
        }
      },
      error: (err) => {
        this.loadingAI = false;
        console.error('Error al solicitar análisis backend de ChatGPT, usando prompt local:', err);
      }
    });
  }

  generarPromptLocal(item: any): string {
    const emisor = item.nombre_emisor || item.nemo_emisor || item.emisor || 'Emisor';
    const instrumento = item.nombre_instrumento || item.clase_titulo || 'Instrumento de Renta Fija';
    const codigoVector = item.codigo_titulo_vector || 'N/A';
    const rating = item.calificacion_riesgo || 'AAA';
    const plazoDias = item.plazo_dias_remanentes || item.dias_remanentes || item.plazo_dias || 0;
    const plazoAnios = plazoDias > 0 ? (plazoDias / 360).toFixed(1) : '0';
    const fechaVenc = item.fecha_vencimiento || 'N/A';

    const esPortafolio = !!(item.id_inversion || item.capital_invertido || item.saldo_capital || item.capital_vigente);

    if (esPortafolio) {
      const capital = Number(item.capital_invertido || item.saldo_capital || item.capital_vigente || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
      const precioCompra = Number(item.precio_compra_porcentaje || 100).toFixed(2);
      const precioVector = Number(item.precio_vector_porcentaje || item.precio_porcentaje || precioCompra).toFixed(2);
      const valMercado = Number(item.valor_mercado_actual || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
      const gananciaUsd = Number(item.ganancia_no_realizada_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
      const gananciaPct = Number(item.ganancia_no_realizada_pct || 0).toFixed(2);
      const tasaCupon = Number(item.tasa_cupon_compra || item.tasa_cupon || 0).toFixed(2);
      const tirVector = Number(item.tir_vector || item.tasa_descuento_tir || tasaCupon).toFixed(2);
      const propietario = item.propietario_nombre || 'Mi Portafolio';

      return `Actúa como un experto analista financiero sénior y gestor de portafolios de Renta Fija del Mercado de Valores de Ecuador (Bolsa de Valores de Quito BVQ y Bolsa de Valores de Guayaquil BVG).\n\n` +
        `Por favor evalúa la posición de Renta Fija que mantengo en mi portafolio para el título '${emisor}' y proporciona una recomendación profesional sobre si debo MANTENER LA POSICIÓN HASTA EL VENCIMIENTO para continuar cobrando los cupones periódicos y el capital, o VENDER ANTICIPADAMENTE EN EL MERCADO SECUNDARIO a la cotización actual del vector de precios para realizar la ganancia de capital y rebalancear mi liquidez:\n\n` +
        `💼 DATOS DE MI POSICIÓN EN PORTAFOLIO (${emisor}):\n` +
        `• Título / Instrumento: ${instrumento}\n` +
        `• Código ISIN/BVQ Oficial: ${codigoVector}\n` +
        `• Titular / Cuenta: ${propietario}\n` +
        `• Calificación de Riesgo Crediticio: ${rating}\n` +
        `• Saldo Capital Vigente Invertido: $${capital} USD\n` +
        `• Precio de Adquisición: ${precioCompra}%\n` +
        `• Precio de Mercado Actual (Vector BVQ): ${precioVector}%\n` +
        `• Valor de Mercado Actual M2M: $${valMercado} USD\n` +
        `• Plusvalía / Minusvalía de Capital No Realizada: $${gananciaUsd} USD (${gananciaPct}%)\n` +
        `• Tasa Cupón Nominal Pactada: ${tasaCupon}% Anual\n` +
        `• TIR a Precios de Mercado (Vector BVQ): ${tirVector}% Anual\n` +
        `• Plazo Remanente al Vencimiento: ${plazoDias} días (~${plazoAnios} años)\n` +
        `• Fecha de Vencimiento Definitivo: ${fechaVenc}\n\n` +
        `📝 REQUERIMIENTO DE ESTRATEGIA DE PORTAFOLIO:\n` +
        `1. Veredicto y Recomendación de Acción Directa: MANTENER HASTA EL VENCIMIENTO vs. VENDER EN BOLSA HOY (tomar plusvalía) vs. REBALANCEAR.\n` +
        `2. Análisis Financiero Comparativo: ¿Es más rentable realizar la plusvalía no realizada de $${gananciaUsd} hoy en bolsa, o seguir cobrando el flujo de cupones del ${tasaCupon}% durante los próximos ${plazoDias} días?\n` +
        `3. Evaluación del Riesgo Crediticio vs. Plazo: Análisis de la solvencia del emisor (${rating}) frente al tiempo remanente (${plazoDias} días).\n` +
        `4. Costo de Oportunidad frente a alternativas de inversión actuales en el mercado ecuatoriano.\n` +
        `Responde en un formato ejecutivo, profesional, claro y con pasos accionables.`;
    } else {
      const precioVector = Number(item.precio_porcentaje || 100).toFixed(2);
      const tirVector = Number(item.tasa_descuento_tir || 0).toFixed(2);
      const tasaCupon = Number(item.tasa_cupon || 0).toFixed(2);
      const claseTitulo = item.clase_titulo || 'Instrumento de Renta Fija';

      return `Actúa como un experto analista financiero sénior y asesor de inversiones de Renta Fija del Mercado de Valores de Ecuador (Bolsa de Valores de Quito BVQ y Bolsa de Valores de Guayaquil BVG).\n\n` +
        `Por favor analiza el siguiente instrumento de deuda cotizado en el Vector de Precios Oficial de la BVQ para el emisor '${emisor}' y genera una recomendación profesional sobre si es una OPORTUNIDAD ATRACTIVA DE COMPRA / INVERSIÓN en el mercado secundario:\n\n` +
        `📊 FICHA TÉCNICA Y VALORACIÓN DE MERCADO (${emisor}):\n` +
        `• Clase de Título: ${claseTitulo}\n` +
        `• Código ISIN/BVQ Oficial: ${codigoVector}\n` +
        `• Calificación de Riesgo Crediticio: ${rating}\n` +
        `• Precio Porcentaje de Mercado (Vector BVQ): ${precioVector}%\n` +
        `• Rendimiento / TIR de Mercado: ${tirVector}% Anual\n` +
        `• Tasa Cupón Nominal: ${tasaCupon}% Anual\n` +
        `• Plazo Remanente al Vencimiento: ${plazoDias} días (~${plazoAnios} años)\n` +
        `• Fecha de Vencimiento: ${fechaVenc}\n\n` +
        `📝 REQUERIMIENTO DE ANÁLISIS DE INVERSIÓN:\n` +
        `1. Veredicto y Recomendación de Inversión: COMPRAR / INVERTIR vs. ESPERAR MEJOR TASA/PRECIO vs. DESCARTAR POR RIESGO.\n` +
        `2. Análisis del Rendimiento TIR (${tirVector}%) vs. Cupón Nominal (${tasaCupon}%) y Precio (${precioVector}%).\n` +
        `3. Evaluación de Solvencia y Calidad Crediticia: ¿La calificación ${rating} compensa adecuadamente el plazo remanente de ${plazoDias} días?\n` +
        `4. Recomendación accionable para un inversionista ecuatoriano.\n` +
        `Responde en un formato ejecutivo, profesional, conciso y fundamentado con criterios cuantitativos.`;
    }
  }

  abrirEnChatGPTCom(): void {
    if (this.chatGptUrl) {
      window.open(this.chatGptUrl, '_blank');
    } else if (this.aiPrompt) {
      const url = 'https://chatgpt.com/?q=' + encodeURIComponent(this.aiPrompt);
      window.open(url, '_blank');
    }
  }

  copiarPromptAlPortapapeles(): void {
    if (this.aiPrompt) {
      navigator.clipboard.writeText(this.aiPrompt).then(() => {
        this.copiedPromptToast = true;
        setTimeout(() => this.copiedPromptToast = false, 3000);
      });
    }
  }

  cerrarChatGPTModal(): void {
    this.displayChatGPTModal = false;
  }
}
