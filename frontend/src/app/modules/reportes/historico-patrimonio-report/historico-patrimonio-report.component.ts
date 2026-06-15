import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { HistoricoPatrimonioService } from '../../../core/historico-patrimonio.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'chartjs-adapter-date-fns';
import { es } from 'date-fns/locale';
import { Chart, TimeScale, TimeSeriesScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// Register Chart.js elements
Chart.register(TimeScale, TimeSeriesScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface HistoricoPatrimonioRecord {
  id_historico_patrimonio: number;
  fecha: string;
  capital_jaime: number;
  capital_argentina: number;
  capital_cristian: number;
  capital_total: number;
  capital_propio: number;
  capital_importacion: number;
  capital_total_propio: number;
}

@Component({
  selector: 'app-historico-patrimonio-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DropdownModule,
    ChartModule,
    TableModule
  ],
  templateUrl: './historico-patrimonio-report.component.html',
  styleUrls: ['./historico-patrimonio-report.component.css']
})
export class HistoricoPatrimonioReportComponent implements OnInit {
  // Filters options
  anos: any[] = [];
  selectedAnio: number = 0;

  // Data
  allRecords: HistoricoPatrimonioRecord[] = [];
  tableRecords: HistoricoPatrimonioRecord[] = []; // sorted descending for table
  chartRecords: HistoricoPatrimonioRecord[] = []; // sorted ascending for chart
  loading = false;
  hasData = false;

  // KPIs
  totalConsolidado = 0;
  totalJhon = 0;
  totalJaime = 0;
  totalCristian = 0;
  totalArgentina = 0;

  // Chart config
  chartData: any = null;
  chartOptions: any = null;
  chartPlugins = [
    {
      id: 'verticalYearLines',
      beforeDatasetsDraw: (chart: any) => {
        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        
        if (!xScale || !yScale) return;
        
        const minYear = new Date(xScale.min).getFullYear();
        const maxYear = new Date(xScale.max).getFullYear();
        
        ctx.save();
        ctx.strokeStyle = '#f97316'; // Orange color
        ctx.lineWidth = 1.5;
        
        for (let year = minYear; year <= maxYear + 1; year++) {
          const dateVal = new Date(`${year}-01-01T00:00:00`).getTime();
          if (dateVal >= xScale.min && dateVal <= xScale.max) {
            const xPos = xScale.getPixelForValue(dateVal);
            ctx.beginPath();
            ctx.moveTo(xPos, yScale.top);
            ctx.lineTo(xPos, yScale.bottom);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
  ];

  constructor(
    private service: HistoricoPatrimonioService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.service.getHistoricoPatrimonio().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Normalize dates to just YYYY-MM-DD
          this.allRecords = response.data.map((r: any) => ({
            ...r,
            fecha: r.fecha.split(' ')[0],
            capital_jaime: Number(r.capital_jaime),
            capital_argentina: Number(r.capital_argentina),
            capital_cristian: Number(r.capital_cristian),
            capital_total: Number(r.capital_total),
            capital_propio: Number(r.capital_propio),
            capital_importacion: Number(r.capital_importacion),
            capital_total_propio: Number(r.capital_total_propio)
          }));
          
          this.generateYearOptions();
          this.applyFilters();
        } else {
          this.allRecords = [];
          this.hasData = false;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar histórico de patrimonio:', err);
        this.allRecords = [];
        this.hasData = false;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  generateYearOptions(): void {
    const yearsSet = new Set<number>();
    this.allRecords.forEach(r => {
      const yr = new Date(r.fecha).getFullYear();
      if (!isNaN(yr)) yearsSet.add(yr);
    });
    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
    
    this.anos = [
      { label: 'Todos los años', value: 0 },
      ...sortedYears.map(yr => ({ label: yr.toString(), value: yr }))
    ];
  }

  applyFilters(): void {
    let filtered = [...this.allRecords];
    
    if (this.selectedAnio > 0) {
      filtered = filtered.filter(r => new Date(r.fecha).getFullYear() === this.selectedAnio);
    }

    this.hasData = filtered.length > 0;

    // Table needs descending chronological order (newest first)
    this.tableRecords = [...filtered].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    // Chart needs ascending chronological order (oldest first)
    this.chartRecords = [...filtered].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    this.calculateKPIs();
    this.buildChart();
  }

  calculateKPIs(): void {
    if (this.tableRecords.length === 0) {
      this.totalConsolidado = 0;
      this.totalJhon = 0;
      this.totalJaime = 0;
      this.totalCristian = 0;
      this.totalArgentina = 0;
      return;
    }

    // Latest snapshot is the first record in tableRecords (since it's sorted DESC)
    const latest = this.tableRecords[0];
    this.totalConsolidado = latest.capital_total;
    this.totalJhon = latest.capital_propio;
    this.totalJaime = latest.capital_jaime;
    this.totalCristian = latest.capital_cristian;
    this.totalArgentina = latest.capital_argentina;
  }

  onFiltersChange(): void {
    this.applyFilters();
  }

  buildChart(): void {
    if (!this.hasData) {
      this.chartData = null;
      return;
    }

    // Formulate chart datasets
    const labelTotal = 'Capital Total';
    const labelJhon = 'Jhon';
    const labelJaime = 'Jaime';
    const labelCristian = 'Cristian';
    const labelArgentina = 'Argentina';

    const datasetTotal = this.chartRecords.map(r => ({ x: new Date(r.fecha + 'T00:00:00').getTime(), y: r.capital_total }));
    const datasetJhon = this.chartRecords.map(r => ({ x: new Date(r.fecha + 'T00:00:00').getTime(), y: r.capital_propio }));
    const datasetJaime = this.chartRecords.map(r => ({ x: new Date(r.fecha + 'T00:00:00').getTime(), y: r.capital_jaime }));
    const datasetCristian = this.chartRecords.map(r => ({ x: new Date(r.fecha + 'T00:00:00').getTime(), y: r.capital_cristian }));
    const datasetArgentina = this.chartRecords.map(r => ({ x: new Date(r.fecha + 'T00:00:00').getTime(), y: r.capital_argentina }));

    this.chartData = {
      datasets: [
        {
          label: labelTotal,
          data: datasetTotal,
          borderColor: '#3b82f6', // Blue
          backgroundColor: '#3b82f6',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 6,
          tension: 0.1,
          fill: false
        },
        {
          label: labelJhon,
          data: datasetJhon,
          borderColor: '#ef4444', // Red
          backgroundColor: '#ef4444',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 6,
          tension: 0.1,
          fill: false
        },
        {
          label: labelJaime,
          data: datasetJaime,
          borderColor: '#84cc16', // Green/lime
          backgroundColor: '#84cc16',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 6,
          tension: 0.1,
          fill: false
        },
        {
          label: labelCristian,
          data: datasetCristian,
          borderColor: '#06b6d4', // Teal/Cyan
          backgroundColor: '#06b6d4',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 6,
          tension: 0.1,
          fill: false
        },
        {
          label: labelArgentina,
          data: datasetArgentina,
          borderColor: '#8b5cf6', // Purple
          backgroundColor: '#8b5cf6',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 6,
          tension: 0.1,
          fill: false
        }
      ]
    };

    // Chart.js Options matching user's mockup details
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        title: {
          display: false,
          text: 'Capital invertido',
          color: '#1e293b',
          font: {
            size: 16,
            weight: 'bold'
          },
          padding: {
            bottom: 15
          }
        },
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#475569',
            font: {
              size: 12,
              weight: '500'
            },
            boxWidth: 20,
            padding: 20
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title: (items: any[]) => {
              if (items.length > 0) {
                const dateVal = new Date(items[0].raw.x);
                return `Fecha: ${dateVal.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
              }
              return '';
            },
            label: (context: any) => {
              const label = context.dataset.label || '';
              const val = context.raw.y;
              return ` ${label}: ${this.formatCurrency(val)}`;
            }
          }
        },
        datalabels: {
          display: false
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
            unit: 'month',
            displayFormats: {
              month: 'MMM yyyy'
            },
            tooltipFormat: 'yyyy-MM-dd'
          },
          grid: {
            display: true,
            drawTicks: false,
            color: '#e2e8f0', // standard light gridline
            lineWidth: 1
          },
          ticks: {
            color: '#64748b',
            font: {
              size: 9,
              weight: '500'
            },
            autoSkip: true,
            maxRotation: 45,
            minRotation: 0,
            callback: (value: any) => {
              const d = new Date(value);
              const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
              // Label formats: "Abr 2020", "May 2026", etc.
              return `${months[d.getMonth()]} ${d.getFullYear()}`;
            }
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Capital Invertido',
            color: '#1e293b',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#64748b',
            font: {
              size: 9
            },
            callback: (val: any) => {
              return Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
            }
          },
          grid: {
            color: '#cbd5e1',
            drawTicks: false
          }
        }
      }
    };
  }

  exportarExcel(): void {
    if (this.tableRecords.length === 0) return;

    const anioTexto = this.selectedAnio === 0 ? 'Todos' : this.selectedAnio.toString();
    const fileName = `Reporte_Historico_Patrimonio_${anioTexto}.xlsx`;

    const dataExcel = this.tableRecords.map(rec => ({
      'Fecha': rec.fecha,
      'Capital Jhon (Propio) ($)': rec.capital_propio,
      'Capital Jaime ($)': rec.capital_jaime,
      'Capital Argentina ($)': rec.capital_argentina,
      'Capital Cristian ($)': rec.capital_cristian,
      'Capital Importación ($)': rec.capital_importacion,
      'Total Consolidado ($)': rec.capital_total
    }));

    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial');

    // Auto-fit Columns
    ws['!cols'] = [
      { wch: 12 }, // Fecha
      { wch: 22 }, // Cap. Jhon
      { wch: 18 }, // Cap. Jaime
      { wch: 18 }, // Cap. Argentina
      { wch: 18 }, // Cap. Cristian
      { wch: 18 }, // Cap. Importacion
      { wch: 22 }  // Total Consolidado
    ];

    // Format numbers
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      for (let col = 1; col <= 6; col++) {
        const cell = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cell]) ws[cell].z = '$#,##0.00';
      }
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
  }

  exportarPDF(): void {
    if (this.tableRecords.length === 0) return;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const anioTexto = this.selectedAnio === 0 ? 'Todos los años' : this.selectedAnio.toString();

    doc.setFontSize(16);
    doc.text('Histórico de Capital Invertido', 14, 15);
    doc.setFontSize(10);
    doc.text(`Rango de Año: ${anioTexto} | Generado el: ${new Date().toLocaleDateString('es-ES')}`, 14, 21);

    const tableData = this.tableRecords.map(rec => [
      new Date(rec.fecha + 'T00:00:00').toLocaleDateString('es-ES'),
      this.formatCurrency(rec.capital_propio),
      this.formatCurrency(rec.capital_jaime),
      this.formatCurrency(rec.capital_argentina),
      this.formatCurrency(rec.capital_cristian),
      this.formatCurrency(rec.capital_importacion),
      this.formatCurrency(rec.capital_total)
    ]);

    autoTable(doc, {
      head: [['Fecha', 'Cap. Jhon (Propio)', 'Cap. Jaime', 'Cap. Argentina', 'Cap. Cristian', 'Cap. Importación', 'Total Consolidado']],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    const fileName = `Reporte_Historico_Patrimonio_${this.selectedAnio === 0 ? 'Todos' : this.selectedAnio}.pdf`;
    doc.save(fileName);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
}
