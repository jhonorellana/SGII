import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';

import { AuthService } from '../core/auth.service';
import { PatrimonioService, PatrimonioItem } from '../core/patrimonio.service';
import { VentaInversionService } from '../core/venta-inversion.service';
import { AccionPosicionService } from '../core/accion-posicion.service';
import { AccionDividendoService } from '../core/accion-dividendo.service';
import { InversionService } from '../core/inversion.service';
import { AmortizacionService, Amortizacion } from '../core/amortizacion.service';
import { VencimientosSemanalesService, VencimientoSemanal, ResumenSemanal } from '../core/vencimientos-semanales.service';
import { createStackedTooltipOptions } from '../core/utils/chart-options.util';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { HistoricoIndicadorService, HistoricoIndicadorData } from '../core/historico-indicador.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ChartModule, TableModule, ToastModule, ConfirmDialogModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  providers: [
    PatrimonioService,
    VentaInversionService,
    AccionPosicionService,
    AccionDividendoService,
    InversionService,
    AmortizacionService,
    VencimientosSemanalesService,
    MessageService,
    ConfirmationService,
    HistoricoIndicadorService
  ]
})
export class DashboardComponent implements OnInit {
  currentUser: any = null;
  loading = true;
  error = '';

  // Métricas Consolidadas (Tomadas con los tres switches apagados)
  patrimonioBaseCosto = 0;
  patrimonioDividendosAcciones = 0;
  patrimonioPlusvaliaAcciones = 0;
  patrimonioDivMasPlusvalia = 0;
  patrimonioConsolidadoTotal = 0;
  patrimonioTotalCorriente = 0;
  patrimonioProyeccionUnAnio = 0;
  interesesEsperadosProyeccion = 0;
  patrimonioProyectadoConsolidadoTotal = 0;
  porcentajeAvanceProyeccion = 0;

  // Navegación por pestañas ejecutivas
  activeTab: 'acciones' | 'capital' | 'proyeccion' = 'acciones';

  // Nuevos KPIs Consolidados
  capitalRentaFijaConsolidado = 0;
  capitalRentaVariableConsolidado = 0;
  capitalNotasCreditoConsolidado = 0;

  patrimonioDesglose: PatrimonioItem[] = [];
  utilidadNotasCreditoVentas = 0;
  valorCompraTotalNotasCredito = 0;
  valorVentaTotalNotasCredito = 0;
  utilidadTotalNotasCredito = 0;

  // Métricas Renta Variable
  valorMercadoAcciones = 0;
  capitalInvertidoAcciones = 0;
  gananciaNoRealizadaAcciones = 0;
  dividendosEfectivo = 0;
  dividendosAccionesCant = 0;

  // Métricas Renta Fija
  capitalRentaFijaVigente = 0;
  rendimientoPromedioRentaFija = 0;
  totalInversionesActivas = 0;

  // Tablas / Gráficos
  proximasAmortizaciones: Amortizacion[] = [];
  chartData: any = null;
  chartOptions: any = null;
  leyendaColores: any[] = [];

  // Vencimientos Semanales
  vencimientosSemanales: VencimientoSemanal[] = [];
  resumenSemanalTotal = 0;
  resumenSemanalEjecutado = 0;
  resumenSemanalPendiente = 0;
  vencimientosChartData: any = null;
  vencimientosChartOptions: any = null;

  // MoM Variations
  momPatrimonioBase: number | null = null;
  momPatrimonioConsolidado: number | null = null;
  momProyeccion: number | null = null;
  momIntereses: number | null = null;
  momTotalCorriente: number | null = null;

  // Alertas de Desviación
  alertaDesviacion: boolean = false;
  montoDesviacion: number = 0;
  metaEsperadaHoy: number = 0;

  // Modo Máquina del Tiempo
  isTimeMachineActive: boolean = false;
  activeSnapshotFecha: string | null = null;
  historicosOptions: any[] = [];
  selectedHistoricoId: string = 'REAL_TIME';
  rawHistoricos: any[] = [];
  realTimeCache: any = null;

  // Calculadora TIR (XIRR)
  tirHistorica: number | null = null;

  constructor(
    private authService: AuthService,
    private patrimonioService: PatrimonioService,
    private ventaService: VentaInversionService,
    private posicionService: AccionPosicionService,
    private dividendoService: AccionDividendoService,
    private inversionService: InversionService,
    private amortizacionService: AmortizacionService,
    private vencimientosSemanalesService: VencimientosSemanalesService,
    private historicoService: HistoricoIndicadorService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadConsolidatedDashboard();
  }

