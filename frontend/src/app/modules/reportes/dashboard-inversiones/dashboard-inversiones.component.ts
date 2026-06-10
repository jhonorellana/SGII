import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { ChartModule } from 'primeng/chart';
import { InversionService, Inversion } from '../../../core/inversion.service';
import { PatrimonioService } from '../../../core/patrimonio.service';

@Component({
  selector: 'app-dashboard-inversiones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TabViewModule,
    DropdownModule,
    CalendarModule,
    ChartModule
  ],
  templateUrl: './dashboard-inversiones.component.html',
  styleUrls: ['./dashboard-inversiones.component.css']
})
export class DashboardInversionesComponent implements OnInit {
  inversiones: Inversion[] = [];
  filteredInversiones: Inversion[] = [];

  // Dropdown options
  propietarios: any[] = [];
  emisores: any[] = [];

  // Filter models
  selectedPropietario: number | null = null;
  selectedEmisor: number | null = null;
  fechaDesde: Date | null = null;
  fechaHasta: Date | null = null;

  // Indicators
  totalNominal = 0;
  totalInvertido = 0;
  rendimientoPromedio = 0;
  totalInvertidoPatrimonio = 0;

  // Data checks
  hasData = false;
  hasBonosData = false;
  hasOtrasInversionesData = false;

  // Chart data
  instrumentosChartData: any;
  emisoresChartData: any;
  propietariosChartData: any;
  propietariosTiposChartData: any;
  propietariosBonosChartData: any;
  propietariosOtrasChartData: any;
  vencimientosChartData: any;
  rendimientoBonosChartData: any;
  rendimientoOtrasChartData: any;

  // Chart configurations
  donutChartOptions: any;
  instrumentosChartOptions: any;
  barChartOptions: any;
  horizontalBarChartOptions: any;

  // Custom legend lists
  instrumentosLegend: any[] = [];

  // HSL curated palette
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

  constructor(
    private inversionService: InversionService,
    private patrimonioService: PatrimonioService,
    private cdr: ChangeDetectorRef
  ) {
    this.setupChartOptions();
  }

  ngOnInit(): void {
    this.loadInversiones();
  }

  loadInversiones(): void {
    this.inversionService.getAll().subscribe({
      next: (data) => {
        // Filter out soft-deleted ones, only work with active ones, and exclude sold ones (fecha_venta IS NULL)
        this.inversiones = (data || []).filter(i => !i.eliminado && i.activo && !i.fecha_venta);
        this.filteredInversiones = [...this.inversiones];

        this.extractFilterOptions();
        this.calculateMetricsAndCharts();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading investments for dashboard:', err);
      }
    });
  }

