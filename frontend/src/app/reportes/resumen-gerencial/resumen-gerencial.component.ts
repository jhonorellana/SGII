import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { HistoricoIndicadorService } from '../../core/historico-indicador.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-resumen-gerencial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ChartModule],
  templateUrl: './resumen-gerencial.component.html',
  styleUrls: ['./resumen-gerencial.component.css'],
  providers: [HistoricoIndicadorService, CurrencyPipe, DecimalPipe]
})
export class ResumenGerencialComponent implements OnInit {
  @ViewChild('pdfReport') pdfReport!: ElementRef;

  loading = true;
  error = '';
  isGeneratingPDF = false;

  historicos: any[] = [];
  snapshotOptions: any[] = [];

  selectedInicioId: number | null = null;
  selectedFinId: number | null = null;

  snapshotInicio: any = null;
  snapshotFin: any = null;

  // KPIs Calculados
  crecimientoConsolidadoValor = 0;
  crecimientoConsolidadoPorcentaje = 0;
  crecimientoBaseValor = 0;
  crecimientoBasePorcentaje = 0;
  tirPeriodo: number | null = null;
  diasPeriodo = 0;

  // Gráficos
  barChartData: any;
  barChartOptions: any;

  hoy = new Date();
  Math = Math;

  constructor(private historicoService: HistoricoIndicadorService) {}

  ngOnInit(): void {
    this.cargarHistoricos();
  }

  cargarHistoricos(): void {
    this.historicoService.getHistorico().subscribe({
      next: (res: any) => {
        if (res.success && res.data && res.data.length > 0) {
          this.historicos = res.data;
          this.construirOpciones();
        } else {
          this.error = 'No hay suficientes datos históricos para generar el reporte comparativo.';
        }
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error cargando históricos', err);
        this.error = 'Ocurrió un error al cargar los datos históricos.';
        this.loading = false;
      }
    });
  }

  construirOpciones(): void {
    const sorted = [...this.historicos].sort((a, b) => new Date(a.fecha_captura).getTime() - new Date(b.fecha_captura).getTime());
    
    this.snapshotOptions = sorted.map(h => ({
      id: h.id_historico,
      label: `${h.fecha_captura} (Patrimonio: $${Number(h.patrimonio_consolidado || 0).toLocaleString()})`,
      fecha: new Date(h.fecha_captura + 'T00:00:00')
    }));

    if (this.snapshotOptions.length >= 2) {
      this.selectedInicioId = this.snapshotOptions[0].id;
      this.selectedFinId = this.snapshotOptions[this.snapshotOptions.length - 1].id;
      this.generarReporte();
    } else {
      this.error = 'Se necesitan al menos 2 snapshots históricos para hacer una comparación.';
    }
  }

  onSeleccionCambiada(): void {
    if (this.selectedInicioId && this.selectedFinId) {
      // Validar que el inicio no sea después del fin
      const opInicio = this.snapshotOptions.find(o => o.id === Number(this.selectedInicioId));
      const opFin = this.snapshotOptions.find(o => o.id === Number(this.selectedFinId));
      
      if (opInicio && opFin && opInicio.fecha > opFin.fecha) {
        // Intercambiar si están al revés
        const temp = this.selectedInicioId;
        this.selectedInicioId = this.selectedFinId;
        this.selectedFinId = temp;
      }
      this.generarReporte();
    }
  }

  generarReporte(): void {
    if (!this.selectedInicioId || !this.selectedFinId) return;

    this.snapshotInicio = this.historicos.find(h => h.id_historico === Number(this.selectedInicioId));
    this.snapshotFin = this.historicos.find(h => h.id_historico === Number(this.selectedFinId));

    if (!this.snapshotInicio || !this.snapshotFin) return;

    const vConsolidadoA = Number(this.snapshotInicio.patrimonio_consolidado || 0);
    const vConsolidadoB = Number(this.snapshotFin.patrimonio_consolidado || 0);
    this.crecimientoConsolidadoValor = vConsolidadoB - vConsolidadoA;
    this.crecimientoConsolidadoPorcentaje = vConsolidadoA > 0 ? (vConsolidadoB / vConsolidadoA - 1) * 100 : 0;

    const vBaseA = Number(this.snapshotInicio.patrimonio_base || 0);
    const vBaseB = Number(this.snapshotFin.patrimonio_base || 0);
    this.crecimientoBaseValor = vBaseB - vBaseA;
    this.crecimientoBasePorcentaje = vBaseA > 0 ? (vBaseB / vBaseA - 1) * 100 : 0;

    const dateA = new Date(this.snapshotInicio.fecha_captura + 'T00:00:00');
    const dateB = new Date(this.snapshotFin.fecha_captura + 'T00:00:00');
    this.diasPeriodo = Math.floor((dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24));

    this.calcularTIR(dateA, dateB);
    this.buildChart();
  }

