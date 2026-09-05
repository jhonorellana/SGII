import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import * as XLSX from 'xlsx';
import { HistoricoIndicadorService } from '../../core/historico-indicador.service';
import { createStackedTooltipOptions } from '../../core/utils/chart-options.util';

@Component({
  selector: 'app-tendencias-historicas',
  standalone: true,
  imports: [CommonModule, ChartModule],
  templateUrl: './tendencias-historicas.component.html',
  styleUrls: ['./tendencias-historicas.component.css']
})
export class TendenciasHistoricasComponent implements OnInit {
  historicoData: any[] = [];
  
  // Chart 1: Crecimiento
  chartCrecimientoData: any;
  chartCrecimientoOptions: any;

  // Chart 2: Riesgo
  chartRiesgoData: any;
  chartRiesgoOptions: any;

  // Chart 3: Renta Variable
  chartRentaVariableData: any;
  chartRentaVariableOptions: any;

  // Chart 4: Notas de Crédito
  chartNCData: any;
  chartNCOptions: any;

  // MoM (Month over Month)
  momTableData: any[] = [];
  momResumen: any = {
    promedio_crecimiento_monto: 0,
    promedio_crecimiento_pct: 0,
    max_crecimiento_monto: 0,
    ultimo_mes_pct: 0
  };

  loading = true;

