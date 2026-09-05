import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, Table } from 'primeng/table';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TabViewModule } from 'primeng/tabview';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DialogModule } from 'primeng/dialog';

import { AccionPosicionService } from '../../../core/accion-posicion.service';
import { AccionDividendoService } from '../../../core/accion-dividendo.service';
import { AccionOperacionService } from '../../../core/accion-operacion.service';
import { PersonaService } from '../../../core/persona.service';
import { InstrumentoService } from '../../../core/instrumento.service';
import { HistoricoIndicadorService } from '../../../core/historico-indicador.service';
import { AccionPosicion, AccionDividendo, AccionOperacion } from '../../../core/models/accion-models';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { ModalActionsComponent } from '../../../core/modal-actions';
import { PortfolioDashboardComponent } from '../../portfolio/portfolio-dashboard/portfolio-dashboard.component';

@Component({
  selector: 'app-portafolio-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    DropdownModule,
    ButtonModule,
    CardModule,
    ChartModule,
    TabViewModule,
    InputTextModule,
    TooltipModule,
    TagModule,
    InputSwitchModule,
    DialogModule,
    ModalActionsComponent,
    PortfolioDashboardComponent
  ],
  templateUrl: './portafolio-list.component.html',
  styleUrl: './portafolio-list.component.css'
})
export class PortafolioListComponent implements OnInit {
  posiciones: AccionPosicion[] = [];
  filteredPosiciones: AccionPosicion[] = [];
  displayPosiciones: AccionPosicion[] = [];
  modoConsolidado = false;
  dividendos: AccionDividendo[] = [];

  // Modal detalle operaciones
  displayDetalleOperacionesDialog = false;
  selectedPosicionRow: AccionPosicion | null = null;
  detalleOperaciones: AccionOperacion[] = [];
  loadingDetalleOperaciones = false;

  // Dropdown list options
  socios: any[] = [];
  instrumentos: any[] = [];

  // Filters
  selectedSocio: number | null = null;
  selectedInstrumento: number | null = null;

  // Loading and table properties
  loading = false;
  error = '';
  @ViewChild('dt') dt: Table | undefined;
  globalSearchQuery = '';
  sortField = 'capital_invertido';
  sortOrder = -1;

  // Indicators (KPI Cards)
  totalInvertido = 0;
  totalValorMercado = 0;
  utilidadNoRealizada = 0;
  porcentajeRendimiento = 0;
  totalDividendosCobrados = 0;

  // Chart data and configurations
  historicoChartData: any;
  historicoChartOptions: any;
  historicoList: any[] = [];

  emisorChartData: any;
  emisorChartOptions: any;
  emisorLegend: any[] = [];

  socioChartData: any;
  socioChartOptions: any;
  socioLegend: any[] = [];

  // Predefined HSL harmonious colors for stock distribution charts
  private colorsList = [
    '#22c55e', // Green
    '#3b82f6', // Blue
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#64748b', // Slate
    '#10b981', // Emerald
    '#a855f7', // Light Purple
    '#ef4444'  // Red
  ];

  cols = [
    { field: 'persona', header: 'Socio' },
    { field: 'instrumento', header: 'Emisor' },
    { field: 'cantidad_actual', header: 'Acciones' },
    { field: 'costo_promedio_unitario', header: 'Compra prom.' },
    { field: 'precio_ultimo', header: 'Último Precio' },
    { field: 'fecha_ultimo_precio', header: 'Fecha Cierre' },
    { field: 'precio_anterior', header: 'Precio Ant.' },
    { field: 'variacion_diaria', header: 'Var. Diaria' },
    { field: 'capital_invertido', header: 'Invertido' },
    { field: 'valor_mercado', header: 'Valor Actual' },
    { field: 'diferencia', header: 'Diferencia' },
    { field: 'utilidad_perdida_no_realizada', header: 'Plusvalía' }
  ];

  constructor(
    private posicionService: AccionPosicionService,
    private dividendoService: AccionDividendoService,
    private personaService: PersonaService,
    private instrumentoService: InstrumentoService,
    private operacionService: AccionOperacionService,
    private historicoService: HistoricoIndicadorService,
    private cdr: ChangeDetectorRef
  ) {
    this.setupChartOptions();
  }

