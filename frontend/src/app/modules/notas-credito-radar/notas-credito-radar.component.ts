import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TabViewModule } from 'primeng/tabview';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  NotasCreditoRadarService,
  RadarFiltrosResponse,
  NotaCreditoRadarItem,
  RadarKpis,
  DistribucionTramo,
  TopVendedoraOportunidad,
  SimulacionArbitrajeResponse
} from '../../core/notas-credito-radar.service';

@Component({
  selector: 'app-notas-credito-radar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TooltipModule,
    DialogModule,
    TagModule,
    TabViewModule
  ],
  templateUrl: './notas-credito-radar.component.html',
  styleUrl: './notas-credito-radar.component.css'
})
export class NotasCreditoRadarComponent implements OnInit {
  loading: boolean = false;
  loadingFiltros: boolean = false;
  error: string = '';

  // Filtros del Radar
  fechaInicio: string = '';
  fechaFin: string = '';
  precioMaxOportunidad: number = 97.50;
  soloOportunidades: boolean = false;
  tramoNominal: 'todos' | 'micro' | 'pequeno' | 'mediano' | 'grande' = 'todos';
  casaVendedora: string = '';
  casaCompradora: string = '';
  bolsaSeleccionada: string = 'TODAS';
  tituloSeleccionado: string = 'TODOS';
  presetSeleccionado: string = '30dias';
  searchTerm: string = '';

  // Datos para listas desplegables
  casasVendedorasList: string[] = [];
  casasCompradorasList: string[] = [];
  bolsasList: string[] = ['TODAS', 'BVG', 'BVQ'];
  titulosList: string[] = ['TODOS', 'NOTA DE CREDITO', 'NOTA DE CREDITO ISD'];
  fechaMinimaDisponible: string = '2019-01-01';
  fechaMaximaDisponible: string = '';
  totalHistoricoRegistros: number = 0;

  // KPIs y Datos del Radar
  kpis: RadarKpis | null = null;
  items: NotaCreditoRadarItem[] = [];
  filteredItems: NotaCreditoRadarItem[] = [];
  distribucionTramos: DistribucionTramo[] = [];
  topVendedoras: TopVendedoraOportunidad[] = [];

  // Pestañas de Navegación Interna
  activeTabIndex: number = 0;
  activeTab: 'radar' | 'analisis_tramos' = 'radar';

  onTabChange(index: number) {
    this.activeTabIndex = index;
    this.activeTab = index === 0 ? 'radar' : 'analisis_tramos';
  }

  // Modal de Simulación de Arbitraje
  displaySimulacionModal: boolean = false;
  simulando: boolean = false;
  simValorNominal: number = 5000;
  simPrecioCompra: number = 96.50;
  simPrecioVenta: number = 98.90;
  simComisionCompra: number = 0.15;
  simComisionVenta: number = 0.15;
  simDiasRotacion: number = 25;
  simResultado: SimulacionArbitrajeResponse['data'] | null = null;
  notaSeleccionadaParaSim: NotaCreditoRadarItem | null = null;

  constructor(private radarService: NotasCreditoRadarService) {}

  ngOnInit(): void {
    this.cargarFiltrosIniciales();
  }

  /**
   * Carga los metadatos y filtros iniciales
   */
  cargarFiltrosIniciales(): void {
    this.loadingFiltros = true;
    this.radarService.getFiltros().subscribe({
      next: (res: RadarFiltrosResponse) => {
        this.loadingFiltros = false;
        if (res.success) {
          this.fechaMinimaDisponible = res.fecha_minima;
          this.fechaMaximaDisponible = res.fecha_maxima;
          this.fechaInicio = res.default_fecha_inicio;
          this.fechaFin = res.default_fecha_fin;
          this.totalHistoricoRegistros = res.total_registros_historicos;
          this.casasVendedorasList = res.casas_vendedoras || [];
          this.casasCompradorasList = res.casas_compradoras || [];
          if (res.bolsas && res.bolsas.length) {
            this.bolsasList = ['TODAS', ...res.bolsas];
          }
          if (res.titulos && res.titulos.length) {
            this.titulosList = ['TODOS', ...res.titulos];
          }

          // Ejecutar búsqueda inicial
          this.ejecutarConsulta();
        }
      },
      error: (err) => {
        this.loadingFiltros = false;
        console.error('Error al cargar filtros:', err);
        // Fechas por defecto
        const now = new Date();
        this.fechaFin = now.toISOString().split('T')[0];
        const past = new Date();
        past.setDate(past.getDate() - 30);
        this.fechaInicio = past.toISOString().split('T')[0];
        this.ejecutarConsulta();
      }
    });
  }