  extractFilterOptions(): void {
    // Extract unique owners
    const uniquePropietariosMap = new Map<number, any>();
    this.inversiones.forEach(inv => {
      if (inv.propietario && !uniquePropietariosMap.has(inv.id_propietario)) {
        const nombre = `${inv.propietario.nombres || ''} ${inv.propietario.apellidos || ''}`.trim() || inv.propietario.nombre || `Propietario ${inv.id_propietario}`;
        uniquePropietariosMap.set(inv.id_propietario, {
          id_persona: inv.id_propietario,
          nombre: nombre
        });
      }
    });
    this.propietarios = Array.from(uniquePropietariosMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Extract unique issuers
    const uniqueEmisoresMap = new Map<number, any>();
    this.inversiones.forEach(inv => {
      if (inv.instrumento?.emisor && !uniqueEmisoresMap.has(inv.instrumento.id_emisor)) {
        uniqueEmisoresMap.set(inv.instrumento.id_emisor, {
          id_emisor: inv.instrumento.id_emisor,
          nombre: inv.instrumento.emisor.nombre
        });
      }
    });
    this.emisores = Array.from(uniqueEmisoresMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  onFilterChange(): void {
    this.filteredInversiones = this.inversiones.filter(inv => {
      // Propietario
      if (this.selectedPropietario && inv.id_propietario !== this.selectedPropietario) {
        return false;
      }
      // Emisor
      if (this.selectedEmisor && inv.instrumento?.id_emisor !== this.selectedEmisor) {
        return false;
      }
      // Fecha Desde
      if (this.fechaDesde && inv.fecha_compra) {
        const fCompra = new Date(inv.fecha_compra);
        if (fCompra < this.fechaDesde) return false;
      }
      // Fecha Hasta
      if (this.fechaHasta && inv.fecha_compra) {
        const fCompra = new Date(inv.fecha_compra);
        if (fCompra > this.fechaHasta) return false;
      }
      return true;
    });

    this.calculateMetricsAndCharts();
  }

  clearFilters(): void {
    this.selectedPropietario = null;
    this.selectedEmisor = null;
    this.fechaDesde = null;
    this.fechaHasta = null;
    this.filteredInversiones = [...this.inversiones];
    this.calculateMetricsAndCharts();
  }

  calculateMetricsAndCharts(): void {
    this.hasData = this.filteredInversiones.length > 0;

    if (!this.hasData) {
      this.totalNominal = 0;
      this.totalInvertido = 0;
      this.rendimientoPromedio = 0;
      this.hasBonosData = false;
      this.hasOtrasInversionesData = false;
      return;
    }

    // 1. Calculate General Metrics
    let sumNominal = 0;
    let sumInvertido = 0;
    let sumWeightedRendimiento = 0;

    this.filteredInversiones.forEach(inv => {
      const nominal = Number(inv.valor_nominal || 0);
      const invertido = Number(inv.capital_invertido || 0);
      const rendimiento = Number(inv.rendimiento_nominal || inv.tasa_interes || 0);

      sumNominal += nominal;
      sumInvertido += invertido;
      sumWeightedRendimiento += (rendimiento * invertido);
    });

    this.totalNominal = sumNominal;
    this.totalInvertido = sumInvertido;
    this.rendimientoPromedio = sumInvertido > 0 ? (sumWeightedRendimiento / sumInvertido) : 0;

    // 2. Generate Chart Data Sets
    this.loadPatrimonioData();
    this.generateEmisoresChart();
    this.generatePropietariosChart();
    this.generatePropietariosTiposChart();
    this.generatePropietariosBonosChart();
    this.generatePropietariosOtrasChart();
    this.generateVencimientosChart();
    this.generateRendimientosBonosChart();
    this.generateRendimientosOtrasChart();
  }

  private loadPatrimonioData(): void {
    const today = new Date();
    const dateInicio = this.fechaDesde ? this.fechaDesde : today;
    const dateFin = this.fechaHasta ? this.fechaHasta : new Date(today.getFullYear(), today.getMonth() + 12, 0);

    const params = {
      fecha_inicio: this.formatDate(dateInicio),
      fecha_fin: this.formatDate(dateFin),
      id_propietario: this.selectedPropietario || undefined
    };

    this.patrimonioService.getPatrimonioConsolidado(params).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.buildInstrumentosFromPatrimonio(response.data.patrimonio);
        } else {
          this.totalInvertidoPatrimonio = 0;
          this.instrumentosChartData = null;
          this.instrumentosLegend = [];
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error loading patrimonio data:', err);
        this.totalInvertidoPatrimonio = 0;
        this.instrumentosChartData = null;
        this.instrumentosLegend = [];
        this.cdr.detectChanges();
      }
    });
  }