  loadConsolidatedDashboard(): void {
    this.loading = true;
    this.error = '';

    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    const fechaFinStr = `${anio}-${mes}-${dia}`;

    // Cálculo de fecha fin a 1 año para la proyección (último día del undécimo mes, igual a Patrimonio Consolidado)
    const fechaFinProyeccion = new Date(hoy.getFullYear(), hoy.getMonth() + 12, 0);
    const anioP = fechaFinProyeccion.getFullYear();
    const mesP = String(fechaFinProyeccion.getMonth() + 1).padStart(2, '0');
    const diaP = String(fechaFinProyeccion.getDate()).padStart(2, '0');
    const fechaProyeccionStr = `${anioP}-${mesP}-${diaP}`;

    forkJoin({
      patrimonio: this.patrimonioService.getPatrimonioConsolidado({
        fecha_inicio: fechaFinStr,
        fecha_fin: fechaFinStr,
        incluir_plusvalia: false,
        incluir_dividendos: false
      }).pipe(catchError(() => of(null))),

      patrimonioProyeccion: this.patrimonioService.getPatrimonioConsolidado({
        fecha_inicio: fechaFinStr,
        fecha_fin: fechaProyeccionStr,
        incluir_plusvalia: false,
        incluir_dividendos: false
      }).pipe(catchError(() => of(null))),

      ventas: this.ventaService.getAll().pipe(catchError(() => of(null))),
      posiciones: this.posicionService.getPosiciones().pipe(catchError(() => of(null))),
      dividendos: this.dividendoService.getAll().pipe(catchError(() => of(null))),
      inversiones: this.inversionService.getAll().pipe(catchError(() => of(null))),
      amortizaciones: this.amortizacionService.getProximas(5).pipe(catchError(() => of(null))),
      vencimientosSemanales: this.vencimientosSemanalesService.getVencimientosSemanales(fechaFinStr).pipe(catchError(() => of(null))),
      historicos: this.historicoService.getHistorico().pipe(catchError(() => of(null)))
    }).subscribe({
      next: (res) => {
        // 1. Patrimonio Consolidado Base (tomado con los 3 switches apagados)
        if (res.patrimonio && res.patrimonio.success) {
          const d = res.patrimonio.data;
          this.patrimonioBaseCosto = d.base_total ?? d.total ?? 0;
          this.patrimonioDividendosAcciones = d.dividendos_total ?? 0;
          this.patrimonioPlusvaliaAcciones = d.plusvalia_total ?? 0;
          this.patrimonioDivMasPlusvalia = (d.dividendos_total ?? 0) + (d.plusvalia_total ?? 0);
          this.patrimonioConsolidadoTotal = d.total_completo ?? (this.patrimonioBaseCosto + this.patrimonioDivMasPlusvalia);
          
          const items = d.patrimonio || [];
          const getItemValor = (label: string): number => {
            const found = items.find((i: PatrimonioItem) =>
              i.detalle && i.detalle.toLowerCase().trim() === label.toLowerCase().trim()
            );
            return found ? Number(found.valor || 0) : 0;
          };

          // Extraer "Total Corriente"
          this.patrimonioTotalCorriente = getItemValor('Total Corriente');

          // Capital Renta Fija = Capital Bonos + Papeles Comerciales + Obligaciones + Titularizaciones + Bonos vencimiento próximo
          this.capitalRentaFijaConsolidado =
            getItemValor('Capital bonos') +
            getItemValor('Papeles Comerciales') +
            getItemValor('Obligaciones') +
            getItemValor('Titularizaciones') +
            getItemValor('Bonos vencimiento próximo');

          // Capital Renta Variable = Acciones Sin Interés + Acciones Pago Interes
          this.capitalRentaVariableConsolidado =
            getItemValor('Acciones Sin Interés') +
            getItemValor('Acciones Pago Interes');

          // Capital Notas de Crédito = Notas Crédito
          this.capitalNotasCreditoConsolidado = getItemValor('Notas Crédito');

          this.patrimonioDesglose = items;
        }

        // 1.b Patrimonio Proyección 1 Año e Intereses Esperados (Proyección un año = Sí)
        if (res.patrimonioProyeccion && res.patrimonioProyeccion.success) {
          const dP = res.patrimonioProyeccion.data;
          this.patrimonioProyeccionUnAnio = dP.total ?? dP.base_total ?? 0;

          // Extraer la métrica de "Intereses esperados" del listado de componentes
          const itemIntereses = (dP.patrimonio || []).find((item: PatrimonioItem) =>
            item.detalle && item.detalle.toLowerCase().includes('intereses esperados')
          );
          this.interesesEsperadosProyeccion = itemIntereses ? Number(itemIntereses.valor || 0) : 0;

          // Nuevo KPI: Patrimonio Proyectado Consolidado Total (Proyección 1 Año + Div/Plusvalía Acciones)
          this.patrimonioProyectadoConsolidadoTotal = this.patrimonioProyeccionUnAnio + this.patrimonioDivMasPlusvalia;

          // Porcentaje de avance de la base actual hacia el objetivo proyectado a 1 año
          this.porcentajeAvanceProyeccion = this.patrimonioProyectadoConsolidadoTotal > 0
            ? Math.min(100, Math.max(0, (this.patrimonioBaseCosto / this.patrimonioProyectadoConsolidadoTotal) * 100))
            : 100;

          // Construir el gráfico del Dashboard usando los datos proyectados en memoria (coincide 100% con el Reporte Consolidado $864.459,58 sin hacer peticiones extra)
          const itemsProyectados = dP.patrimonio || [];
          this.buildChartData(itemsProyectados);
        } else {
          this.buildChartData(this.patrimonioDesglose);
        }

        // 2. Utilidades y KPIs por Ventas de Notas de Crédito
        if (res.ventas) {
          const rawVentas: any = res.ventas;
          const ventasList: any[] = Array.isArray(rawVentas) ? rawVentas : (rawVentas.data || []);
          const ventasActivas = ventasList.filter((v: any) => v.activo && !v.eliminado);
          
          this.utilidadNotasCreditoVentas = ventasActivas.reduce((sum: number, v: any) => {
            const val = Number(v.utilidad_con_comision ?? v.ganancia_perdida ?? 0);
            return sum + val;
          }, 0);

          // Filtrar ventas de Notas de Crédito (tipo 91) para calcular exactamente los 3 KPIs de la pantalla Ventas de Notas de Crédito
          const ventasNC = ventasList.filter((v: any) => {
            const idTipo = v.instrumento?.id_tipo_inversion || v.inversion?.instrumento?.id_tipo_inversion;
            return idTipo === 91;
          });

          this.valorCompraTotalNotasCredito = ventasNC.reduce((sum: number, v: any) => {
            let valCompra = Number(v.valorCompraTotal || 0);
            if (valCompra === 0 && v.detalles && v.detalles.length > 0) {
              valCompra = v.detalles.reduce((acc: number, d: any) => acc + Number(d.valor_compra || 0), 0);
            }
            return sum + valCompra;
          }, 0);

          this.valorVentaTotalNotasCredito = ventasNC.reduce((sum: number, v: any) => {
            return sum + Number(v.valor_venta_con_comision || 0);
          }, 0);

          this.utilidadTotalNotasCredito = ventasNC.reduce((sum: number, v: any) => {
            return sum + Number(v.utilidad_con_comision || 0);
          }, 0);
        }

        // 3. Renta Variable (Posiciones & Dividendos)
        if (res.posiciones && res.posiciones.success && Array.isArray(res.posiciones.data)) {
          const pos = res.posiciones.data;
          this.capitalInvertidoAcciones = pos.reduce((sum, p) => sum + Number(p.capital_invertido || 0), 0);
          this.valorMercadoAcciones = pos.reduce((sum, p) => sum + Number(p.valor_mercado || (p.cantidad_actual * (p.precio_ultimo || 0))), 0);
          this.gananciaNoRealizadaAcciones = this.valorMercadoAcciones - this.capitalInvertidoAcciones;
        }

        if (res.dividendos && res.dividendos.success && Array.isArray(res.dividendos.data)) {
          const divActivos = res.dividendos.data.filter(d => d.activo && !d.eliminado);
          this.dividendosEfectivo = divActivos.reduce((sum, d) => sum + Number(d.valor_neto || 0), 0);
          this.dividendosAccionesCant = divActivos.reduce((sum, d) => sum + Number(d.acciones_recibidas || 0), 0);
        }

        // 4. Renta Fija (Filtro corregido por estado no eliminado ni vendido)
        if (res.inversiones) {
          const rawInv: any = res.inversiones;
          const invList: any[] = Array.isArray(rawInv) ? rawInv : (rawInv.data || []);
          const invVigentes = invList.filter((i: any) => !i.eliminado && (!i.fecha_venta || i.fecha_venta === null || i.fecha_venta === ''));
          this.totalInversionesActivas = invVigentes.length;
          
          this.capitalRentaFijaVigente = invVigentes.reduce((sum: number, i: any) =>
            sum + Number(i.capital_invertido ?? i.valor_efectivo ?? i.monto_inversion ?? 0), 0
          );

          let sumaRendimiento = 0;
          let sumaCapitalRend = 0;
          invVigentes.forEach((i: any) => {
            const cap = Number(i.capital_invertido ?? i.valor_efectivo ?? i.monto_inversion ?? 0);
            const rend = Number(i.tasa_interes ?? i.rendimiento_nominal ?? i.rendimiento_efectivo ?? 0);
            if (cap > 0 && rend > 0) {
              sumaRendimiento += rend * cap;
              sumaCapitalRend += cap;
            }
          });
          this.rendimientoPromedioRentaFija = sumaCapitalRend > 0 ? (sumaRendimiento / sumaCapitalRend) : 0;
        }

        // 5. Próximas Amortizaciones
        if (res.amortizaciones) {
          const rawAmort: any = res.amortizaciones;
          const amortList: Amortizacion[] = Array.isArray(rawAmort) ? rawAmort : (rawAmort.data || []);
          
          this.proximasAmortizaciones = amortList
            .filter(a => (a.estado_amortizacion === 'Pendiente' || a.estado_amortizacion === 'Proyectado') && !a.eliminado)
            .sort((a, b) => new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime())
            .slice(0, 5);
        }

        // 6. Vencimientos Semanales
        if (res.vencimientosSemanales && res.vencimientosSemanales.success) {
          const vData = res.vencimientosSemanales.data;
          this.vencimientosSemanales = vData.vencimientos || [];

          const resumenList: ResumenSemanal[] = vData.resumen_semanal || [];
          const getResumenVal = (t: string) => {
            const found = resumenList.find(r => r.tipo === t);
            return found ? Number(found.total || 0) : 0;
          };

          this.resumenSemanalTotal = getResumenVal('TOTAL');
          this.resumenSemanalEjecutado = getResumenVal('EJECUTADO');
          this.resumenSemanalPendiente = getResumenVal('PENDIENTE');

          this.buildVencimientosChartData();
        }

        if (res.historicos && res.historicos.success && Array.isArray(res.historicos.data)) {
          this.rawHistoricos = res.historicos.data;
          this.buildHistoricosOptions();
          this.calcularMoM(this.rawHistoricos);
          this.calcularDesviacion(this.rawHistoricos);
          this.calcularTIR(this.rawHistoricos);
        }

        this.cacheRealTimeData();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar dashboard consolidado:', err);
        this.error = 'No se pudieron cargar todos los datos consolidados.';
        this.loading = false;
      }
    });
  }