  /**
   * Consulta el backend con los filtros actuales
   */
  ejecutarConsulta(): void {
    this.loading = true;
    this.error = '';

    const payload = {
      fecha_inicio: this.fechaInicio,
      fecha_fin: this.fechaFin,
      precio_max_oportunidad: this.precioMaxOportunidad,
      solo_oportunidades: this.soloOportunidades,
      tramo_nominal: this.tramoNominal,
      casa_vendedora: this.casaVendedora,
      casa_compradora: this.casaCompradora,
      bolsa: this.bolsaSeleccionada,
      titulo: this.tituloSeleccionado
    };

    this.radarService.getRadarOportunidades(payload).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.kpis = res.kpis;
          this.items = res.items || [];
          this.distribucionTramos = res.distribucion_tramos || [];
          this.topVendedoras = res.top_vendedoras_oportunidad || [];
          this.aplicarFiltroTexto();
        } else {
          this.error = 'No se pudieron recuperar datos del radar.';
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Error al consultar radar:', err);
        this.error = 'Ocurrió un error al consultar el radar de oportunidades.';
      }
    });
  }

  /**
   * Aplica presets rápidos de fechas
   */
  aplicarPreset(preset: string): void {
    this.presetSeleccionado = preset;
    const refDate = this.fechaMaximaDisponible ? new Date(this.fechaMaximaDisponible + 'T12:00:00') : new Date();
    const endStr = refDate.toISOString().split('T')[0];
    this.fechaFin = endStr;

    const start = new Date(refDate);

    switch (preset) {
      case 'hoy':
        this.fechaInicio = endStr;
        break;
      case '7dias':
        start.setDate(refDate.getDate() - 7);
        this.fechaInicio = start.toISOString().split('T')[0];
        break;
      case '30dias':
        start.setDate(refDate.getDate() - 30);
        this.fechaInicio = start.toISOString().split('T')[0];
        break;
      case 'esteMes':
        start.setDate(1);
        this.fechaInicio = start.toISOString().split('T')[0];
        break;
      case 'esteAnio':
        this.fechaInicio = `${refDate.getFullYear()}-01-01`;
        break;
      case 'historico':
        this.fechaInicio = this.fechaMinimaDisponible || '2019-01-01';
        break;
    }

    this.ejecutarConsulta();
  }

  /**
   * Filtro de búsqueda rápida en la tabla
   */
  aplicarFiltroTexto(): void {
    if (!this.searchTerm.trim()) {
      this.filteredItems = [...this.items];
      return;
    }
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredItems = this.items.filter(it =>
      (it.casa_vendedora && it.casa_vendedora.toLowerCase().includes(term)) ||
      (it.casa_compradora && it.casa_compradora.toLowerCase().includes(term)) ||
      (it.titulo && it.titulo.toLowerCase().includes(term)) ||
      (it.fecha && it.fecha.includes(term)) ||
      (it.bolsa && it.bolsa.toLowerCase().includes(term)) ||
      (it.precio_porc && it.precio_porc.toString().includes(term))
    );
  }

  limpiarFiltros(): void {
    this.casaVendedora = '';
    this.casaCompradora = '';
    this.bolsaSeleccionada = 'TODAS';
    this.tituloSeleccionado = 'TODOS';
    this.tramoNominal = 'todos';
    this.soloOportunidades = false;
    this.precioMaxOportunidad = 97.50;
    this.searchTerm = '';
    this.aplicarPreset('30dias');
  }

  /**
   * Abre el simulador de arbitraje cargando los datos de una nota
   */
  abrirSimulador(item?: NotaCreditoRadarItem): void {
    this.displaySimulacionModal = true;
    if (item) {
      this.notaSeleccionadaParaSim = item;
      this.simValorNominal = item.valor_nominal;
      this.simPrecioCompra = item.precio_porc;
    } else {
      this.notaSeleccionadaParaSim = null;
      this.simValorNominal = 5000;
      this.simPrecioCompra = 96.50;
    }
    this.simPrecioVenta = this.kpis?.precio_referencia_mayorista || 98.90;
    this.calcularSimulacion();
  }

  /**
   * Ejecuta el cálculo de arbitraje en el simulador
   */
  calcularSimulacion(): void {
    this.simulando = true;
    this.radarService.simularArbitraje({
      valor_nominal: this.simValorNominal,
      precio_compra: this.simPrecioCompra,
      precio_venta: this.simPrecioVenta,
      comision_compra_pct: this.simComisionCompra,
      comision_venta_pct: this.simComisionVenta,
      dias_rotacion: this.simDiasRotacion
    }).subscribe({
      next: (res) => {
        this.simulando = false;
        if (res.success) {
          this.simResultado = res.data;
        }
      },
      error: (err) => {
        this.simulando = false;
        console.error('Error al simular:', err);
      }
    });
  }

  // ==========================================
  // EXPORTACIÓN A EXCEL
  // ==========================================
  exportarExcel(): void {
    if (!this.items.length) return;

    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen y KPIs
    const wsKpisData: any[][] = [
      ['SIPRO - RADAR DE OPORTUNIDADES Y ARBITRAJE DE NOTAS DE CRÉDITO (SRI)'],
      [`Período: ${this.fechaInicio} al ${this.fechaFin}`],
      [`Filtro Tramo: ${this.tramoNominal.toUpperCase()} | Umbral Oportunidad: <= ${this.precioMaxOportunidad}%`],
      [''],
      ['MÉTRICA', 'VALOR'],
      ['Total Operaciones Analizadas', this.kpis?.total_operaciones || 0],
      ['Volumen Nominal Total (USD)', this.kpis?.volumen_nominal || 0],
      ['Volumen Efectivo Total (USD)', this.kpis?.volumen_efectivo || 0],
      ['Ahorro / Descuento Total del Mercado (USD)', this.kpis?.ahorro_descuento_total || 0],
      ['Precio Mínimo de Mercado (%)', this.kpis?.precio_minimo || 0],
      ['Precio Promedio Ponderado (%)', this.kpis?.precio_promedio_ponderado || 0],
      ['Precio Máximo de Mercado (%)', this.kpis?.precio_maximo || 0],
      ['Spread del Período (Puntos %)', this.kpis?.spread_periodo || 0],
      ['Oportunidades de Compra Detectadas', this.kpis?.total_oportunidades || 0],
      ['Volumen Nominal Oportunidades (USD)', this.kpis?.volumen_oportunidades_nominal || 0],
      ['Precio Referencia Mayorista (>= $50k) (%)', this.kpis?.precio_referencia_mayorista || 99.00]
    ];
    const wsKpis = XLSX.utils.aoa_to_sheet(wsKpisData);
    XLSX.utils.book_append_sheet(wb, wsKpis, 'Resumen KPIs');

    // Hoja 2: Transacciones y Oportunidades
    const wsHeaders = [
      'Fecha', 'Bolsa', 'Título', 'Emisor', 'Precio %',
      'Valor Nominal (USD)', 'Valor Efectivo (USD)', 'Descuento (USD)',
      'Casa Vendedora', 'Casa Compradora', 'Categoría',
      'Spread vs Mayorista (pts)', 'Ganancia Potencial (USD)'
    ];

    const wsData: any[][] = [wsHeaders];
    this.filteredItems.forEach(it => {
      wsData.push([
        it.fecha,
        it.bolsa,
        it.titulo,
        it.emisor,
        it.precio_porc,
        it.valor_nominal,
        it.valor_efectivo,
        it.descuento_usd,
        it.casa_vendedora,
        it.casa_compradora,
        it.categoria,
        it.spread_vs_mayorista,
        it.ganancia_potencial_usd
      ]);
    });

    const wsDetalle = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Oportunidades');

    // Hoja 3: Distribución por Tramos
    if (this.distribucionTramos.length) {
      const wsTramosHeaders = ['Tramo Nominal', 'Total Operaciones', 'Volumen Nominal (USD)', 'Precio Promedio (%)', 'Precio Mínimo (%)', 'Precio Máximo (%)'];
      const wsTramosData: any[][] = [wsTramosHeaders];
      this.distribucionTramos.forEach(t => {
        wsTramosData.push([t.tramo, t.total_ops, t.nominal, t.precio_promedio, t.precio_minimo, t.precio_maximo]);
      });
      const wsTramos = XLSX.utils.aoa_to_sheet(wsTramosData);
      XLSX.utils.book_append_sheet(wb, wsTramos, 'Tramos de Monto');
    }

    const fileName = `radar-notas-credito-${this.fechaInicio}_${this.fechaFin}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // ==========================================
  // EXPORTACIÓN A PDF
  // ==========================================
  exportarPdf(): void {
    if (!this.items.length) return;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });

    // Encabezado
    doc.setFillColor(16, 149, 193); // Azul corporativo
    doc.rect(0, 0, doc.internal.pageSize.width, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SIPRO - RADAR DE OPORTUNIDADES Y ARBITRAJE DE NOTAS DE CRÉDITO (SRI)', 30, 28);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${this.fechaInicio} al ${this.fechaFin} | Generado: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.width - 250, 28);

    // Resumen de KPIs en bloque
    doc.setTextColor(33, 37, 41);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Métricas Clave del Período', 30, 65);

    const kpiHeaders = [['Total Ops', 'Vol. Nominal', 'Vol. Efectivo', 'P. Mínimo', 'P. Promedio Ponderado', 'P. Máximo', 'Oportunidades (<= ' + this.precioMaxOportunidad + '%)', 'Ref. Mayorista']];
    const kpiBody = [[
      this.kpis?.total_operaciones?.toString() || '0',
      '$' + (this.kpis?.volumen_nominal?.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0'),
      '$' + (this.kpis?.volumen_efectivo?.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0'),
      (this.kpis?.precio_minimo?.toFixed(2) || '0') + '%',
      (this.kpis?.precio_promedio_ponderado?.toFixed(2) || '0') + '%',
      (this.kpis?.precio_maximo?.toFixed(2) || '0') + '%',
      (this.kpis?.total_oportunidades?.toString() || '0') + ' ops ($' + (this.kpis?.volumen_oportunidades_nominal?.toLocaleString('es-EC', { maximumFractionDigits: 0 }) || '0') + ')',
      (this.kpis?.precio_referencia_mayorista?.toFixed(2) || '99.00') + '%'
    ]];

    autoTable(doc, {
      head: kpiHeaders,
      body: kpiBody,
      startY: 72,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
      headStyles: { fillColor: [52, 58, 64], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    // Tabla de Detalle de Oportunidades
    const currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Listado de Operaciones y Oportunidades de Compra Detectadas', 30, currentY);

    const tableHeaders = [['Fecha', 'Bolsa', 'Título', 'Precio %', 'Nominal (USD)', 'Efectivo (USD)', 'Casa Vendedora (Oferente)', 'Casa Compradora', 'Categoría', 'Ganancia Estim.']];
    const tableBody = this.filteredItems.slice(0, 150).map(it => [
      it.fecha,
      it.bolsa,
      it.titulo.replace('NOTA DE CREDITO', 'NC'),
      it.precio_porc.toFixed(2) + '%',
      '$' + it.valor_nominal.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      '$' + it.valor_efectivo.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      it.casa_vendedora,
      it.casa_compradora,
      it.categoria,
      '+$' + it.ganancia_potencial_usd.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ]);

    autoTable(doc, {
      head: tableHeaders,
      body: tableBody,
      startY: currentY + 6,
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: [16, 149, 193], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        8: { halign: 'center' },
        9: { halign: 'right', fontStyle: 'bold' }
      }
    });

    const fileName = `radar-notas-credito-${this.fechaInicio}_${this.fechaFin}.pdf`;
    doc.save(fileName);
  }
}