  private buildInstrumentosFromPatrimonio(patrimonio: any[]): void {
    const filtered = (patrimonio || []).filter(item => 
      item.detalle !== 'TOTAL' && 
      item.detalle !== 'Total Corriente' &&
      item.valor > 0
    );

    filtered.sort((a, b) => b.valor - a.valor);

    const labels = filtered.map(item => item.detalle);
    const data = filtered.map(item => item.valor);

    this.instrumentosChartData = {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: this.colorsList.slice(0, labels.length),
        borderWidth: 1
      }]
    };

    const total = data.reduce((a, b) => a + b, 0);
    this.totalInvertidoPatrimonio = total;

    this.instrumentosLegend = filtered.map((item, idx) => {
      return {
        color: this.colorsList[idx % this.colorsList.length],
        label: item.detalle,
        valor: item.valor,
        porcentaje: total > 0 ? ((item.valor / total) * 100).toFixed(1) + '%' : '0%'
      };
    });

    this.cdr.detectChanges();
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private generateEmisoresChart(): void {
    const counts = new Map<string, number>();
    this.filteredInversiones.forEach(inv => {
      const emisor = inv.instrumento?.emisor?.nombre || 'DESCONOCIDO';
      const amt = Number(inv.capital_invertido || 0);
      counts.set(emisor, (counts.get(emisor) || 0) + amt);
    });

    const labels = Array.from(counts.keys());
    const data = Array.from(counts.values());

    this.emisoresChartData = {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: this.colorsList.slice(0, labels.length),
        borderWidth: 1
      }]
    };
  }

  private generatePropietariosChart(): void {
    const counts = new Map<string, number>();
    this.filteredInversiones.forEach(inv => {
      const owner = inv.propietario ? `${inv.propietario.nombres || ''} ${inv.propietario.apellidos || ''}`.trim() : `Propietario ${inv.id_propietario}`;
      const amt = Number(inv.capital_invertido || 0);
      counts.set(owner, (counts.get(owner) || 0) + amt);
    });

    const labels = Array.from(counts.keys());
    const data = Array.from(counts.values());

    this.propietariosChartData = {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: this.colorsList.slice(2, 2 + labels.length),
        borderWidth: 1
      }]
    };
  }

  private generatePropietariosTiposChart(): void {
    const counts = new Map<string, number>();
    this.filteredInversiones.forEach(inv => {
      const type = inv.instrumento?.tipoInversion?.nombre || 'OTRO';
      const owner = inv.propietario ? `${inv.propietario.nombres || ''} ${inv.propietario.apellidos || ''}`.trim() : `Propietario ${inv.id_propietario}`;
      const label = `${type} - ${owner}`;
      const amt = Number(inv.capital_invertido || 0);
      counts.set(label, (counts.get(label) || 0) + amt);
    });

    const labels = Array.from(counts.keys());
    const data = Array.from(counts.values());

    this.propietariosTiposChartData = {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: this.colorsList.slice(0, labels.length),
        borderWidth: 1
      }]
    };
  }

  private generatePropietariosBonosChart(): void {
    const bonosInversiones = this.filteredInversiones.filter(inv => (inv.instrumento?.tipoInversion?.nombre || '').toUpperCase().includes('BONO'));
    this.hasBonosData = bonosInversiones.length > 0;

    if (!this.hasBonosData) {
      this.propietariosBonosChartData = null;
      return;
    }

    const counts = new Map<string, number>();
    bonosInversiones.forEach(inv => {
      const owner = inv.propietario ? `${inv.propietario.nombres || ''} ${inv.propietario.apellidos || ''}`.trim() : `Propietario ${inv.id_propietario}`;
      const amt = Number(inv.capital_invertido || 0);
      counts.set(owner, (counts.get(owner) || 0) + amt);
    });

    const labels = Array.from(counts.keys());
    const data = Array.from(counts.values());

    this.propietariosBonosChartData = {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: this.colorsList.slice(4, 4 + labels.length),
        borderWidth: 1
      }]
    };
  }

  private generatePropietariosOtrasChart(): void {
    const otrasInversiones = this.filteredInversiones.filter(inv => !(inv.instrumento?.tipoInversion?.nombre || '').toUpperCase().includes('BONO'));
    this.hasOtrasInversionesData = otrasInversiones.length > 0;

    if (!this.hasOtrasInversionesData) {
      this.propietariosOtrasChartData = null;
      return;
    }

    const counts = new Map<string, number>();
    otrasInversiones.forEach(inv => {
      const owner = inv.propietario ? `${inv.propietario.nombres || ''} ${inv.propietario.apellidos || ''}`.trim() : `Propietario ${inv.id_propietario}`;
      const amt = Number(inv.capital_invertido || 0);
      counts.set(owner, (counts.get(owner) || 0) + amt);
    });

    const labels = Array.from(counts.keys());
    const data = Array.from(counts.values());

    this.propietariosOtrasChartData = {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: this.colorsList.slice(6, 6 + labels.length),
        borderWidth: 1
      }]
    };
  }

  private generateVencimientosChart(): void {
    const counts = new Map<string, number>();
    this.filteredInversiones.forEach(inv => {
      const vencimiento = inv.instrumento?.fecha_vencimiento;
      if (vencimiento) {
        const year = vencimiento.split('-')[0];
        const amt = Number(inv.capital_invertido || 0);
        counts.set(year, (counts.get(year) || 0) + amt);
      }
    });

    const sortedYears = Array.from(counts.keys()).sort();
    const data = sortedYears.map(year => counts.get(year) || 0);

    this.vencimientosChartData = {
      labels: sortedYears,
      datasets: [{
        label: 'Capital Vencimiento',
        data: data,
        backgroundColor: '#3b82f6',
        borderRadius: 6,
        borderWidth: 0
      }]
    };
  }

  private generateRendimientosBonosChart(): void {
    const bonosInversiones = this.filteredInversiones.filter(inv => (inv.instrumento?.tipoInversion?.nombre || '').toUpperCase().includes('BONO'));
    if (bonosInversiones.length === 0) {
      this.rendimientoBonosChartData = null;
      return;
    }

    const counts = new Map<number, number>();
    bonosInversiones.forEach(inv => {
      const rate = Number(inv.rendimiento_nominal || inv.tasa_interes || 0);
      const amt = Number(inv.capital_invertido || 0);
      counts.set(rate, (counts.get(rate) || 0) + amt);
    });

    const sortedRates = Array.from(counts.keys()).sort((a, b) => a - b);
    const labels = sortedRates.map(rate => `${rate.toFixed(2)}%`);
    const data = sortedRates.map(rate => counts.get(rate) || 0);

    this.rendimientoBonosChartData = {
      labels: labels,
      datasets: [{
        label: 'Monto en Bonos',
        data: data,
        backgroundColor: '#22c55e',
        borderRadius: 4,
        borderWidth: 0
      }]
    };
  }

  private generateRendimientosOtrasChart(): void {
    const otrasInversiones = this.filteredInversiones.filter(inv => !(inv.instrumento?.tipoInversion?.nombre || '').toUpperCase().includes('BONO'));
    if (otrasInversiones.length === 0) {
      this.rendimientoOtrasChartData = null;
      return;
    }

    const counts = new Map<number, number>();
    otrasInversiones.forEach(inv => {
      const rate = Number(inv.rendimiento_nominal || inv.tasa_interes || 0);
      const amt = Number(inv.capital_invertido || 0);
      counts.set(rate, (counts.get(rate) || 0) + amt);
    });

    const sortedRates = Array.from(counts.keys()).sort((a, b) => a - b);
    const labels = sortedRates.map(rate => `${rate.toFixed(2)}%`);
    const data = sortedRates.map(rate => counts.get(rate) || 0);

    this.rendimientoOtrasChartData = {
      labels: labels,
      datasets: [{
        label: 'Monto en Otras Inversiones',
        data: data,
        backgroundColor: '#f97316',
        borderRadius: 4,
        borderWidth: 0
      }]
    };
  }

  setupChartOptions(): void {
    // Options for donut charts
    this.donutChartOptions = {
      plugins: {
        legend: {
          position: 'right',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: { size: 10, weight: '500' },
            color: '#495057'
          }
        },
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
        },
        datalabels: {
          display: false
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };

    // Options for the custom split instruments donut chart
    this.instrumentosChartOptions = {
      cutout: '70%',
      plugins: {
        legend: {
          display: false
        },
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
        },
        datalabels: {
          display: false
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };

    // Options for vertical bar charts
    this.barChartOptions = {
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(33, 37, 41, 0.95)',
          padding: 10,
          callbacks: {
            label: (context: any) => {
              return ` Monto: ${this.formatCurrency(context.raw)}`;
            }
          }
        },
        datalabels: {
          display: false
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#6c757d', font: { size: 10, weight: '600' } }
        },
        y: {
          grid: { color: '#f1f3f5' },
          ticks: {
            color: '#6c757d',
            font: { size: 10 },
            callback: (val: any) => {
              if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'k';
              return '$' + val;
            }
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };

    // Options for horizontal bar charts ( tasas de rendimiento )
    this.horizontalBarChartOptions = {
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(33, 37, 41, 0.95)',
          padding: 10,
          callbacks: {
            label: (context: any) => {
              return ` Monto: ${this.formatCurrency(context.raw)}`;
            }
          }
        },
        datalabels: {
          display: false
        }
      },
      scales: {
        x: {
          grid: { color: '#f1f3f5' },
          ticks: {
            color: '#6c757d',
            font: { size: 9 },
            callback: (val: any) => {
              if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'k';
              return '$' + val;
            }
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#6c757d', font: { size: 9, weight: '600' } }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };
  }

  // Formatting helpers
  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  formatPercentage(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) return '0.00%';
    return value.toFixed(2) + '%';
  }
}
