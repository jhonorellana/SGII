import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AccionOperacionService } from '../../../core/accion-operacion.service';
import { PersonaService } from '../../../core/persona.service';
import { EmisorService } from '../../../core/emisor.service';
import { InstrumentoService } from '../../../core/instrumento.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-analisis-ventas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartModule,
    TableModule,
    ButtonModule,
    TooltipModule
  ],
  templateUrl: './analisis-ventas.component.html',
  styleUrl: './analisis-ventas.component.css'
})
export class AnalisisVentaAccionComponent implements OnInit {
  @ViewChild('dt') dt: Table | undefined;

  loading: boolean = false;
  error: string = '';

  // Filtros
  idPersonaFiltro: number | null = null;
  idEmisorFiltro: number | null = null;
  idInstrumentoFiltro: number | null = null;
  fechaDesdeFiltro: string = '';
  fechaHastaFiltro: string = '';

  // Opciones para Selects
  personas: any[] = [];
  emisores: any[] = [];
  instrumentos: any[] = [];

  // Datos provenientes del Backend
  ventas: any[] = [];
  summary: any = {
    total_ventas_count: 0,
    total_cantidad_vendida: 0,
    total_valor_bruto: 0,
    total_comisiones: 0,
    total_valor_neto: 0,
    total_costo_base: 0,
    total_utilidad_perdida: 0,
    roi_promedio_ponderado: 0,
    ventas_ganancia_count: 0,
    ventas_perdida_count: 0,
    ventas_neutra_count: 0
  };

  // Datos para Gráficos
  chartsDataRaw: any = {
    por_emisor: [],
    por_socio: [],
    por_anio: []
  };

  chartEmisorData: any = null;
  chartEmisorOptions: any = null;

  chartAnioData: any = null;
  chartAnioOptions: any = null;

  chartSocioData: any = null;
  chartSocioOptions: any = null;

  vistaGrafico: 'emisor' | 'anio' | 'socio' = 'emisor';

  constructor(
    private operacionService: AccionOperacionService,
    private personaService: PersonaService,
    private emisorService: EmisorService,
    private instrumentoService: InstrumentoService
  ) {}

  ngOnInit(): void {
    this.cargarSelects();
    this.cargarAnalisisVentas();
  }