  calcularTIR(dateA: Date, dateB: Date): void {
    if (this.diasPeriodo <= 0) {
      this.tirPeriodo = null;
      return;
    }

    const historicosRango = this.historicos.filter(h => {
      const d = new Date(h.fecha_captura + 'T00:00:00');
      return d.getTime() >= dateA.getTime() && d.getTime() <= dateB.getTime();
    }).sort((a, b) => new Date(a.fecha_captura).getTime() - new Date(b.fecha_captura).getTime());

    if (historicosRango.length < 2) {
      this.tirPeriodo = null;
      return;
    }

    const flujos: number[] = [];
    const fechas: Date[] = [];

    const primerSnapshot = historicosRango[0];
    flujos.push(-Number(primerSnapshot.patrimonio_base || 0));
    fechas.push(new Date(primerSnapshot.fecha_captura + 'T00:00:00'));

    for (let i = 1; i < historicosRango.length; i++) {
      const anteriorBase = Number(historicosRango[i - 1].patrimonio_base || 0);
      const actualBase = Number(historicosRango[i].patrimonio_base || 0);
      const delta = actualBase - anteriorBase;

      if (Math.abs(delta) > 1) {
        flujos.push(-delta);
        fechas.push(new Date(historicosRango[i].fecha_captura + 'T00:00:00'));
      }
    }

    flujos.push(Number(this.snapshotFin.patrimonio_consolidado || 0));
    fechas.push(new Date(this.snapshotFin.fecha_captura + 'T00:00:00'));

    this.tirPeriodo = this.xirr(flujos, fechas);
  }

  private xirr(values: number[], dates: Date[], guess: number = 0.1): number | null {
    const xnpv = (rate: number) => {
      let sum = 0;
      const d0 = dates[0].getTime();
      for (let i = 0; i < values.length; i++) {
        const t = (dates[i].getTime() - d0) / (1000 * 60 * 60 * 24 * 365);
        sum += values[i] / Math.pow(1 + rate, t);
      }
      return sum;
    };

    const xnpvDerivative = (rate: number) => {
      let sum = 0;
      const d0 = dates[0].getTime();
      for (let i = 0; i < values.length; i++) {
        const t = (dates[i].getTime() - d0) / (1000 * 60 * 60 * 24 * 365);
        if (t > 0) {
          sum -= (t * values[i]) / Math.pow(1 + rate, t + 1);
        }
      }
      return sum;
    };

    let rate = guess;
    for (let i = 0; i < 100; i++) {
      const fv = xnpv(rate);
      const fvPrime = xnpvDerivative(rate);
      if (Math.abs(fvPrime) < 1e-10) break;
      const newRate = rate - fv / fvPrime;
      if (Math.abs(newRate - rate) < 1e-7) return newRate * 100; 
      rate = newRate;
      if (rate <= -1.0) rate = -0.99999;
    }
    return null;
  }

  buildChart(): void {
    const cA = Number(this.snapshotInicio.patrimonio_consolidado || 0);
    const cB = Number(this.snapshotFin.patrimonio_consolidado || 0);
    const bA = Number(this.snapshotInicio.patrimonio_base || 0);
    const bB = Number(this.snapshotFin.patrimonio_base || 0);

    this.barChartData = {
      labels: [this.snapshotInicio.fecha_captura, this.snapshotFin.fecha_captura],
      datasets: [
        {
          label: 'Patrimonio Consolidado',
          data: [cA, cB],
          backgroundColor: '#047857',
          borderRadius: 4
        },
        {
          label: 'Patrimonio Base',
          data: [bA, bB],
          backgroundColor: '#0284c7',
          borderRadius: 4
        }
      ]
    };

    this.barChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        datalabels: {
          display: true,
          color: '#ffffff',
          font: { weight: 'bold', size: 10 },
          formatter: (value: any) => {
            if (value === 0) return '';
            return '$' + Math.round(value).toLocaleString();
          }
        }
      },
      scales: {
        y: { beginAtZero: true }
      }
    };
  }

  async descargarPDF(): Promise<void> {
    if (!this.pdfReport) return;
    this.isGeneratingPDF = true;

    try {
      const element = this.pdfReport.nativeElement;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Resumen_Gerencial_${this.snapshotInicio.fecha_captura}_vs_${this.snapshotFin.fecha_captura}.pdf`);
    } catch (err) {
      console.error('Error generando PDF', err);
      alert('Hubo un problema al generar el PDF.');
    } finally {
      this.isGeneratingPDF = false;
    }
  }
}