  constructor(private historicoService: HistoricoIndicadorService) {}

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.historicoService.getHistorico().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.historicoData = res.data;
          this.inicializarGraficos();
          this.procesarMoMData();
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Error al cargar históricos', err);
        this.loading = false;
      }
    });
  }

  procesarMoMData(): void {
    if (!this.historicoData || this.historicoData.length === 0) {
      this.momTableData = [];
      return;
    }

    const groupedByMonth: { [key: string]: any } = {};
    const sorted = [...this.historicoData].sort((a, b) => a.fecha_captura.localeCompare(b.fecha_captura));

    sorted.forEach(h => {
      const monthKey = h.fecha_captura.substring(0, 7); // "2026-08"
      groupedByMonth[monthKey] = h; // Último snapshot de ese mes
    });

    const monthKeys = Object.keys(groupedByMonth).sort();
    const result: any[] = [];
    let prevSnapshot: any = null;

    let totalDiffMonto = 0;
    let totalDiffPct = 0;
    let countMoM = 0;
    let maxDiffMonto = 0;

    monthKeys.forEach((key) => {
      const current = groupedByMonth[key];
      const dateParts = key.split('-');
      const year = dateParts[0];
      const monthIdx = parseInt(dateParts[1], 10) - 1;
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const periodoNombre = `${monthNames[monthIdx]} ${year}`;

      const patConsolidado = Number(current.patrimonio_consolidado || 0);
      const patBase = Number(current.patrimonio_base || 0);
      const proyeccion = Number(current.patrimonio_proyectado_consolidado || current.proyeccion_1_ano || 0);
      const valMercadoRV = Number(current.valor_mercado_renta_variable || (Number(current.capital_renta_variable || 0) + Number(current.plusvalia_latente_rv || 0)));
      const capRF = Number(current.capital_renta_fija || 0);

      let gananciaNetaMensual: number | null = null;
      let patConsolidadoMomPct: number | null = null;
      let patBaseMomPct: number | null = null;
      let proyeccionMomPct: number | null = null;
      let valMercadoRvMomPct: number | null = null;

      if (prevSnapshot) {
        const prevConsolidado = Number(prevSnapshot.patrimonio_consolidado || 0);
        const prevBase = Number(prevSnapshot.patrimonio_base || 0);
        const prevProyeccion = Number(prevSnapshot.patrimonio_proyectado_consolidado || prevSnapshot.proyeccion_1_ano || 0);
        const prevValMercadoRV = Number(prevSnapshot.valor_mercado_renta_variable || (Number(prevSnapshot.capital_renta_variable || 0) + Number(prevSnapshot.plusvalia_latente_rv || 0)));

        gananciaNetaMensual = patConsolidado - prevConsolidado;
        if (prevConsolidado > 0) {
          patConsolidadoMomPct = ((patConsolidado / prevConsolidado) - 1) * 100;
        }
        if (prevBase > 0) {
          patBaseMomPct = ((patBase / prevBase) - 1) * 100;
        }
        if (prevProyeccion > 0) {
          proyeccionMomPct = ((proyeccion / prevProyeccion) - 1) * 100;
        }
        if (prevValMercadoRV > 0) {
          valMercadoRvMomPct = ((valMercadoRV / prevValMercadoRV) - 1) * 100;
        }

        if (gananciaNetaMensual !== null) {
          totalDiffMonto += gananciaNetaMensual;
          if (patConsolidadoMomPct !== null) totalDiffPct += patConsolidadoMomPct;
          countMoM++;
          if (gananciaNetaMensual > maxDiffMonto) {
            maxDiffMonto = gananciaNetaMensual;
          }
        }
      }

      result.push({
        periodo: periodoNombre,
        fecha_cierre: current.fecha_captura,
        patrimonio_base: patBase,
        patrimonio_base_mom_pct: patBaseMomPct,
        patrimonio_consolidado: patConsolidado,
        patrimonio_consolidado_mom_pct: patConsolidadoMomPct,
        ganancia_neta_mensual: gananciaNetaMensual,
        proyeccion_1_ano: proyeccion,
        proyeccion_1_ano_mom_pct: proyeccionMomPct,
        valor_mercado_rv: valMercadoRV,
        valor_mercado_rv_mom_pct: valMercadoRvMomPct,
        capital_renta_fija: capRF
      });

      prevSnapshot = current;
    });

    this.momTableData = [...result].reverse(); // Más reciente primero

    this.momResumen = {
      promedio_crecimiento_monto: countMoM > 0 ? totalDiffMonto / countMoM : 0,
      promedio_crecimiento_pct: countMoM > 0 ? totalDiffPct / countMoM : 0,
      max_crecimiento_monto: maxDiffMonto,
      ultimo_mes_pct: result.length > 0 && result[result.length - 1].patrimonio_consolidado_mom_pct !== null ? result[result.length - 1].patrimonio_consolidado_mom_pct : 0
    };
  }

  formatCurrency(val: number | null): string {
    if (val === null || val === undefined) return '-';
    return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(val);
  }

  formatPct(val: number | null): string {
    if (val === null || val === undefined) return '-';
    const prefix = val > 0 ? '+' : '';
    return `${prefix}${val.toFixed(2)}%`;
  }

  exportarMoMExcel(): void {
    if (!this.momTableData || this.momTableData.length === 0) return;

    const dataToExport = this.momTableData.map(r => ({
      'Período': r.periodo,
      'Fecha Cierre Snapshot': r.fecha_cierre,
      'Patrimonio Consolidado ($)': r.patrimonio_consolidado,
      'Ganancia/Pérdida Neta MoM ($)': r.ganancia_neta_mensual !== null ? r.ganancia_neta_mensual : '-',
      'Variación MoM (%)': r.patrimonio_consolidado_mom_pct !== null ? r.patrimonio_consolidado_mom_pct.toFixed(2) + '%' : '-',
      'Patrimonio Base ($)': r.patrimonio_base,
      'Renta Variable Mercado ($)': r.valor_mercado_rv,
      'Renta Fija ($)': r.capital_renta_fija
    }));

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook: XLSX.WorkBook = { Sheets: { 'Crecimiento MoM': worksheet }, SheetNames: ['Crecimiento MoM'] };
    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `cuadro_crecimiento_mom_${todayStr}.xlsx`);
  }

  inicializarGraficos() {
    if (this.historicoData.length === 0) return;

    const labels = this.historicoData.map(h => h.fecha_captura);
    
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color') || '#495057';
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary') || '#6c757d';
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border') || '#dfe7ef';

    // 1. Crecimiento Patrimonial
    this.chartCrecimientoData = {
      labels: labels,
      datasets: [
        {
          label: 'Patrimonio Base',
          data: this.historicoData.map(h => h.patrimonio_base),
          fill: true,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.2)',
          tension: 0.4
        },
        {
          label: 'Patrimonio Consolidado',
          data: this.historicoData.map(h => h.patrimonio_consolidado),
          fill: true,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          tension: 0.4
        },
        {
          label: 'Proyectado (1 Año)',
          data: this.historicoData.map(h => h.patrimonio_proyectado_consolidado),
          fill: false,
          borderColor: '#f59e0b',
          borderDash: [5, 5],
          tension: 0.4
        }
      ]
    };

    this.chartCrecimientoOptions = {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: createStackedTooltipOptions('$'),
        datalabels: { display: false }
      },
      scales: {
        x: { ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
        y: { ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } }
      }
    };

    // 2. Distribución de Riesgo
    this.chartRiesgoData = {
      labels: labels,
      datasets: [
        {
          label: 'Renta Fija',
          data: this.historicoData.map(h => h.capital_renta_fija),
          fill: true,
          backgroundColor: '#3b82f6',
          borderColor: '#3b82f6',
          tension: 0.4
        },
        {
          label: 'Renta Variable',
          data: this.historicoData.map(h => h.capital_renta_variable),
          fill: true,
          backgroundColor: '#ec4899',
          borderColor: '#ec4899',
          tension: 0.4
        },
        {
          label: 'Notas de Crédito',
          data: this.historicoData.map(h => h.capital_notas_credito),
          fill: true,
          backgroundColor: '#8b5cf6',
          borderColor: '#8b5cf6',
          tension: 0.4
        }
      ]
    };

    this.chartRiesgoOptions = {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: createStackedTooltipOptions('$'),
        datalabels: { display: false }
      },
      scales: {
        x: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
        y: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } }
      }
    };

    // 3. Renta Variable
    this.chartRentaVariableData = {
      labels: labels,
      datasets: [
        {
          type: 'line',
          label: 'Plusvalía Acciones',
          data: this.historicoData.map(h => h.plusvalia_acciones),
          borderColor: '#14b8a6',
          tension: 0.4,
          fill: false,
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: 'Dividendos Efectivo',
          data: this.historicoData.map(h => h.dividendos_efectivo),
          backgroundColor: '#0ea5e9'
        },
        {
          type: 'bar',
          label: 'Dividendos Acciones',
          data: this.historicoData.map(h => h.dividendos_acciones),
          backgroundColor: '#6366f1'
        }
      ]
    };

    this.chartRentaVariableOptions = {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: createStackedTooltipOptions('$'),
        datalabels: { display: false }
      },
      scales: {
        x: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
        y: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } }
      }
    };

    // 4. Notas de Crédito
    this.chartNCData = {
      labels: labels,
      datasets: [
        {
          type: 'bar',
          label: 'Valor Compra',
          data: this.historicoData.map(h => h.valor_compra_nc),
          backgroundColor: '#ef4444'
        },
        {
          type: 'bar',
          label: 'Valor Venta',
          data: this.historicoData.map(h => h.valor_venta_nc),
          backgroundColor: '#22c55e'
        },
        {
          type: 'line',
          label: 'Utilidad',
          data: this.historicoData.map(h => h.utilidad_nc),
          borderColor: '#eab308',
          tension: 0.4,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    };

    this.chartNCOptions = {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: createStackedTooltipOptions('$'),
        datalabels: { display: false }
      },
      scales: {
        x: { ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
        y: { type: 'linear', display: true, position: 'left', ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
        y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: textColorSecondary } }
      }
    };
  }
}