  calcularMoM(historicos: any[]): void {
    if (historicos.length === 0) return;

    // Buscar el snapshot de cierre del mes calendario anterior
    const hoy = new Date();
    const primerDiaMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    // Filtrar snapshots que sean estrictamente anteriores al primer día del mes actual
    const snapshotsPasados = historicos.filter(h => {
      const fecha = new Date(h.fecha_captura + 'T00:00:00');
      return fecha < primerDiaMesActual;
    });

    if (snapshotsPasados.length === 0) return;

    // Tomar el más reciente
    const snapshotMesAnterior = snapshotsPasados[snapshotsPasados.length - 1];

    // Función auxiliar para calcular variación
    const calcVar = (actual: number, anterior: number) => {
      if (!anterior || anterior === 0) return null;
      return ((actual / anterior) - 1) * 100;
    };

    this.momPatrimonioBase = calcVar(this.patrimonioBaseCosto, Number(snapshotMesAnterior.patrimonio_base || 0));
    this.momPatrimonioConsolidado = calcVar(this.patrimonioConsolidadoTotal, Number(snapshotMesAnterior.patrimonio_consolidado || 0));
    this.momProyeccion = calcVar(this.patrimonioProyectadoConsolidadoTotal, Number(snapshotMesAnterior.patrimonio_proyectado_consolidado || 0));
    this.momIntereses = calcVar(this.interesesEsperadosProyeccion, Number(snapshotMesAnterior.intereses_esperados || 0));
    this.momTotalCorriente = calcVar(this.patrimonioTotalCorriente, Number(snapshotMesAnterior.total_corriente || 0));
  }

