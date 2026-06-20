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

import { AccionPosicionService } from '../../../core/accion-posicion.service';
import { AccionDividendoService } from '../../../core/accion-dividendo.service';
import { PersonaService } from '../../../core/persona.service';
import { InstrumentoService } from '../../../core/instrumento.service';
import { AccionPosicion, AccionDividendo } from '../../../core/models/accion-models';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    TagModule
  ],
  templateUrl: './portafolio-list.component.html',
  styleUrl: './portafolio-list.component.css'
})
export class PortafolioListComponent implements OnInit {
  posiciones: AccionPosicion[] = [];
  filteredPosiciones: AccionPosicion[] = [];
  dividendos: AccionDividendo[] = [];

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

  // Indicators (KPI Cards)
  totalInvertido = 0;
  totalValorMercado = 0;
  utilidadNoRealizada = 0;
  porcentajeRendimiento = 0;
  totalDividendosCobrados = 0;

  // Chart data and configurations
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
    { field: 'instrumento', header: 'Acción' },
    { field: 'cantidad_actual', header: 'Cantidad Acciones' },
    { field: 'costo_promedio_unitario', header: 'Costo Prom. Unitario' },
    { field: 'capital_invertido', header: 'Capital Invertido' },
    { field: 'precio_ultimo', header: 'Último Precio Cierre' },
    { field: 'fecha_ultimo_precio', header: 'Fecha Cierre' },
    { field: 'valor_mercado', header: 'Valor Mercado Actual' },
    { field: 'utilidad_perdida_no_realizada', header: 'Plusvalía/Minusvalía' }
  ];

  constructor(
    private posicionService: AccionPosicionService,
    private dividendoService: AccionDividendoService,
    private personaService: PersonaService,
    private instrumentoService: InstrumentoService,
    private cdr: ChangeDetectorRef
  ) {
    this.setupChartOptions();
  }

  ngOnInit(): void {
    this.loadFiltros();
    this.loadData();
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
          .filter((i: any) => i.activo === true || i.activo === 1)
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
            
            this.calculateMetricsAndCharts();
            this.loading = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error al cargar dividendos en el portafolio:', err);
            this.dividendos = [];
            this.calculateMetricsAndCharts();
            this.loading = false;
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

  onFilterChange(): void {
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

    this.calculateMetricsAndCharts();
  }

  clearFilters(): void {
    this.selectedSocio = null;
    this.selectedInstrumento = null;
    this.globalSearchQuery = '';
    if (this.dt) {
      this.dt.reset();
    }
    this.filteredPosiciones = [...this.posiciones];
    this.calculateMetricsAndCharts();
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
      valor: val
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
      valor: val
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

  onGlobalFilter(event: Event): void {
    if (this.dt) {
      this.dt.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }
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
    const dataToExport = this.dt?.filteredValue || this.filteredPosiciones;
    const exportData = dataToExport.map(pos => ({
      Socio: pos.persona || '-',
      Acción: pos.instrumento || '-',
      'Cantidad Acciones': pos.cantidad_actual,
      'Costo Promedio Unitario': pos.costo_promedio_unitario || 0,
      'Capital Invertido': pos.capital_invertido || 0,
      'Último Precio': pos.precio_ultimo || 0,
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
    const dataToExport = this.dt?.filteredValue || this.filteredPosiciones;
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Portafolio Consolidado - Renta Variable (Acciones)', 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = dataToExport.map(pos => [
      pos.persona || '-',
      pos.instrumento || '-',
      this.formatNumber(pos.cantidad_actual, 4),
      this.formatCurrency(pos.costo_promedio_unitario),
      this.formatCurrency(pos.capital_invertido),
      this.formatCurrency(pos.precio_ultimo),
      pos.fecha_ultimo_precio || '-',
      this.formatCurrency(pos.valor_mercado),
      this.formatCurrency(pos.utilidad_perdida_no_realizada)
    ]);

    autoTable(doc, {
      head: [['Socio', 'Acción', 'Cantidad', 'Costo Prom. Unit', 'Cap. Invertido', 'Últ. Precio', 'F. Cierre', 'Valor Mercado', 'Plus/Minusvalía']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 167, 69] } // Color verde característico para Portafolios
    });

    doc.save(`portafolio_renta_variable_${new Date().toISOString().split('T')[0]}.pdf`);
  }
}
