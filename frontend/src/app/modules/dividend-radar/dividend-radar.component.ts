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

  // Modal de ChatGPT / IA
  displayChatGPTModal: boolean = false;
  selectedStockForAI: any = null;
  aiPrompt: string = '';
  chatGptUrl: string = '';
  aiResponseResult: string = '';
  loadingAI: boolean = false;
  copiedPromptToast: boolean = false;

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

  generarPromptLocal(item: any): string {
    const emisor = item.emisor || 'Emisor';
    const precio = item.precio_mercado || item.precio_ultimo || 0;
    const ultimoDiv = item.ultimo_dividendo_acc || item.dividendo_por_accion || 0;
    const divD1 = item.dividendo_proyectado_d1 || Number((ultimoDiv * 1.03).toFixed(4));
    const yieldPct = item.yield_pct || item.dividend_yield_pct || 0;
    const consistencia = item.estrellas_consistencia || 0;
    const mesPago = item.mes_probable_pago || 'Marzo';
    const precioGordon = item.precio_teorico_gordon || (divD1 > 0 ? Number((divD1 / (0.10 - 0.03)).toFixed(2)) : 0);
    const margenReval = item.margen_oportunidad_pct || 0;
    const totalDivs = item.total_dividendos_registrados || 0;
    const precioAnt = item.precio_anterior || Number((precio * 0.99).toFixed(2));
    const variacionPct = item.variacion_porcentaje || 0.40;
    const sma5 = item.sma5 || precio;
    const sma20 = item.sma20 || Number((precio * 0.98).toFixed(2));
    const volRel = item.volumen_relativo || 0.50;
    const diasInactividad = item.dias_inactividad || 0;
    const senalesList = Array.isArray(item.senales) ? item.senales.join(', ') : 'Normal';

    const califRiesgo = item.calificacion_riesgo;
    const calificadora = item.calificadora_riesgo;
    const ratingTxt = califRiesgo ? `• Calificación de Riesgo Crediticio Oficial: ${califRiesgo}` + (calificadora ? ` (Calificadora: ${calificadora})` : '') + `\n` : '';

    const esPortafolio = item.cantidad_actual !== undefined || item.persona !== undefined || item.costo_promedio !== undefined;

    if (esPortafolio) {
      const cant = new Intl.NumberFormat('en-US').format(item.cantidad_actual || 0);
      const costoProm = this.formatMoney(item.costo_promedio || 0);
      const capInvertido = this.formatMoney(item.capital_invertido || 0);
      const valMercado = this.formatMoney(item.valor_mercado || (precio * (item.cantidad_actual || 1)));
      const ganPerdVal = item.ganancia_perdida || 0;
      const ganPerdStr = this.formatMoney(ganPerdVal);
      const rawCap = item.capital_invertido || 0;
      const ganPerdPct = rawCap > 0 ? ((ganPerdVal / rawCap) * 100).toFixed(2) : '0.00';
      const persona = item.persona || 'Mi Portafolio';
      const divsRecibidos = this.formatMoney(item.div_efectivo_recibido || 0);
      const ingAnualEst = this.formatMoney(item.ingreso_anual_estimado_usd || 0);

      return `Actúa como un experto analista financiero sénior y gestor de portafolios del Mercado de Valores de Ecuador (Bolsas de Valores de Quito y Guayaquil).\n\n` +
        `Por favor evalúa la posición actual que mantengo en mi portafolio de inversión para la acción '${emisor}' y proporciona una recomendación profesional sobre si debo COMPRAR MÁS ACCIONES, MANTENER LA POSICIÓN o VENDER (total o parcialmente):\n\n` +
        `💼 DATOS DE MI POSICIÓN EN PORTAFOLIO (${emisor}):\n` +
        `• Titular / Cuenta: ${persona}\n` +
        `• Cantidad de Acciones Mantenidas: ${cant} acciones\n` +
        `• Precio Costo Promedio de Compra: ${costoProm}/acción\n` +
        `• Precio de Cotización Actual en Bolsa: $${precio}/acción\n` +
        `• Capital Total Invertido: ${capInvertido}\n` +
        `• Valor Actual de Mercado de la Posición: ${valMercado}\n` +
        `• Ganancia / Pérdida No Realizada: ${ganPerdStr} (${ganPerdPct}%)\n` +
        `• Dividendos en Efectivo Cobrados Históricamente: ${divsRecibidos}\n` +
        `• Ingreso Anual Estimado por Dividendos: ${ingAnualEst}/año\n\n` +
        `📊 MÉTRICAS TÉCNICAS Y DE VALORACIÓN DEL MERCADO:\n` +
        ratingTxt +
        `• Dividend Yield Actual: ${yieldPct}% Anual\n` +
        `• Dividendo Proyectado (D1): $${divD1}/acción (Último pagado: $${ultimoDiv})\n` +
        `• Valor Justo Intrínseco Teórico (Gordon DDM P0): $${precioGordon}/acción\n` +
        `• Margen de Oportunidad de Revalorización: ${margenReval}%\n` +
        `• Consistencia Histórica: ${consistencia} de 5 años pagando dividendos continuos\n` +
        `• Mes Estimado de Cobro: ${mesPago}\n` +
        `• Promedios Móviles: SMA 5 = $${sma5} | SMA 20 = $${sma20}\n` +
        `• Volumen Relativo: ${volRel} | Inactividad: ${diasInactividad} días\n\n` +
        `📝 REQUERIMIENTO DE ESTRATEGIA DE PORTAFOLIO:\n` +
        `1. Veredicto y Recomendación de Acción Directa (Opciones claras: COMPRAR MÁS / MANTENER / VENDER TOTAL O PARCIALMENTE).\n` +
        `2. Análisis del Precio Costo Promedio de Compra vs Cotización Actual y Dividend Yield generado.\n` +
        `3. Evaluación de si el Flujo Pasivo de Dividendos justifica conservar la posición o tomar ganancias/pérdidas.\n` +
        `4. Riesgos o Factores Clave del Mercado Ecuatoriano para decidir la venta o ampliación de la posición.\n` +
        `Responde en un formato ejecutivo, claro y estructurado con recomendaciones accionables.`;
    }

    return `Actúa como un experto analista financiero sénior y asesor de inversiones del Mercado de Valores de Ecuador (Bolsas de Valores de Quito y Guayaquil). Por favor analiza los siguientes datos cuantitativos y métricas de dividendo de la empresa emisora '${emisor}' y genera una recomendación profesional sobre la conveniencia de COMPRAR esta acción:\n\n` +
      `📊 INFORMACIÓN TÉCNICA Y FINANCIERA DE LA ACCIÓN (${emisor}):\n` +
      `• Precio de Cierre Actual: $${precio}/acción\n` +
      ratingTxt +
      `• Variación Reciente: +${variacionPct}%\n` +
      `• Precio Anterior: $${precioAnt}\n` +
      `• Último Dividendo Pagado: $${ultimoDiv}/acción\n` +
      `• Dividendo Proyectado (D1): $${divD1}/acción\n` +
      `• Dividend Yield (Rendimiento por Dividendo): ${yieldPct}% Anual\n` +
      `• Consistencia Histórica: ${consistencia} de 5 años pagando dividendos consecutivos\n` +
      `• Mes de Mayor Probabilidad de Pago: ${mesPago}\n` +
      `• Valor Justo Intrínseco Teórico (Gordon DDM P0): $${precioGordon}/acción\n` +
      `• Margen de Oportunidad de Revalorización: ${margenReval}%\n` +
      `• Histórico de Dividendos Registrados: ${totalDivs} pagos realizados\n` +
      `• Promedios Móviles: SMA 5 = $${sma5} | SMA 20 = $${sma20}\n` +
      `• Volumen Relativo (VR): ${volRel} | Inactividad: ${diasInactividad} días\n` +
      `• Señales Detectadas: ${senalesList}\n\n` +
      `📝 REQUERIMIENTO DE ANÁLISIS:\n` +
      `1. Veredicto y Recomendación Clara (Opciones: COMPRAR / MANTENER / ESPERAR UN MEJOR PRECIO).\n` +
      `2. Análisis de Atractivo por Dividend Yield vs Valor Justo Gordon.\n` +
      `3. Principales Riesgos o Factores a Considerar en el Mercado Ecuatoriano.\n` +
      `Responde en un formato ejecutivo, claro y estructurado con puntos clave.`;
  }

  abrirChatGPTModal(item: any): void {
    this.selectedStockForAI = item;
    this.displayChatGPTModal = true;
    this.loadingAI = false;
    this.copiedPromptToast = false;
    this.aiResponseResult = '';

    // Asignación inmediata del prompt para evitar que aparezca el cuadro en blanco
    this.aiPrompt = this.generarPromptLocal(item);
    this.chatGptUrl = 'https://chatgpt.com/?q=' + encodeURIComponent(this.aiPrompt);

    this.radarService.analizarConIA(item).subscribe({
      next: (res) => {
        if (res.success && res.prompt) {
          this.aiPrompt = res.prompt;
          this.chatGptUrl = res.chatgpt_url || ('https://chatgpt.com/?q=' + encodeURIComponent(res.prompt));
          if (res.ai_response) {
            this.aiResponseResult = res.ai_response;
          }
        }
      },
      error: (err) => {
        console.error('Error al solicitar análisis backend de ChatGPT, usando prompt local:', err);
      }
    });
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