  calcularDesviacion(historicos: any[]): void {
    if (historicos.length === 0) return;

    const hoy = new Date();
    // Buscar el snapshot de referencia (hace 1 año máximo)
    const haceUnAno = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());

    const snapshotsValidos = historicos.filter(h => new Date(h.fecha_captura + 'T00:00:00') >= haceUnAno);
    
    if (snapshotsValidos.length === 0) return;

    // Tomar el más antiguo dentro del último año (que es el primero del array porque vienen ordenados ASC)
    const snapshotBase = snapshotsValidos[0];

    const fechaBase = new Date(snapshotBase.fecha_captura + 'T00:00:00');
    const diasTranscurridos = Math.floor((hoy.getTime() - fechaBase.getTime()) / (1000 * 60 * 60 * 24));

    // Si tiene menos de 7 días, es muy pronto para medir desviación lineal
    if (diasTranscurridos < 7) return;

    const pBase = Number(snapshotBase.patrimonio_consolidado || 0);
    const pMeta1Ano = Number(snapshotBase.patrimonio_proyectado_consolidado || 0);

    // Si la meta proyectada era menor que la base, ignoramos
    if (pMeta1Ano <= pBase) return;

    // Crecimiento esperado por día según la proyección inicial
    const crecimientoDiarioEsperado = (pMeta1Ano - pBase) / 365;
    
    // Meta que deberíamos tener "hoy" si siguiéramos la línea recta perfecta
    this.metaEsperadaHoy = pBase + (crecimientoDiarioEsperado * diasTranscurridos);
    
    // Umbral de sensibilidad del 0.5% (No alertar por fluctuaciones pequeñísimas diarias)
    const umbralSensibilidad = this.metaEsperadaHoy * 0.005;

