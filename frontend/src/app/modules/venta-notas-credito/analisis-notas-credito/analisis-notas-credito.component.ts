import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { VentaInversionService, VentaInversion } from '../../../core/venta-inversion.service';

export interface DesglosePeriodoNC {
  periodoKey: string;
  label: string;
  rangoFechas: string;
  ventasCount: number;
  montoInvertidoTotal: number;
  montoPromedioVenta: number;
  utilidadObtenida: number;
  utilidadPromedioVenta: number;
  roiPct: number;
}

@Component({
  selector: 'app-analisis-notas-credito',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartModule,
    TableModule,
    ButtonModule,
    TooltipModule
  ],
  templateUrl: './analisis-notas-credito.component.html',
  styleUrl: './analisis-notas-credito.component.css'
})
export class AnalisisNotasCreditoComponent implements OnInit {
  loading: boolean = false;
  error: string = '';

  // Filtro de periodo
  periodoSeleccionado: 'semanal' | 'mensual' = 'semanal';

  // Vista de gráfico: 'doble_eje' | 'inversion' | 'utilidad'
  vistaGrafico: 'doble_eje' | 'inversion' | 'utilidad' = 'doble_eje';

  // Modo de cálculo de inversión: 'promedio' (defecto) | 'total' (rotado)
  modoInversion: 'promedio' | 'total' = 'promedio';

  // Ventas puras de Notas de Crédito (tipo 91)
  ventasNC: any[] = [];

  // KPIs Generales Acumulados
  totalCapitalInvertido: number = 0;
  montoPromedioGlobalVenta: number = 0;
  totalUtilidadObtenida: number = 0;
  roiGlobalPct: number = 0;
  totalOperaciones: number = 0;

  // Datos para la tabla y gráfico
  desglosePeriodos: DesglosePeriodoNC[] = [];
  chartData: any = null;
  chartOptions: any = null;

  constructor(private ventaService: VentaInversionService) {}

  ngOnInit(): void {
    this.cargarDatosVentas();
  }