  cargarSelects(): void {
    this.personaService.getAll().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : res?.data || [];
        this.personas = data.map((p: any) => ({
          id: p.id_persona,
          nombre: p.nombre || `${p.nombres || ''} ${p.apellidos || ''}`.trim()
        }));
      }
    });

    this.emisorService.getEmisores().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : res?.data || [];
        this.emisores = data.map((e: any) => ({
          id: e.id_emisor,
          nombre: e.nombre
        }));
      }
    });

    this.instrumentoService.getAll().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : res?.data || [];
        // Solo instrumentos de Renta Variable (203)
        this.instrumentos = data
          .filter((i: any) => (i.activo === true || i.activo === 1) && i.id_tipo_inversion === 203)
          .map((i: any) => ({
            id: i.id_instrumento,
            nombre: i.nombre || i.codigo_titulo
          }));
      }
    });
  }

  cargarAnalisisVentas(): void {
    this.loading = true;
    this.error = '';

    const filters = {
      id_persona: this.idPersonaFiltro || undefined,
      id_emisor: this.idEmisorFiltro || undefined,
      id_instrumento: this.idInstrumentoFiltro || undefined,
      fecha_desde: this.fechaDesdeFiltro || undefined,
      fecha_hasta: this.fechaHastaFiltro || undefined
    };

    this.operacionService.getAnalisisVentas(filters).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.ventas = res.data || [];
          this.summary = res.summary || this.summary;
          this.chartsDataRaw = res.charts || this.chartsDataRaw;

          this.configurarGraficos();
        } else {
          this.error = res.message || 'Error al cargar los datos';
        }
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error al cargar análisis de ventas de acciones:', err);
        this.error = 'Ocurrió un error al consultar el servidor.';
        this.loading = false;
      }
    });
  }

  limpiarFiltros(): void {
    this.idPersonaFiltro = null;
    this.idEmisorFiltro = null;
    this.idInstrumentoFiltro = null;
    this.fechaDesdeFiltro = '';
    this.fechaHastaFiltro = '';
    this.cargarAnalisisVentas();
  }

  configurarGraficos(): void {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color') || '#334155';
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary') || '#64748b';
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border') || '#e2e8f0';

    // 1. Gráfico por Emisor
    const emisoresList = this.chartsDataRaw.por_emisor || [];
    const emisorLabels = emisoresList.map((e: any) => e.emisor);
    const emisorUtilidades = emisoresList.map((e: any) => e.utilidad_perdida);
    const emisorValoresNetos = emisoresList.map((e: any) => e.valor_neto);

    this.chartEmisorData = {
      labels: emisorLabels,
      datasets: [
        {
          label: 'Ganancia / Pérdida Realizada ($)',
          backgroundColor: emisorUtilidades.map((val: number) => val >= 0 ? '#10b981' : '#ef4444'),
          borderRadius: 6,
          data: emisorUtilidades
        },
        {
          label: 'Monto Neto Vendido ($)',
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          data: emisorValoresNetos
        }
      ]
    };

    // 2. Gráfico por Año
    const anioList = this.chartsDataRaw.por_anio || [];
    const anioLabels = anioList.map((a: any) => a.anio);
    const anioUtilidades = anioList.map((a: any) => a.utilidad_perdida);

    this.chartAnioData = {
      labels: anioLabels,
      datasets: [
        {
          label: 'Ganancia / Pérdida por Año ($)',
          backgroundColor: '#059669',
          borderColor: '#10b981',
          data: anioUtilidades,
          borderRadius: 6
        }
      ]
    };

    // 3. Gráfico por Socio
    const socioList = this.chartsDataRaw.por_socio || [];
    const socioLabels = socioList.map((s: any) => s.socio);
    const socioUtilidades = socioList.map((s: any) => s.utilidad_perdida);

    this.chartSocioData = {
      labels: socioLabels,
      datasets: [
        {
          label: 'Ganancia Realizada por Socio ($)',
          backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
          data: socioUtilidades
        }
      ]
    };

    this.chartEmisorOptions = {
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        legend: {
          labels: { color: textColor }
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || '';
              const val = context.raw || 0;
              return `${label}: $${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColorSecondary },
          grid: { color: surfaceBorder }
        },
        y: {
          ticks: { color: textColorSecondary },
          grid: { color: surfaceBorder }
        }
      }
    };

    this.chartAnioOptions = { ...this.chartEmisorOptions };
    this.chartSocioOptions = {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor }
        }
      }
    };
  }

  // Exportar a Excel
  exportarExcel(): void {
    const dataToExport = this.ventas.map(v => ({
      'ID Op': v.id_accion_operacion,
      'Fecha Venta': v.fecha_operacion,
      'Socio / Propietario': v.socio_nombre,
      'Acción / Emisor': v.emisor_nombre,
      'Cantidad Vendida': v.cantidad,
      'Precio Venta Unitario ($)': v.precio_unitario,
      'Valor Bruto Venta ($)': v.valor_bruto,
      'Comisiones ($)': v.total_comisiones,
      'Valor Neto Recibido ($)': v.valor_neto,
      'Costo Promedio Unitario ($)': v.costo_promedio_unitario,
      'Costo Base Invertido ($)': v.costo_base_total,
      'Ganancia / Pérdida ($)': v.utilidad_perdida,
      'ROI Realizado (%)': v.roi_porcentaje,
      'Liquidación': v.liquidacion || '',
      'Observación': v.observacion || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Analisis Ventas Acciones');

    XLSX.writeFile(workbook, `Analisis_Ventas_Acciones_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // Exportar a PDF
  exportarPDF(): void {
    const doc = new jsPDF('landscape');

    doc.setFontSize(16);
    doc.text('Análisis de Ventas de Acciones - Rendimiento Realizado', 14, 20);
    doc.setFontSize(10);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 14, 27);
    doc.text(`Ventas Realizadas: ${this.summary.total_ventas_count} | Neto Recibido: $${this.summary.total_valor_neto.toLocaleString('en-US', { minimumFractionDigits: 2 })} | Utilidad Total: $${this.summary.total_utilidad_perdida.toLocaleString('en-US', { minimumFractionDigits: 2 })} (ROI: ${this.summary.roi_promedio_ponderado.toFixed(2)}%)`, 14, 34);

    const bodyData = this.ventas.map(v => [
      v.id_accion_operacion,
      v.fecha_operacion,
      v.socio_nombre,
      v.emisor_nombre,
      v.cantidad.toLocaleString('en-US'),
      `$${v.precio_unitario.toFixed(2)}`,
      `$${v.valor_neto.toFixed(2)}`,
      `$${v.costo_promedio_unitario.toFixed(2)}`,
      `$${v.costo_base_total.toFixed(2)}`,
      `$${v.utilidad_perdida.toFixed(2)}`,
      `${v.roi_porcentaje.toFixed(2)}%`
    ]);

    autoTable(doc, {
      head: [['ID', 'Fecha', 'Socio', 'Emisor', 'Cant.', 'P. Venta', 'V. Neto', 'Costo CPU', 'Costo Base', 'Utilidad', 'ROI %']],
      body: bodyData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] } // Dark Emerald Green standard
    });

    doc.save(`Analisis_Ventas_Acciones_${new Date().toISOString().split('T')[0]}.pdf`);
  }
}
