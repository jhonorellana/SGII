import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DropdownModule } from 'primeng/dropdown';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TabViewModule } from 'primeng/tabview';
import * as XLSX from 'xlsx';

import 'chartjs-adapter-date-fns';
import { es } from 'date-fns/locale';
import {
  Chart,
  TimeScale,
  TimeSeriesScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

import {
  MaximosMinimosService,
  MaximosMinimosEmisor,
  CanalBursatilResponse,
  CanalPunto,
  ProyeccionHito
} from '../../../core/maximos-minimos.service';

Chart.register(
  TimeScale,
  TimeSeriesScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  Tooltip,
  Legend,
  Filler
);

interface DropdownItem {
  label: string;
  value: string;
  emisor: MaximosMinimosEmisor;
}

@Component({
  selector: 'app-canal-bursatil',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropdownModule,
    ChartModule,
    TableModule,
    TooltipModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    TabViewModule
  ],
  templateUrl: './canal-bursatil.component.html',
  styleUrls: ['./canal-bursatil.component.css']
})
export class CanalBursatilComponent implements OnInit {
  // Emisores
  emisores: MaximosMinimosEmisor[] = [];
  emisoresDropdown: DropdownItem[] = [];
  selectedCodigoSeb: string = 'PCD'; // Default Banco Pichincha
  selectedEmisorObj: MaximosMinimosEmisor | null = null;

  // Filtros
  periodos = [
    { label: '1 Mes', value: '1m' },
    { label: '3 Meses', value: '3m' },
    { label: '6 Meses', value: '6m' },
    { label: '1 Año', value: '1y' },
    { label: '3 Años', value: '3y' },
    { label: 'Histórico Total', value: 'all' }
  ];
  selectedPeriodo: string = '1y';

  // Opciones de visualización
  showBandas: boolean = true;
  showProyeccion: boolean = true;
  showVolumen: boolean = true;
  diasProyeccion: number = 90;

  // Estado y datos
  loading: boolean = false;
  loadingEmisores: boolean = false;
  errorMsg: string = '';
  canalData: CanalBursatilResponse | null = null;

  // Gráfico Chart.js
  chartData: any = null;
  chartOptions: any = null;

  // Tabla histórica filtrada
  filtroTabla: string = '';