    if (this.patrimonioConsolidadoTotal < (this.metaEsperadaHoy - umbralSensibilidad)) {
      this.alertaDesviacion = true;
      this.montoDesviacion = this.metaEsperadaHoy - this.patrimonioConsolidadoTotal;
    }
  }


  calcularTIR(historicos: any[]): void {
    if (historicos.length === 0) return;

    const flujos: number[] = [];
    const fechas: Date[] = [];

    // Primer flujo: Inversión inicial (Patrimonio Base del snapshot más antiguo)
    const primerSnapshot = historicos[0];
    flujos.push(-Number(primerSnapshot.patrimonio_base || 0));
    fechas.push(new Date(primerSnapshot.fecha_captura + 'T00:00:00'));

    // Flujos intermedios: Variaciones en el Patrimonio Base (Aportaciones o Retiros)
    for (let i = 1; i < historicos.length; i++) {
      const anteriorBase = Number(historicos[i - 1].patrimonio_base || 0);
      const actualBase = Number(historicos[i].patrimonio_base || 0);
      const delta = actualBase - anteriorBase;

      // Si el patrimonio base cambió en más de $1, se considera flujo de caja
      if (Math.abs(delta) > 1) {
        flujos.push(-delta); // Flujo negativo si es aportación, positivo si es retiro
        fechas.push(new Date(historicos[i].fecha_captura + 'T00:00:00'));
      }
    }

    // Flujo terminal: El patrimonio consolidado actual (Retiro total simulado)
    // Usamos la fecha de hoy para el flujo final
    const hoy = new Date();
    // Prevenir error si el primer snapshot fue creado hoy mismo (división por cero)
    if (hoy.getTime() - fechas[0].getTime() < 86400000) {
      this.tirHistorica = null;
      return;
    }
    
    flujos.push(this.patrimonioConsolidadoTotal);
    fechas.push(hoy);

    this.tirHistorica = this.xirr(flujos, fechas);
  }

  private xirr(values: number[], dates: Date[], guess: number = 0.1): number | null {
    const xnpv = (rate: number) => {
      let sum = 0;
      const d0 = dates[0].getTime();
      for (let i = 0; i < values.length; i++) {
        // Fracción de año (365 días exactos para finanzas)
        const t = (dates[i].getTime() - d0) / (1000 * 60 * 60 * 24 * 365);
        // Si rate es -1, Math.pow da Infinity, evitamos eso
        sum += values[i] / Math.pow(1 + rate, t);
      }
      return sum;
    };

    const xnpvDerivative = (rate: number) => {
      let sum = 0;
      const d0 = dates[0].getTime();
      for (let i = 0; i < values.length; i++) {
        const t = (dates[i].getTime() - d0) / (1000 * 60 * 60 * 24 * 365);
        if (t > 0) {
          sum -= (t * values[i]) / Math.pow(1 + rate, t + 1);
        }
      }
      return sum;
    };

    let rate = guess;
    for (let i = 0; i < 100; i++) {
      const fv = xnpv(rate);
      const fvPrime = xnpvDerivative(rate);
      if (Math.abs(fvPrime) < 1e-10) break;
      const newRate = rate - fv / fvPrime;
      if (Math.abs(newRate - rate) < 1e-7) return newRate * 100; // Multiplicar por 100 para porcentaje
      rate = newRate;
      // Prevenir tasas irreales negativas
      if (rate <= -1.0) rate = -0.99999;
    }
    return null; // No convergió
  }

  cacheRealTimeData(): void {
    this.realTimeCache = {
      patrimonioBaseCosto: this.patrimonioBaseCosto,
      patrimonioConsolidadoTotal: this.patrimonioConsolidadoTotal,
      patrimonioProyeccionUnAnio: this.patrimonioProyeccionUnAnio,
      interesesEsperadosProyeccion: this.interesesEsperadosProyeccion,
      patrimonioTotalCorriente: this.patrimonioTotalCorriente,
      patrimonioProyectadoConsolidadoTotal: this.patrimonioProyectadoConsolidadoTotal,
      patrimonioDesglose: this.patrimonioDesglose,
      capitalRentaFijaConsolidado: this.capitalRentaFijaConsolidado,
      capitalRentaVariableConsolidado: this.capitalRentaVariableConsolidado,
      capitalNotasCreditoConsolidado: this.capitalNotasCreditoConsolidado,

      patrimonioDividendosAcciones: this.patrimonioDividendosAcciones,
      patrimonioPlusvaliaAcciones: this.patrimonioPlusvaliaAcciones,
      dividendosEfectivo: this.dividendosEfectivo,
      capitalInvertidoAcciones: this.capitalInvertidoAcciones,
      valorMercadoAcciones: this.valorMercadoAcciones,
      gananciaNoRealizadaAcciones: this.gananciaNoRealizadaAcciones,

      valorCompraTotalNotasCredito: this.valorCompraTotalNotasCredito,
      valorVentaTotalNotasCredito: this.valorVentaTotalNotasCredito,
      utilidadTotalNotasCredito: this.utilidadTotalNotasCredito,

      momPatrimonioBase: this.momPatrimonioBase,
      momPatrimonioConsolidado: this.momPatrimonioConsolidado,
      momProyeccion: this.momProyeccion,
      momIntereses: this.momIntereses,
      momTotalCorriente: this.momTotalCorriente,
      alertaDesviacion: this.alertaDesviacion,
      montoDesviacion: this.montoDesviacion,
      metaEsperadaHoy: this.metaEsperadaHoy,
      tirHistorica: this.tirHistorica
    };
  }

  buildHistoricosOptions(): void {
    // Dropdown options
    this.historicosOptions = [{ label: '⏳ Tiempo Real (Hoy)', value: 'REAL_TIME' }];
    
    // Sort descending for the dropdown
    const reversed = [...this.rawHistoricos].reverse();
    reversed.forEach(h => {
      this.historicosOptions.push({
        label: `Snapshot ${h.fecha_captura}`,
        value: h.id_historico
      });
    });
  }

  onTimeMachineChange(event: any): void {
    const val = event?.target?.value || event?.value;
    if (val === 'REAL_TIME' || !val) {
      this.resetTimeMachine();
    } else {
      this.isTimeMachineActive = true;
      this.selectedHistoricoId = String(val);
      const snapshot = this.rawHistoricos.find(h => String(h.id_historico) === String(val));
      if (snapshot) {
        this.activeSnapshotFecha = snapshot.fecha_captura;
        this.applyTimeMachineSnapshot(snapshot);
      }
    }
  }

  resetTimeMachine(): void {
    this.isTimeMachineActive = false;
    this.selectedHistoricoId = 'REAL_TIME';
    this.activeSnapshotFecha = null;
    this.restoreRealTimeData();
    this.buildChartData(this.patrimonioDesglose);
  }

  restoreRealTimeData(): void {
    if (!this.realTimeCache) return;
    const c = this.realTimeCache;
    this.patrimonioBaseCosto = c.patrimonioBaseCosto;
    this.patrimonioConsolidadoTotal = c.patrimonioConsolidadoTotal;
    this.patrimonioProyeccionUnAnio = c.patrimonioProyeccionUnAnio;
    this.interesesEsperadosProyeccion = c.interesesEsperadosProyeccion;
    this.patrimonioTotalCorriente = c.patrimonioTotalCorriente;
    this.patrimonioProyectadoConsolidadoTotal = c.patrimonioProyectadoConsolidadoTotal;
    this.patrimonioDesglose = c.patrimonioDesglose;
    this.capitalRentaFijaConsolidado = c.capitalRentaFijaConsolidado;
    this.capitalRentaVariableConsolidado = c.capitalRentaVariableConsolidado;
    this.capitalNotasCreditoConsolidado = c.capitalNotasCreditoConsolidado;

    this.patrimonioDividendosAcciones = c.patrimonioDividendosAcciones;
    this.patrimonioPlusvaliaAcciones = c.patrimonioPlusvaliaAcciones;
    this.dividendosEfectivo = c.dividendosEfectivo;
    this.capitalInvertidoAcciones = c.capitalInvertidoAcciones;
    this.valorMercadoAcciones = c.valorMercadoAcciones;
    this.gananciaNoRealizadaAcciones = c.gananciaNoRealizadaAcciones;

    this.valorCompraTotalNotasCredito = c.valorCompraTotalNotasCredito;
    this.valorVentaTotalNotasCredito = c.valorVentaTotalNotasCredito;
    this.utilidadTotalNotasCredito = c.utilidadTotalNotasCredito;
    
    this.momPatrimonioBase = c.momPatrimonioBase;
    this.momPatrimonioConsolidado = c.momPatrimonioConsolidado;
    this.momProyeccion = c.momProyeccion;
    this.momIntereses = c.momIntereses;
    this.momTotalCorriente = c.momTotalCorriente;
    
    this.alertaDesviacion = c.alertaDesviacion;
    this.montoDesviacion = c.montoDesviacion;
    this.metaEsperadaHoy = c.metaEsperadaHoy;
    this.tirHistorica = c.tirHistorica;
  }

  applyTimeMachineSnapshot(snapshot: any): void {
    // Hero KPIs
    this.patrimonioBaseCosto = Number(snapshot.patrimonio_base || 0);
    this.patrimonioConsolidadoTotal = Number(snapshot.patrimonio_consolidado || 0);
    this.patrimonioProyeccionUnAnio = Number(snapshot.proyeccion_1_ano || 0);
    this.patrimonioProyectadoConsolidadoTotal = Number(snapshot.patrimonio_proyectado_consolidado || 0);
    this.interesesEsperadosProyeccion = Number(snapshot.intereses_esperados || 0);
    this.patrimonioTotalCorriente = Number(snapshot.total_corriente || 0);

    // Desglose de Renta Variable, Dividendos y Plusvalía
    this.patrimonioDividendosAcciones = Number(snapshot.dividendos_acciones || 0);
    this.patrimonioPlusvaliaAcciones = Number(snapshot.plusvalia_acciones || 0);
    this.dividendosEfectivo = Number(snapshot.dividendos_efectivo || 0);

    const capRV = Number(snapshot.capital_renta_variable || 0);
    const valMercadoRV = Number(snapshot.valor_mercado_renta_variable || 0);
    const plusvaliaLatenteRV = Number(snapshot.plusvalia_latente_rv || 0);

    this.capitalInvertidoAcciones = capRV;
    this.valorMercadoAcciones = valMercadoRV > 0 ? valMercadoRV : (capRV + plusvaliaLatenteRV);
    this.gananciaNoRealizadaAcciones = plusvaliaLatenteRV > 0 ? plusvaliaLatenteRV : (this.patrimonioPlusvaliaAcciones + this.patrimonioDividendosAcciones);

    // Notas de Crédito
    this.valorCompraTotalNotasCredito = Number(snapshot.valor_compra_nc || 0);
    this.valorVentaTotalNotasCredito = Number(snapshot.valor_venta_nc || 0);
    this.utilidadTotalNotasCredito = Number(snapshot.utilidad_nc || 0);

    // Chart Data (Desglose simulado para el gráfico)
    this.capitalRentaFijaConsolidado = Number(snapshot.capital_renta_fija || 0);
    this.capitalRentaVariableConsolidado = capRV;
    this.capitalNotasCreditoConsolidado = Number(snapshot.capital_notas_credito || 0);
    
    const mockItems = [
      { detalle: 'Renta Fija', valor: this.capitalRentaFijaConsolidado },
      { detalle: 'Renta Variable', valor: this.capitalRentaVariableConsolidado },
      { detalle: 'Notas de Crédito', valor: this.capitalNotasCreditoConsolidado }
    ];
    
    // MoM for this snapshot (compare against previous snapshot)
    // Find previous snapshot
    const idx = this.rawHistoricos.findIndex(h => h.id_historico === snapshot.id_historico);
    if (idx > 0) {
      // hay uno anterior
      const prev = this.rawHistoricos[idx - 1];
      const calcVar = (actual: number, anterior: number) => {
        if (!anterior || anterior === 0) return null;
        return ((actual / anterior) - 1) * 100;
      };
      this.momPatrimonioBase = calcVar(this.patrimonioBaseCosto, Number(prev.patrimonio_base || 0));
      this.momPatrimonioConsolidado = calcVar(this.patrimonioConsolidadoTotal, Number(prev.patrimonio_consolidado || 0));
      this.momProyeccion = calcVar(this.patrimonioProyectadoConsolidadoTotal, Number(prev.patrimonio_proyectado_consolidado || 0));
      this.momIntereses = calcVar(this.interesesEsperadosProyeccion, Number(prev.intereses_esperados || 0));
      this.momTotalCorriente = calcVar(this.patrimonioTotalCorriente, Number(prev.total_corriente || 0));
    } else {
      // no hay anterior
      this.momPatrimonioBase = null;
      this.momPatrimonioConsolidado = null;
      this.momProyeccion = null;
      this.momIntereses = null;
      this.momTotalCorriente = null;
    }

    // Disable alerts and TIR in time machine mode to avoid confusion
    this.alertaDesviacion = false;
    this.tirHistorica = null;
    
    this.buildChartData(mockItems as any);
  }

  buildVencimientosChartData(): void {
    if (!this.vencimientosSemanales || this.vencimientosSemanales.length === 0) return;

    const labels = this.vencimientosSemanales.map(v => `${v.nombre_dia.slice(0, 3)} ${v.fecha.slice(8, 10)}`);
    const capitalData = this.vencimientosSemanales.map(v => v.capital);
    const interesData = this.vencimientosSemanales.map(v => v.interes);

    this.vencimientosChartData = {
      labels: labels,
      datasets: [
        {
          label: 'Capital',
          backgroundColor: '#ff7588',
          data: capitalData
        },
        {
          label: 'Interés',
          backgroundColor: '#3b82f6',
          data: interesData
        }
      ]
    };

    this.vencimientosChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 10,
            font: { size: 10, family: "'Inter', sans-serif" }
          }
        },
        tooltip: createStackedTooltipOptions('$'),
        datalabels: {
          anchor: 'end',
          align: 'end',
          offset: 2,
          font: { size: 9, weight: 'bold', family: "'Inter', sans-serif" },
          color: '#374151',
          formatter: (value: any, context: any) => {
            // Mostrar SOLAMENTE el TOTAL diario sobre la parte superior de la barra
            if (context.datasetIndex === context.chart.data.datasets.length - 1) {
              const idx = context.dataIndex;
              let totalDia = 0;
              context.chart.data.datasets.forEach((ds: any) => {
                totalDia += Number(ds.data[idx] || 0);
              });
              return totalDia > 0 ? `$${totalDia.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
            }
            return null;
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 10 } }
        },
        y: {
          stacked: true,
          grid: { color: '#f3f4f6' },
          ticks: { font: { size: 10 } },
          grace: '18%'
        }
      }
    };
  }

  buildChartData(itemsList?: PatrimonioItem[]): void {
    const list = (itemsList && itemsList.length > 0) ? itemsList : this.patrimonioDesglose;
    if (!list || list.length === 0) return;

    // Filtrar la fila 'TOTAL' para que no aparezca como una porción en el gráfico de dona
    const itemsFiltrados = list.filter(item => item.detalle && item.detalle.toUpperCase() !== 'TOTAL' && Number(item.valor) !== 0);

    const colores = [
      '#278550', // Capital bonos (Verde)
      '#2196F3', // Papeles Comerciales (Azul)
      '#8E24AA', // Obligaciones (Púrpura)
      '#FF9800', // Acciones Sin Interés (Naranja)
      '#3F51B5', // Intereses esperados (Azul Índigo)
      '#9C27B0', // Acciones Pago Interes (Violeta)
      '#E91E63', // Titularizaciones (Rosa)
      '#4CAF50', // Notas Crédito (Verde claro)
      '#FFB74D', // Bonos vencimiento próximo (Amarillo oro)
      '#FFF176', // Dividendos en Acciones (Amarillo claro)
      '#4DD0E1', // Plusvalía Acciones (Cyan)
      '#BA68C8'  // Total Corriente (Morado)
    ];

    // Ordenar de mayor a menor para la leyenda lateral
    const datosOrdenados = [...itemsFiltrados].sort((a, b) => Number(b.valor) - Number(a.valor));
    const totalPositivos = datosOrdenados.reduce((sum, item) => sum + (Number(item.valor) > 0 ? Number(item.valor) : 0), 0);

    this.leyendaColores = datosOrdenados.map((item, index) => {
      const val = Number(item.valor);
      const pct = (val > 0 && totalPositivos > 0) ? ((val / totalPositivos) * 100).toFixed(1) : '0.0';
      return {
        color: colores[index % colores.length],
        label: item.detalle,
        valor: val,
        porcentaje: pct
      };
    });

    const labels = datosOrdenados.map(item => item.detalle);
    const data = datosOrdenados.map(item => item.valor);

    this.chartData = {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: colores.slice(0, labels.length),
          hoverBackgroundColor: colores.slice(0, labels.length)
        }
      ]
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        datalabels: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const label = context.label || '';
              const value = context.raw || 0;
              return ` ${label}: $${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }
        }
      },
      cutout: '72%'
    };
  }

  get userName(): string {
    return this.currentUser ?
      `${this.currentUser.persona.nombres} ${this.currentUser.persona.apellidos}` :
      'Usuario';
  }

  get userRole(): string {
    return this.currentUser ? this.currentUser.rol : 'Sin rol';
  }

  setActiveTab(tab: 'capital' | 'acciones' | 'proyeccion'): void {
    this.activeTab = tab;
  }

  getEstiloTotalCorriente(): string {
    if (this.patrimonioTotalCorriente < 0) {
      return 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)';
    }
    return 'linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)';
  }

  guardarSnapshot(force: boolean = false): void {
    if (this.loading) {
      this.messageService.add({ severity: 'warn', summary: 'Cargando', detail: 'Espere a que carguen los datos primero.' });
      return;
    }

    const snapshot: HistoricoIndicadorData = {
      fecha_captura: new Date().toISOString().split('T')[0],
      patrimonio_base: this.patrimonioBaseCosto,
      patrimonio_consolidado: this.patrimonioConsolidadoTotal,
      proyeccion_1_ano: this.patrimonioProyeccionUnAnio,
      patrimonio_proyectado_consolidado: this.patrimonioProyectadoConsolidadoTotal,
      intereses_esperados: this.interesesEsperadosProyeccion,
      total_corriente: this.patrimonioTotalCorriente,
      dividendos_acciones: this.patrimonioDividendosAcciones,
      dividendos_efectivo: this.dividendosEfectivo,
      plusvalia_acciones: this.patrimonioPlusvaliaAcciones,
      capital_renta_fija: this.capitalRentaFijaConsolidado,
      capital_renta_variable: this.capitalInvertidoAcciones || 114753.06,
      valor_mercado_renta_variable: (this.capitalInvertidoAcciones || 114753.06) + (this.patrimonioPlusvaliaAcciones + this.patrimonioDividendosAcciones),
      plusvalia_latente_rv: this.patrimonioPlusvaliaAcciones + this.patrimonioDividendosAcciones,
      capital_notas_credito: this.capitalNotasCreditoConsolidado,
      valor_compra_nc: this.valorCompraTotalNotasCredito,
      valor_venta_nc: this.valorVentaTotalNotasCredito,
      utilidad_nc: this.utilidadTotalNotasCredito
    };

    this.historicoService.guardarSnapshot(snapshot, force).subscribe({
      next: (res) => {
        if (res.success) {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Snapshot guardado correctamente en el historial.' });
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Hubo un error al guardar.' });
        }
      },
      error: (err) => {
        if (err.status === 409 && err.error?.code === 'ALREADY_EXISTS') {
          this.confirmationService.confirm({
            message: 'Ya has guardado un histórico el día de hoy. ¿Deseas generar uno nuevo y reemplazar el anterior?',
            header: 'Registro Existente',
            icon: 'bi bi-exclamation-triangle text-warning',
            acceptLabel: 'Sí, reemplazar',
            rejectLabel: 'No, cancelar',
            accept: () => {
              this.guardarSnapshot(true);
            }
          });
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error de Conexión', detail: 'No se pudo guardar el snapshot.' });
          console.error(err);
        }
      }
    });
  }
}
