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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ChartModule, TableModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  providers: [
    PatrimonioService,
    VentaInversionService,
    AccionPosicionService,
    AccionDividendoService,
    InversionService,
    AmortizacionService,
    VencimientosSemanalesService
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
  activeTab: 'capital' | 'acciones' | 'proyeccion' = 'capital';

  // Nuevos KPIs Consolidados
  capitalRentaFijaConsolidado = 0;
  capitalRentaVariableConsolidado = 0;
  capitalNotasCreditoConsolidado = 0;

  patrimonioDesglose: PatrimonioItem[] = [];
  utilidadNotasCreditoVentas = 0;

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

  constructor(
    private authService: AuthService,
    private patrimonioService: PatrimonioService,
    private ventaService: VentaInversionService,
    private posicionService: AccionPosicionService,
    private dividendoService: AccionDividendoService,
    private inversionService: InversionService,
    private amortizacionService: AmortizacionService,
    private vencimientosSemanalesService: VencimientosSemanalesService
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

    // Cálculo de fecha fin a 1 año para la proyección
    const fechaFinProyeccion = new Date(hoy);
    fechaFinProyeccion.setFullYear(hoy.getFullYear() + 1);
    fechaFinProyeccion.setDate(fechaFinProyeccion.getDate() - 1);
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
      vencimientosSemanales: this.vencimientosSemanalesService.getVencimientosSemanales(fechaFinStr).pipe(catchError(() => of(null)))
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

        // 2. Utilidades por Ventas & Notas de Crédito
        if (res.ventas && Array.isArray(res.ventas)) {
          const ventasActivas = res.ventas.filter((v: any) => v.activo && !v.eliminado);
          this.utilidadNotasCreditoVentas = ventasActivas.reduce((sum: number, v: any) => {
            const val = Number(v.utilidad_con_comision ?? v.ganancia_perdida ?? 0);
            return sum + val;
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

        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar dashboard consolidado:', err);
        this.error = 'No se pudieron cargar todos los datos consolidados.';
        this.loading = false;
      }
    });
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
}