  constructor(
    private maximosMinimosService: MaximosMinimosService,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['emisor']) {
        this.selectedCodigoSeb = params['emisor'].toUpperCase().trim();
      }
    });
    this.initChartOptions();
    this.cargarEmisores();
  }

  /**
   * Carga la lista maestra de 101 emisores desde la base de datos
   */
  cargarEmisores(): void {
    this.loadingEmisores = true;
    this.maximosMinimosService.getEmisores().subscribe({
      next: (res) => {
        this.loadingEmisores = false;
        if (res.success && res.data) {
          this.emisores = res.data;
          this.emisoresDropdown = this.emisores.map((e) => ({
            label: `${e.codigo_seb} - ${e.emisor}`,
            value: e.codigo_seb,
            emisor: e
          }));

          // Si el seleccionado default está disponible, usarlo
          const existe = this.emisores.find((e) => e.codigo_seb === this.selectedCodigoSeb);
          if (existe) {
            this.selectedEmisorObj = existe;
          } else if (this.emisores.length > 0) {
            this.selectedCodigoSeb = this.emisores[0].codigo_seb;
            this.selectedEmisorObj = this.emisores[0];
          }

          this.cargarCanal();
        }
      },
      error: (err) => {
        this.loadingEmisores = false;
        this.errorMsg = 'Error al cargar el listado de emisores de la bolsa.';
        console.error(err);
      }
    });
  }

  /**
   * Consulta el canal bursátil del emisor seleccionado
   */
  cargarCanal(): void {
    if (!this.selectedCodigoSeb) return;

    this.loading = true;
    this.errorMsg = '';
    this.selectedEmisorObj = this.emisores.find((e) => e.codigo_seb === this.selectedCodigoSeb) || null;

    this.maximosMinimosService
      .getCanalHistorico(
        this.selectedCodigoSeb,
        this.selectedPeriodo,
        this.showProyeccion,
        this.diasProyeccion
      )
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.success) {
            this.canalData = res;
            this.construirGrafico();
          } else {
            this.errorMsg = res.message || 'No se pudieron recuperar los datos de canal.';
            this.canalData = null;
            this.chartData = null;
          }
          this.cd.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.errorMsg = 'Error de conexión con el servicio analítico de máximos y mínimos.';
          console.error(err);
          this.cd.markForCheck();
        }
      });
  }

  onEmisorChange(): void {
    this.cargarCanal();
  }

  onPeriodoChange(periodo: string): void {
    this.selectedPeriodo = periodo;
    this.cargarCanal();
  }

  toggleBandas(): void {
    this.showBandas = !this.showBandas;
    this.construirGrafico();
  }

  toggleProyeccion(): void {
    this.showProyeccion = !this.showProyeccion;
    this.cargarCanal();
  }

  toggleVolumen(): void {
    this.showVolumen = !this.showVolumen;
    this.construirGrafico();
  }

  /**
   * Construye los datasets de Chart.js sincronizados en escala de tiempo
   */
  private construirGrafico(): void {
    if (!this.canalData || !this.canalData.series || this.canalData.series.length === 0) {
      this.chartData = null;
      return;
    }

    const series = this.canalData.series;
    const datasets: any[] = [];

    // 1. Serie: Precio de Cierre Real
    const dataCierre = series.map((s) => ({ x: s.fecha, y: s.precio_cierre }));
    datasets.push({
      type: 'line',
      label: 'Precio Cierre Real ($)',
      data: dataCierre,
      borderColor: '#047857',
      backgroundColor: '#047857',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHitRadius: 10,
      pointBackgroundColor: '#047857',
      tension: 0.1,
      yAxisID: 'y',
      order: 1
    });

    // 2. Bandas Regulatorias BVQ (+-10%)
    if (this.showBandas) {
      const dataMax = series.map((s) => ({ x: s.fecha, y: s.precio_maximo }));
      const dataMin = series.map((s) => ({ x: s.fecha, y: s.precio_minimo }));

      datasets.push({
        type: 'line',
        label: 'Banda Máxima BVQ (+10%)',
        data: dataMax,
        borderColor: 'rgba(239, 68, 68, 0.75)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
        order: 3
      });

      datasets.push({
        type: 'line',
        label: 'Banda Mínima BVQ (-10%)',
        data: dataMin,
        borderColor: 'rgba(16, 185, 129, 0.75)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.1,
        fill: {
          target: '-1', // Rellena hacia el dataset anterior (Banda Máxima)
          above: 'rgba(16, 185, 129, 0.05)'
        },
        yAxisID: 'y',
        order: 4
      });
    }

    // 3. Cono de Proyección Monte Carlo Acotada
    if (this.showProyeccion && this.canalData.proyeccion_monte_carlo) {
      const curva = this.canalData.proyeccion_monte_carlo.curva_proyeccion;
      if (curva && curva.length > 0) {
        const dataP90 = curva.map((c) => ({ x: c.fecha_estimada, y: c.p90_optimista }));
        const dataP50 = curva.map((c) => ({ x: c.fecha_estimada, y: c.p50_mediana }));
        const dataP10 = curva.map((c) => ({ x: c.fecha_estimada, y: c.p10_conservador }));

        datasets.push({
          type: 'line',
          label: 'Monte Carlo: Escenario Base (P50 Mediana)',
          data: dataP50,
          borderColor: '#4f46e5',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.15,
          yAxisID: 'y',
          order: 2
        });

        datasets.push({
          type: 'line',
          label: 'Monte Carlo: Escenario Optimista (P90)',
          data: dataP90,
          borderColor: 'rgba(16, 185, 129, 0.85)',
          borderWidth: 1.5,
          borderDash: [2, 2],
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.15,
          yAxisID: 'y',
          order: 5
        });

        datasets.push({
          type: 'line',
          label: 'Monte Carlo: Escenario Pesimista (P10)',
          data: dataP10,
          borderColor: 'rgba(245, 158, 11, 0.85)',
          borderWidth: 1.5,
          borderDash: [2, 2],
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.15,
          fill: {
            target: '-1', // Rellena hacia P90 para formar el cono probabilístico
            above: 'rgba(99, 102, 241, 0.12)'
          },
          yAxisID: 'y',
          order: 6
        });
      }
    }

    // 4. Volumen Negociado en eje secundario y1 (anclado discretamente al fondo)
    if (this.showVolumen) {
      const dataVol = series.map((s) => ({ x: s.fecha, y: s.num_acciones }));
      const maxVol = Math.max(...series.map((s) => s.num_acciones || 0), 10);
      if (this.chartOptions?.scales?.y1) {
        this.chartOptions.scales.y1.max = maxVol * 4; // Asegura que las barras ocupen máximo el 25% inferior
      }

      datasets.push({
        type: 'bar',
        label: 'Volumen Acciones Negociadas',
        data: dataVol,
        backgroundColor: 'rgba(148, 163, 184, 0.25)',
        hoverBackgroundColor: 'rgba(100, 116, 139, 0.5)',
        yAxisID: 'y1',
        barThickness: series.length > 100 ? 2 : 4,
        order: 10
      });
    }

    this.chartData = { datasets };
    this.cd.markForCheck();
  }

  /**
   * Configura las opciones avanzadas de Chart.js (Dual Y-Axis, TimeScale en español)
   */
  private initChartOptions(): void {
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        datalabels: {
          display: false
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: {
              size: 11,
              weight: '600'
            },
            color: '#334155',
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 11 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            title: (items: any[]) => {
              if (!items.length) return '';
              const dateVal = items[0].parsed.x;
              const d = new Date(dateVal);
              return d.toLocaleDateString('es-EC', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });
            },
            label: (ctx: any) => {
              const label = ctx.dataset.label || '';
              const val = ctx.parsed.y;
              if (ctx.dataset.yAxisID === 'y1') {
                return ` ${label}: ${Number(val).toLocaleString('es-EC')} acc`;
              }
              return ` ${label}: $${Number(val).toFixed(4)}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          adapters: {
            date: {
              locale: es
            }
          },
          time: {
            displayFormats: {
              day: 'dd MMM',
              month: 'MMM yyyy',
              year: 'yyyy'
            },
            tooltipFormat: 'yyyy-MM-dd'
          },
          grid: {
            display: false
          },
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            maxTicksLimit: 12
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Precio por Acción (USD $)',
            color: '#047857',
            font: { size: 11, weight: 'bold' }
          },
          grid: {
            color: 'rgba(226, 232, 240, 0.6)'
          },
          ticks: {
            color: '#334155',
            font: { size: 10 },
            callback: (value: number) => `$${value.toFixed(2)}`
          }
        },
        y1: {
          type: 'linear',
          display: this.showVolumen,
          position: 'right',
          grid: {
            drawOnChartArea: false
          },
          min: 0,
          title: {
            display: false
          },
          ticks: {
            display: false
          }
        }
      }
    };
  }

  /**
   * Exporta las series históricas y proyecciones a un archivo Excel
   */
  exportarExcel(): void {
    if (!this.canalData || !this.canalData.series) return;

    const filasHistorial = this.canalData.series.map((s) => ({
      Fecha: s.fecha,
      'Nemotécnico': this.canalData?.metadata?.codigo_seb,
      'Emisor': this.canalData?.metadata?.emisor,
      'Precio Cierre ($)': s.precio_cierre,
      'Banda Mínima BVQ ($)': s.precio_minimo,
      'Banda Máxima BVQ ($)': s.precio_maximo,
      'Acciones Negociadas': s.num_acciones,
      'Monto Estimado USD ($)': s.volumen_estimado_usd,
      'Fecha Última Negociación': s.fecha_ult_negoc
    }));

    const wb = XLSX.utils.book_new();
    const wsHist = XLSX.utils.json_to_sheet(filasHistorial);
    XLSX.utils.book_append_sheet(wb, wsHist, 'Canal Histórico');

    if (this.canalData.proyeccion_monte_carlo?.curva_proyeccion) {
      const filasProy = this.canalData.proyeccion_monte_carlo.curva_proyeccion.map((p) => ({
        Día: p.dia_t,
        'Fecha Estimada': p.fecha_estimada,
        'Escenario Pesimista P10 ($)': p.p10_conservador,
        'Escenario Base P50 ($)': p.p50_mediana,
        'Escenario Optimista P90 ($)': p.p90_optimista
      }));
      const wsProy = XLSX.utils.json_to_sheet(filasProy);
      XLSX.utils.book_append_sheet(wb, wsProy, 'Proyección Monte Carlo');
    }

    const fileName = `Canal_Bursatil_${this.selectedCodigoSeb}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  getHito(clave: '30d' | '60d' | '90d'): ProyeccionHito | undefined {
    return this.canalData?.proyeccion_monte_carlo?.hitos?.[clave];
  }
}