  onRowSelect(row: AccionPosicion): void {
    this.selectedPosicionRow = row;
    this.displayDetalleOperacionesDialog = true;
    this.loadingDetalleOperaciones = true;
    this.detalleOperaciones = [];

    const filters: any = {};
    if (row.id_instrumento) {
      filters.id_instrumento = row.id_instrumento;
    }
    if (row.id_persona && row.id_persona > 0) {
      filters.id_persona = row.id_persona;
    } else if (this.selectedSocio) {
      filters.id_persona = this.selectedSocio;
    }

    this.operacionService.getAll(filters).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.detalleOperaciones = response.data;
        } else {
          this.detalleOperaciones = [];
        }
        this.loadingDetalleOperaciones = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar detalle de operaciones:', err);
        this.detalleOperaciones = [];
        this.loadingDetalleOperaciones = false;
        this.cdr.detectChanges();
      }
    });
  }

  getPersonaNombre(op: AccionOperacion): string {
    if (!op.persona) return '-';
    return `${op.persona.nombres || ''} ${op.persona.apellidos || ''}`.trim() || op.persona.nombre || '-';
  }

  getTipoOperacionNombre(op: AccionOperacion): string {
    return op.tipo_operacion?.nombre || op.tipoOperacion?.nombre || '-';
  }

  getAbsValue(val: number | undefined | null): number {
    return Math.abs(val || 0);
  }

  formatFechaLiquidacion(fecha: any): string {
    if (!fecha) return '-';
    const str = String(fecha).trim();
    if (str.startsWith('1969') || str.startsWith('1970') || str.startsWith('0000')) {
      return '-';
    }
    if (str.length >= 10 && str.match(/^\d{4}-\d{2}-\d{2}/)) {
      return str.substring(0, 10);
    }
    return str;
  }

  ngOnInit(): void {
    const savedSocio = localStorage.getItem('portafolio_selected_socio');
    const savedInstrumento = localStorage.getItem('portafolio_selected_instrumento');
    const savedConsolidado = localStorage.getItem('portafolio_modo_consolidado');
    const savedSortField = localStorage.getItem('portafolio_sort_field');
    const savedSortOrder = localStorage.getItem('portafolio_sort_order');
    const savedSearchQuery = localStorage.getItem('portafolio_search_query');

    this.selectedSocio = savedSocio ? Number(savedSocio) : null;
    this.selectedInstrumento = savedInstrumento ? Number(savedInstrumento) : null;
    this.modoConsolidado = savedConsolidado === 'true';
    this.sortField = savedSortField || 'capital_invertido';
    this.sortOrder = savedSortOrder ? Number(savedSortOrder) : -1;
    this.globalSearchQuery = savedSearchQuery || '';

    this.loadFiltros();
    this.loadData();
    this.loadHistoricoChart();
  }

  loadFiltros(): void {
    // Cargar socios
    this.personaService.getAll().subscribe({
      next: (data: any) => {
        const personasArray = Array.isArray(data) ? data : data?.data || [];
        this.socios = personasArray
          .filter((p: any) => p.activo === true || p.activo === 1)
          .map((p: any) => ({
            value: p.id_persona,
            label: `${p.nombres} ${p.apellidos}`.trim()
          }))
          .sort((a: any, b: any) => a.label.localeCompare(b.label));
      }
    });

    // Cargar instrumentos/acciones
    this.instrumentoService.getAll().subscribe({
      next: (data: any) => {
        const instrumentosArray = Array.isArray(data) ? data : data?.data || [];
        this.instrumentos = instrumentosArray
          .filter((i: any) => (i.activo === true || i.activo === 1) && i.id_tipo_inversion === 203)
          .map((i: any) => ({
            value: i.id_instrumento,
            label: i.nombre || i.codigo_titulo
          }))
          .sort((a: any, b: any) => a.label.localeCompare(b.label));
      }
    });
  }

  loadData(): void {
    this.loading = true;
    this.error = '';

    // Cargar posiciones
    this.posicionService.getPosiciones().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.posiciones = response.data;
          this.filteredPosiciones = [...this.posiciones];
        } else {
          this.posiciones = [];
          this.filteredPosiciones = [];
        }

        // Cargar dividendos en efectivo/mixtos para calcular el KPI de cobros
        this.dividendoService.getAll().subscribe({
          next: (divResponse) => {
            if (divResponse.success && divResponse.data) {
              // Filtrar solo los dividendos activos y no eliminados
              this.dividendos = divResponse.data.filter(
                (d) => d.activo && !d.eliminado
              );
            } else {
              this.dividendos = [];
            }
            
            // Aplicar filtros iniciales recuperados de localStorage
            this.filteredPosiciones = this.posiciones.filter(pos => {
              if (this.selectedSocio && pos.id_persona !== this.selectedSocio) {
                return false;
              }
              if (this.selectedInstrumento && pos.id_instrumento !== this.selectedInstrumento) {
                return false;
              }
              return true;
            });

            this.updateDisplayPosiciones();
            this.calculateMetricsAndCharts();
            this.loading = false;

            if (this.globalSearchQuery && this.dt) {
              setTimeout(() => {
                this.dt?.filterGlobal(this.globalSearchQuery, 'contains');
              }, 100);
            }

            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error al cargar dividendos en el portafolio:', err);
            this.dividendos = [];
            
            // Aplicar filtros iniciales en caso de error de dividendos también
            this.filteredPosiciones = this.posiciones.filter(pos => {
              if (this.selectedSocio && pos.id_persona !== this.selectedSocio) {
                return false;
              }
              if (this.selectedInstrumento && pos.id_instrumento !== this.selectedInstrumento) {
                return false;
              }
              return true;
            });

            this.updateDisplayPosiciones();
            this.calculateMetricsAndCharts();
            this.loading = false;

            if (this.globalSearchQuery && this.dt) {
              setTimeout(() => {
                this.dt?.filterGlobal(this.globalSearchQuery, 'contains');
              }, 100);
            }

            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        this.error = 'Error al cargar el portafolio: ' + err.message;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSort(event: any): void {
    if (event && event.field) {
      this.sortField = event.field;
      this.sortOrder = event.order;
      localStorage.setItem('portafolio_sort_field', this.sortField);
      localStorage.setItem('portafolio_sort_order', this.sortOrder.toString());
    }
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value || '';
    this.globalSearchQuery = val;
    localStorage.setItem('portafolio_search_query', val);
    if (this.dt) {
      this.dt.filterGlobal(val, 'contains');
    }
  }

  onFilterChange(): void {
    // Persistir filtros en localStorage
    if (this.selectedSocio !== null) {
      localStorage.setItem('portafolio_selected_socio', this.selectedSocio.toString());
    } else {
      localStorage.removeItem('portafolio_selected_socio');
    }

    if (this.selectedInstrumento !== null) {
      localStorage.setItem('portafolio_selected_instrumento', this.selectedInstrumento.toString());
    } else {
      localStorage.removeItem('portafolio_selected_instrumento');
    }

    localStorage.setItem('portafolio_modo_consolidado', this.modoConsolidado.toString());

    // Filtrar posiciones en memoria
    this.filteredPosiciones = this.posiciones.filter(pos => {
      if (this.selectedSocio && pos.id_persona !== this.selectedSocio) {
        return false;
      }
      if (this.selectedInstrumento && pos.id_instrumento !== this.selectedInstrumento) {
        return false;
      }
      return true;
    });

    this.updateDisplayPosiciones();
    this.calculateMetricsAndCharts();
  }

  clearFilters(): void {
    this.selectedSocio = null;
    this.selectedInstrumento = null;
    this.modoConsolidado = false;
    this.globalSearchQuery = '';
    this.sortField = 'capital_invertido';
    this.sortOrder = -1;

    localStorage.removeItem('portafolio_selected_socio');
    localStorage.removeItem('portafolio_selected_instrumento');
    localStorage.removeItem('portafolio_modo_consolidado');
    localStorage.removeItem('portafolio_sort_field');
    localStorage.removeItem('portafolio_sort_order');
    localStorage.removeItem('portafolio_search_query');

    if (this.dt) {
      this.dt.reset();
    }
    this.filteredPosiciones = [...this.posiciones];
    this.updateDisplayPosiciones();
    this.calculateMetricsAndCharts();
  }

  updateDisplayPosiciones(): void {
    if (this.modoConsolidado) {
      this.displayPosiciones = this.consolidarPosiciones(this.filteredPosiciones);
    } else {
      this.displayPosiciones = [...this.filteredPosiciones];
    }
  }

  consolidarPosiciones(list: AccionPosicion[]): AccionPosicion[] {
    const mapa = new Map<number, AccionPosicion[]>();
    
    list.forEach(pos => {
      const key = pos.id_instrumento;
      if (!mapa.has(key)) {
        mapa.set(key, []);
      }
      mapa.get(key)!.push(pos);
    });

    const resultado: AccionPosicion[] = [];

    mapa.forEach((items, idInst) => {
      const cantTotal = items.reduce((sum, p) => sum + (p.cantidad_actual || 0), 0);
      const capInvertidoTotal = items.reduce((sum, p) => sum + (p.capital_invertido || 0), 0);
      const valorMercadoTotal = items.reduce((sum, p) => sum + (p.valor_mercado || 0), 0);
      const costoPromUnitario = cantTotal > 0 ? capInvertidoTotal / cantTotal : 0;
      const utilidadPerdida = valorMercadoTotal - capInvertidoTotal;

      resultado.push({
        id_instrumento: idInst,
        id_emisor: items[0].id_emisor,
        id_persona: 0,
        persona: 'TODOS',
        instrumento: items[0].instrumento,
        cantidad_actual: cantTotal,
        costo_promedio_unitario: costoPromUnitario,
        capital_invertido: capInvertidoTotal,
        precio_ultimo: items[0].precio_ultimo,
        precio_anterior: items[0].precio_anterior,
        fecha_anterior: items[0].fecha_anterior,
        cambio_diario: items[0].cambio_diario,
        variacion_diaria_pct: items[0].variacion_diaria_pct,
        tendencia_diaria: items[0].tendencia_diaria,
        fecha_ultimo_precio: items[0].fecha_ultimo_precio,
        valor_mercado: valorMercadoTotal,
        utilidad_perdida_no_realizada: utilidadPerdida
      });
    });

    return resultado.sort((a, b) => (a.instrumento || '').localeCompare(b.instrumento || ''));
  }

  calculateMetricsAndCharts(): void {
    let sumInvertido = 0;
    let sumValorMercado = 0;
    
    this.filteredPosiciones.forEach(pos => {
      sumInvertido += pos.capital_invertido || 0;
      sumValorMercado += pos.valor_mercado || 0;
    });

    this.totalInvertido = sumInvertido;
    this.totalValorMercado = sumValorMercado;
    this.utilidadNoRealizada = sumValorMercado - sumInvertido;
    this.porcentajeRendimiento = sumInvertido > 0 ? (this.utilidadNoRealizada / sumInvertido) * 100 : 0;

    // Calcular dividendos totales de la selección
    let sumDividendos = 0;
    this.dividendos.forEach(div => {
      // Filtrar por socio/instrumento seleccionados
      if (this.selectedSocio && div.id_persona !== this.selectedSocio) return;
      if (this.selectedInstrumento && div.id_instrumento !== this.selectedInstrumento) return;
      
      // Sumar el neto cobrado en efectivo (ID 209: Efectivo, ID 211: Mixto)
      if (div.id_tipo_dividendo === 209 || div.id_tipo_dividendo === 211) {
        sumDividendos += div.valor_neto || 0;
      }
    });
    this.totalDividendosCobrados = sumDividendos;

    // Generar gráficos circulares
    this.generateEmisorChart();
    this.generateSocioChart();
  }

  private generateEmisorChart(): void {
    const counts = new Map<string, number>();
    
    this.filteredPosiciones.forEach(pos => {
      const emisor = pos.instrumento || 'DESCONOCIDO';
      const val = pos.valor_mercado || 0;
      counts.set(emisor, (counts.get(emisor) || 0) + val);
    });

    const rawList = Array.from(counts.entries()).map(([label, val]) => ({
      label,
      valor: Number(Number(val).toFixed(2))
    })).sort((a, b) => b.valor - a.valor);

    const total = rawList.reduce((sum, item) => sum + item.valor, 0);
    const topCount = 7;
    let chartList: any[] = [];
    
    if (rawList.length > topCount + 1) {
      chartList = rawList.slice(0, topCount);
      const restSum = rawList.slice(topCount).reduce((sum, item) => sum + item.valor, 0);
      chartList.push({
        label: 'Otros Emisores',
        valor: restSum
      });
    } else {
      chartList = [...rawList];
    }

    const labels = chartList.map(item => item.label);
    const data = chartList.map(item => item.valor);

    this.emisorChartData = {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: this.colorsList.slice(0, labels.length),
        borderWidth: 1
      }]
    };

    this.emisorLegend = chartList.map((item, idx) => ({
      color: this.colorsList[idx % this.colorsList.length],
      label: item.label,
      valor: item.valor,
      porcentaje: total > 0 ? ((item.valor / total) * 100).toFixed(1) + '%' : '0%'
    }));
  }

  private generateSocioChart(): void {
    const counts = new Map<string, number>();
    
    this.filteredPosiciones.forEach(pos => {
      const socio = pos.persona || 'DESCONOCIDO';
      const val = pos.valor_mercado || 0;
      counts.set(socio, (counts.get(socio) || 0) + val);
    });

    const rawList = Array.from(counts.entries()).map(([label, val]) => ({
      label,
      valor: Number(Number(val).toFixed(2))
    })).sort((a, b) => b.valor - a.valor);

    const total = rawList.reduce((sum, item) => sum + item.valor, 0);
    const labels = rawList.map(item => item.label);
    const data = rawList.map(item => item.valor);

    this.socioChartData = {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: this.colorsList.slice(2, 2 + labels.length),
        borderWidth: 1
      }]
    };

    this.socioLegend = rawList.map((item, idx) => ({
      color: this.colorsList[(2 + idx) % this.colorsList.length],
      label: item.label,
      valor: item.valor,
      porcentaje: total > 0 ? ((item.valor / total) * 100).toFixed(1) + '%' : '0%'
    }));
  }

  setupChartOptions(): void {
    this.emisorChartOptions = {
      cutout: '70%',
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          backgroundColor: 'rgba(33, 37, 41, 0.95)',
          padding: 10,
          titleFont: { size: 11, weight: 'bold' },
          bodyFont: { size: 11 },
          callbacks: {
            label: (context: any) => {
              const value = context.raw;
              const formattedVal = this.formatCurrency(value);
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
              return ` ${context.label}: ${formattedVal} (${pct})`;
            }
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };

    this.socioChartOptions = {
      cutout: '70%',
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          backgroundColor: 'rgba(33, 37, 41, 0.95)',
          padding: 10,
          titleFont: { size: 11, weight: 'bold' },
          bodyFont: { size: 11 },
          callbacks: {
            label: (context: any) => {
              const value = context.raw;
              const formattedVal = this.formatCurrency(value);
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
              return ` ${context.label}: ${formattedVal} (${pct})`;
            }
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };
  }

  loadHistoricoChart(): void {
    this.historicoService.getHistorico().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          // Ordenar cronológicamente por fecha_captura ASC
          this.historicoList = res.data.sort((a: any, b: any) => 
            new Date(a.fecha_captura).getTime() - new Date(b.fecha_captura).getTime()
          );

          const labels = this.historicoList.map(item => {
            if (!item.fecha_captura) return '-';
            const parts = item.fecha_captura.split('-');
            if (parts.length === 3) {
              return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return item.fecha_captura;
          });

          const capitalData = this.historicoList.map(item => {
            if (item.capital_renta_variable && item.capital_renta_variable > 0) {
              return Number(item.capital_renta_variable);
            }
            return Number(item.patrimonio_base || 0);
          });

          const valorMercadoData = this.historicoList.map(item => {
            if (item.valor_mercado_renta_variable && item.valor_mercado_renta_variable > 0) {
              return Number(item.valor_mercado_renta_variable);
            }
            const cap = Number(item.capital_renta_variable || item.patrimonio_base || 0);
            const plus = Number(item.plusvalia_acciones || 0);
            return cap + plus;
          });

          const plusvaliaData = this.historicoList.map(item => {
            if (item.plusvalia_latente_rv !== undefined && item.plusvalia_latente_rv !== null && item.plusvalia_latente_rv !== 0) {
              return Number(item.plusvalia_latente_rv);
            }
            return Number(item.plusvalia_acciones || 0);
          });

          this.historicoChartData = {
            labels: labels,
            datasets: [
              {
                label: 'Valor de Mercado ($)',
                data: valorMercadoData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                fill: true,
                tension: 0.35,
                borderWidth: 2.5,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#ffffff',
                pointHoverRadius: 6,
                pointRadius: 4
              },
              {
                label: 'Capital Invertido ($)',
                data: capitalData,
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.35,
                borderWidth: 2,
                borderDash: [5, 5],
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointHoverRadius: 5,
                pointRadius: 3
              },
              {
                label: 'Plusvalía Latente ($)',
                data: plusvaliaData,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.08)',
                fill: true,
                tension: 0.35,
                borderWidth: 2,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#ffffff',
                pointHoverRadius: 5,
                pointRadius: 3
              }
            ]
          };

          this.setupHistoricoChartOptions();
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error al cargar grafico historico de RV:', err);
      }
    });
  }

  setupHistoricoChartOptions(): void {
    this.historicoChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12, weight: 'bold' }
          }
        },
        datalabels: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12,
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 },
          callbacks: {
            label: (context: any) => {
              const value = context.raw;
              const formatted = this.formatCurrency(value);
              return ` ${context.dataset.label}: ${formatted}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(226, 232, 240, 0.8)' },
          ticks: {
            font: { size: 11 },
            callback: (value: any) => this.formatCurrency(value)
          }
        }
      }
    };
  }

  onGlobalFilter(event: Event): void {
    if (this.dt) {
      this.dt.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }
  }

  get tableTotalAcciones(): number {
    const list = (this.dt?.filteredValue !== undefined && this.dt?.filteredValue !== null) 
      ? this.dt.filteredValue 
      : this.displayPosiciones;
    return list.reduce((sum, item) => sum + (Number(item.cantidad_actual) || 0), 0);
  }

  get tableTotalCapitalInvertido(): number {
    const list = (this.dt?.filteredValue !== undefined && this.dt?.filteredValue !== null) 
      ? this.dt.filteredValue 
      : this.displayPosiciones;
    return list.reduce((sum, item) => sum + (Number(item.capital_invertido) || 0), 0);
  }

  get tableTotalValorMercado(): number {
    const list = (this.dt?.filteredValue !== undefined && this.dt?.filteredValue !== null) 
      ? this.dt.filteredValue 
      : this.displayPosiciones;
    return list.reduce((sum, item) => sum + (Number(item.valor_mercado) || 0), 0);
  }

  get tableTotalDiferencia(): number {
    return this.tableTotalValorMercado - this.tableTotalCapitalInvertido;
  }

  get tableTotalCostoPromedio(): number {
    const totalAcc = this.tableTotalAcciones;
    return totalAcc > 0 ? this.tableTotalCapitalInvertido / totalAcc : 0;
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  formatNumber(value: number | null | undefined, decimals = 2): string {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  }

  exportToExcel(): void {
    const dataToExport = this.dt?.filteredValue || this.displayPosiciones;
    const exportData = dataToExport.map(pos => ({
      Socio: pos.persona || '-',
      Acción: pos.instrumento || '-',
      'Cantidad': pos.cantidad_actual || 0,
      'Costo Promedio': pos.costo_promedio_unitario || 0,
      'Capital Invertido': pos.capital_invertido || 0,
      'Último Precio': pos.precio_ultimo || 0,
      'Precio Anterior': pos.precio_anterior || 0,
      'Var. Diaria ($)': pos.cambio_diario || 0,
      'Var. Diaria (%)': pos.variacion_diaria_pct || 0,
      'Fecha Cierre': pos.fecha_ultimo_precio || '-',
      'Valor Mercado': pos.valor_mercado || 0,
      'Plusvalía / Minusvalía': pos.utilidad_perdida_no_realizada || 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Portafolio RV');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `portafolio_renta_variable_${new Date().toISOString().split('T')[0]}.xlsx`;

    saveAs(blob, fileName);
  }

  exportToPDF(): void {
    const dataToExport = this.dt?.filteredValue || this.displayPosiciones;
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Portafolio Consolidado - Renta Variable (Acciones)', 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = dataToExport.map(pos => [
      pos.persona || '-',
      pos.instrumento || '-',
      this.formatNumber(pos.cantidad_actual, 2),
      this.formatCurrency(pos.costo_promedio_unitario),
      this.formatCurrency(pos.precio_ultimo),
      this.formatCurrency(pos.precio_anterior),
      `${pos.cambio_diario ? (pos.cambio_diario > 0 ? '+' : '') + this.formatCurrency(pos.cambio_diario) : '$0.00'} (${this.formatNumber(pos.variacion_diaria_pct, 2)}%)`,
      this.formatCurrency(pos.capital_invertido),
      pos.fecha_ultimo_precio || '-',
      this.formatCurrency(pos.valor_mercado),
      this.formatCurrency(pos.utilidad_perdida_no_realizada)
    ]);

    autoTable(doc, {
      head: [['Socio', 'Acción', 'Cantidad', 'Precio Prom.', 'Últ. Precio', 'Precio Ant.', 'Var. Diaria', 'Cap. Invertido', 'F. Cierre', 'Valor Mercado', 'Plus/Minusvalía']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 167, 69] } // Color verde característico para Portafolios
    });

    doc.save(`portafolio_renta_variable_${new Date().toISOString().split('T')[0]}.pdf`);
  }
}