  cargarDatosVentas(): void {
    this.loading = true;
    this.error = '';

    this.ventaService.getAll({}).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Filtrar ventas de Notas de Crédito (solo tipo 91)
          const rawVentas = response.data;
          this.ventasNC = rawVentas.filter((venta: any) => {
            const idTipo = venta.instrumento?.id_tipo_inversion || venta.inversion?.instrumento?.id_tipo_inversion;
            return idTipo === 91 && venta.activo && !venta.eliminado;
          });

          this.calcularKPIsGenerales();
          this.procesarDatosPeriodo();
        } else {
          this.ventasNC = [];
          this.desglosePeriodos = [];
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar ventas para análisis de notas de crédito:', err);
        this.error = 'No se pudieron cargar las ventas de Notas de Crédito.';
        this.loading = false;
      }
    });
  }

  calcularKPIsGenerales(): void {
    this.totalOperaciones = this.ventasNC.length;
    
    this.totalCapitalInvertido = this.ventasNC.reduce((sum, v) => {
      let valCompra = Number(v.valorCompraTotal || 0);
      if (valCompra === 0 && v.detalles && v.detalles.length > 0) {
        valCompra = v.detalles.reduce((acc: number, d: any) => acc + Number(d.valor_compra || 0), 0);
      }
      if (valCompra === 0 && v.inversion) {
        valCompra = Number(v.inversion.capital_invertido || 0) * (Number(v.porcentaje_vendido || 100) / 100);
      }
      return sum + valCompra;
    }, 0);

    this.montoPromedioGlobalVenta = this.totalOperaciones > 0 ? (this.totalCapitalInvertido / this.totalOperaciones) : 0;

    this.totalUtilidadObtenida = this.ventasNC.reduce((sum, v) => {
      return sum + Number(v.utilidad_con_comision ?? v.ganancia_perdida ?? 0);
    }, 0);

    this.roiGlobalPct = this.totalCapitalInvertido > 0 
      ? (this.totalUtilidadObtenida / this.totalCapitalInvertido) * 100 
      : 0;
  }

  cambiarPeriodo(periodo: 'semanal' | 'mensual'): void {
    if (this.periodoSeleccionado === periodo) return;
    this.periodoSeleccionado = periodo;
    this.procesarDatosPeriodo();
  }

  cambiarVistaGrafico(vista: 'doble_eje' | 'inversion' | 'utilidad'): void {
    if (this.vistaGrafico === vista) return;
    this.vistaGrafico = vista;
    this.procesarDatosPeriodo();
  }

  cambiarModoInversion(modo: 'promedio' | 'total'): void {
    if (this.modoInversion === modo) return;
    this.modoInversion = modo;
    this.procesarDatosPeriodo();
  }

  procesarDatosPeriodo(): void {
    if (!this.ventasNC || this.ventasNC.length === 0) {
      this.desglosePeriodos = [];
      this.chartData = null;
      return;
    }

    const mapaPeriodos = new Map<string, {
      label: string;
      rangoFechas: string;
      sortKey: string;
      ventasCount: number;
      montoInvertidoTotal: number;
      utilidadObtenida: number;
    }>();

    this.ventasNC.forEach((v) => {
      const fechaStr = v.fecha_venta || v.created_at;
      if (!fechaStr) return;

      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return;

      let valCompra = Number(v.valorCompraTotal || 0);
      if (valCompra === 0 && v.detalles && v.detalles.length > 0) {
        valCompra = v.detalles.reduce((acc: number, d: any) => acc + Number(d.valor_compra || 0), 0);
      }
      if (valCompra === 0 && v.inversion) {
        valCompra = Number(v.inversion.capital_invertido || 0) * (Number(v.porcentaje_vendido || 100) / 100);
      }

      const utilidad = Number(v.utilidad_con_comision ?? v.ganancia_perdida ?? 0);

      let key = '';
      let label = '';
      let rangoFechas = '';
      let sortKey = '';

      if (this.periodoSeleccionado === 'semanal') {
        const infoSemana = this.obtenerInfoSemana(fecha);
        key = infoSemana.key;
        label = infoSemana.label;
        rangoFechas = infoSemana.rangoFechas;
        sortKey = infoSemana.sortKey;
      } else {
        const infoMes = this.obtenerInfoMes(fecha);
        key = infoMes.key;
        label = infoMes.label;
        rangoFechas = infoMes.rangoFechas;
        sortKey = infoMes.sortKey;
      }

      if (!mapaPeriodos.has(key)) {
        mapaPeriodos.set(key, {
          label,
          rangoFechas,
          sortKey,
          ventasCount: 0,
          montoInvertidoTotal: 0,
          utilidadObtenida: 0
        });
      }

      const item = mapaPeriodos.get(key)!;
      item.ventasCount += 1;
      item.montoInvertidoTotal += valCompra;
      item.utilidadObtenida += utilidad;
    });

    // Ordenar periodos cronológicamente y calcular promedios
    const periodosOrdenados: DesglosePeriodoNC[] = Array.from(mapaPeriodos.entries())
      .map(([key, data]) => {
        const roiPct = data.montoInvertidoTotal > 0 ? (data.utilidadObtenida / data.montoInvertidoTotal) * 100 : 0;
        const montoPromedioVenta = data.ventasCount > 0 ? (data.montoInvertidoTotal / data.ventasCount) : 0;
        const utilidadPromedioVenta = data.ventasCount > 0 ? (data.utilidadObtenida / data.ventasCount) : 0;

        return {
          periodoKey: key,
          label: data.label,
          rangoFechas: data.rangoFechas,
          sortKey: data.sortKey,
          ventasCount: data.ventasCount,
          montoInvertidoTotal: data.montoInvertidoTotal,
          montoPromedioVenta,
          utilidadObtenida: data.utilidadObtenida,
          utilidadPromedioVenta,
          roiPct
        };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    this.desglosePeriodos = periodosOrdenados;
    this.buildChartData(periodosOrdenados);
  }

  obtenerInfoSemana(d: Date): { key: string; label: string; rangoFechas: string; sortKey: string } {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const weekNr = 1 + Math.round((firstThursday - target.valueOf()) / 604800000);

    // Calcular inicio (lunes) y fin (domingo)
    const inicio = new Date(d);
    inicio.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);

    const year = inicio.getFullYear();
    const weekStr = weekNr.toString().padStart(2, '0');

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const rango = `${inicio.getDate()} ${meses[inicio.getMonth()]} - ${fin.getDate()} ${meses[fin.getMonth()]} ${year}`;

    return {
      key: `${year}-W${weekStr}`,
      label: `Sem ${weekStr} (${year})`,
      rangoFechas: rango,
      sortKey: `${year}-W${weekStr}`
    };
  }

  obtenerInfoMes(d: Date): { key: string; label: string; rangoFechas: string; sortKey: string } {
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthStr = (month + 1).toString().padStart(2, '0');

    const nombresMeses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return {
      key: `${year}-${monthStr}`,
      label: `${nombresMeses[month]} ${year}`,
      rangoFechas: `01 a fin de mes (${nombresMeses[month]})`,
      sortKey: `${year}-${monthStr}`
    };
  }

  buildChartData(periodos: DesglosePeriodoNC[]): void {
    const labels = periodos.map(p => p.label);
    
    // Inversión según modo seleccionado: Promedio por venta o Total reinvertido/rotado
    const dataInvertido = periodos.map(p => 
      this.modoInversion === 'promedio' ? p.montoPromedioVenta : p.montoInvertidoTotal
    );
    const dataUtilidad = periodos.map(p => p.utilidadObtenida);

    const labelInversion = this.modoInversion === 'promedio' 
      ? 'Monto Promedio / Venta ($)' 
      : 'Monto Total Reinvertido ($)';

    const datasets: any[] = [];

    if (this.vistaGrafico === 'doble_eje' || this.vistaGrafico === 'inversion') {
      datasets.push({
        label: labelInversion,
        backgroundColor: '#0284c7',
        borderColor: '#0369a1',
        borderWidth: 1,
        borderRadius: 6,
        data: dataInvertido,
        yAxisID: 'y'
      });
    }

    if (this.vistaGrafico === 'doble_eje' || this.vistaGrafico === 'utilidad') {
      datasets.push({
        label: 'Utilidad Obtenida ($)',
        backgroundColor: '#059669',
        borderColor: '#047857',
        borderWidth: 1,
        borderRadius: 6,
        data: dataUtilidad,
        yAxisID: this.vistaGrafico === 'doble_eje' ? 'y1' : 'y'
      });
    }

    this.chartData = {
      labels,
      datasets
    };

    this.buildChartOptions();
  }

  buildChartOptions(): void {
    const isDobleEje = this.vistaGrafico === 'doble_eje';
    const labelEjeInversion = this.modoInversion === 'promedio' ? 'Monto Promedio / Venta ($)' : 'Monto Total Reinvertido ($)';

    const scalesConfig: any = {
      x: {
        grid: { display: false },
        ticks: { font: { family: "'Inter', sans-serif", size: 11 } }
      },
      y: {
        type: 'linear',
        position: 'left',
        grid: { color: '#f1f5f9' },
        title: {
          display: true,
          text: this.vistaGrafico === 'utilidad' ? 'Utilidad Obtenida ($)' : labelEjeInversion,
          color: this.vistaGrafico === 'utilidad' ? '#059669' : '#0284c7',
          font: { family: "'Inter', sans-serif", size: 11, weight: 'bold' }
        },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          color: this.vistaGrafico === 'utilidad' ? '#059669' : '#0284c7',
          callback: (val: any) => `$${Number(val).toLocaleString('en-US')}`
        },
        grace: '10%'
      }
    };

    if (isDobleEje) {
      scalesConfig.y1 = {
        type: 'linear',
        position: 'right',
        grid: { drawOnChartArea: false },
        title: {
          display: true,
          text: 'Utilidad Obtenida ($)',
          color: '#059669',
          font: { family: "'Inter', sans-serif", size: 11, weight: 'bold' }
        },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          color: '#059669',
          callback: (val: any) => `$${Number(val).toLocaleString('en-US')}`
        },
        grace: '15%'
      };
    }

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        datalabels: {
          display: false
        },
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            boxWidth: 10,
            font: { family: "'Inter', sans-serif", size: 12, weight: 'bold' }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { size: 13, weight: 'bold', family: "'Inter', sans-serif" },
          bodyFont: { size: 12, family: "'Inter', sans-serif" },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title: (tooltipItems: any[]) => {
              if (!tooltipItems || tooltipItems.length === 0) return '';
              const idx = tooltipItems[0].dataIndex;
              const label = tooltipItems[0].label || '';
              const item = this.desglosePeriodos[idx];
              return item && item.rangoFechas ? `${label} — [${item.rangoFechas}]` : label;
            },
            label: (context: any) => {
              const label = context.dataset.label || '';
              const val = Number(context.raw || 0);
              return `${label}: $${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            },
            footer: (tooltipItems: any[]) => {
              const idx = tooltipItems[0]?.dataIndex;
              if (idx !== undefined && this.desglosePeriodos[idx]) {
                const item = this.desglosePeriodos[idx];
                const lineas: string[] = [];
                lineas.push(`Monto Total Rotado en Periodo: $${item.montoInvertidoTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${item.ventasCount} venta${item.ventasCount !== 1 ? 's' : ''})`);
                if (item.montoInvertidoTotal > 0) {
                  lineas.push(`Margen ROI del Periodo: +${item.roiPct.toFixed(2)}%`);
                }
                return lineas.join('\n');
              }
              return '';
            }
          }
        }
      },
      scales: scalesConfig
    };
  }
}
