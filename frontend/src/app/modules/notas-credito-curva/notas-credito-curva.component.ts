import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ChartModule } from 'primeng/chart';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  NotasCreditoRadarService,
  TramoCurvaItem,
  CurvaDescuentoKpis,
  CurvaDescuentoResponse
} from '../../core/notas-credito-radar.service';

@Component({
  selector: 'app-notas-credito-curva',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    TooltipModule,
    ChartModule,
    TabViewModule,
    TagModule
  ],
  templateUrl: './notas-credito-curva.component.html',
  styleUrl: './notas-credito-curva.component.css'
})
export class NotasCreditoCurvaComponent implements OnInit {
  loading: boolean = false;
  error: string = '';

  // Filtros
  presetSeleccionado: string = 'todos';
  fechaInicio: string = '';
  fechaFin: string = '';
  bolsaSeleccionada: string = 'TODAS';
  tituloSeleccionado: string = 'TODOS';

  bolsasList: string[] = ['TODAS', 'BVG', 'BVQ'];
  titulosList: string[] = ['TODOS', 'NOTA DE CREDITO', 'NOTA DE CREDITO ISD'];

  // Datos principales
  kpis: CurvaDescuentoKpis | null = null;
  tramos: TramoCurvaItem[] = [];
  filtrosAplicados: any = null;

  // Gráfico PrimeNG
  chartCurvaData: any = null;
  chartCurvaOptions: any = null;

  // Pestañas
  activeTabIndex: number = 0;

  // Calculadora de Precio Justo / Fair Value
  calcNominal: number = 4500;
  calcPrecioCompra: number = 97.50;
  calcPrecioVenta: number = 99.50;
  calcComisionCompra: number = 0.15;
  calcComisionVenta: number = 0.15;
  calcDiasRotacion: number = 25;

  // Resultados de Calculadora
  calcTramoDetectado: TramoCurvaItem | null = null;
  calcInversionTotal: number = 0;
  calcIngresoNeto: number = 0;
  calcUtilidadNeta: number = 0;
  calcRoiDirecto: number = 0;
  calcTirAnualizada: number = 0;
  calcSpreadPts: number = 0;

  get tramoMicro(): TramoCurvaItem | null {
    return this.tramos && this.tramos.length > 0 ? this.tramos[0] : null;
  }

  get tramoGrande(): TramoCurvaItem | null {
    return this.tramos && this.tramos.length > 3
      ? this.tramos[3]
      : (this.tramos && this.tramos.length > 0 ? this.tramos[this.tramos.length - 1] : null);
  }

  constructor(private radarService: NotasCreditoRadarService) {}

  ngOnInit(): void {
    this.initChartOptions();
    this.cargarCurva();
  }

  initChartOptions(): void {
    this.chartCurvaOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#1e293b',
            font: {
              weight: '600',
              size: 12
            },
            padding: 15,
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y !== null ? context.parsed.y.toFixed(2) : '';
              return `${label}: ${value}%`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: '#f1f5f9'
          },
          ticks: {
            color: '#475569',
            font: {
              weight: '600'
            }
          }
        },
        y: {
          min: 95.0,
          max: 100.5,
          grid: {
            color: '#e2e8f0'
          },
          ticks: {
            color: '#475569',
            callback: (value: any) => value + '%'
          },
          title: {
            display: true,
            text: 'Precio Porcentual (%)',
            color: '#64748b',
            font: { weight: 'bold' }
          }
        }
      }
    };
  }

  cargarCurva(): void {
    this.loading = true;
    this.error = '';

    const payload: any = {
      preset: this.presetSeleccionado,
      bolsa: this.bolsaSeleccionada,
      titulo: this.tituloSeleccionado
    };

    if (this.presetSeleccionado === 'personalizado') {
      payload.fecha_inicio = this.fechaInicio;
      payload.fecha_fin = this.fechaFin;
    }

    this.radarService.getCurvaDescuento(payload).subscribe({
      next: (res: CurvaDescuentoResponse) => {
        if (res.success) {
          this.kpis = res.kpis;
          this.tramos = res.tramos || [];
          this.filtrosAplicados = res.filtros_aplicados;

          if (res.chart_curva) {
            this.chartCurvaData = res.chart_curva;
          }

          if (this.tramos.length > 0) {
            // Actualizar inputs sugeridos en la calculadora
            this.evaluarCalculadoraAutomatico();
          }
        } else {
          this.error = 'No se pudieron procesar los tramos de descuento.';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar curva de descuento:', err);
        this.error = 'Ocurrió un error al consultar la curva de descuento.';
        this.loading = false;
      }
    });
  }

  cambiarPreset(preset: string): void {
    this.presetSeleccionado = preset;
    if (preset !== 'personalizado') {
      this.cargarCurva();
    }
  }

  evaluarCalculadoraAutomatico(): void {
    if (!this.tramos || this.tramos.length === 0) return;

    // Identificar tramo correspondiente al monto nominal ingresado
    const nominal = Number(this.calcNominal) || 0;
    let tramoEncontrado = this.tramos[0];

    if (nominal < 2000) {
      tramoEncontrado = this.tramos.find(t => t.key === 'micro') || this.tramos[0];
    } else if (nominal <= 10000) {
      tramoEncontrado = this.tramos.find(t => t.key === 'pequeno') || this.tramos[1];
    } else if (nominal <= 50000) {
      tramoEncontrado = this.tramos.find(t => t.key === 'mediano') || this.tramos[2];
    } else {
      tramoEncontrado = this.tramos.find(t => t.key === 'grande') || this.tramos[3];
    }

    this.calcTramoDetectado = tramoEncontrado;

    // Sugerir precios según percentiles calculados
    this.calcPrecioCompra = tramoEncontrado.p25;
    const tramoInstitucional = this.tramos.find(t => t.key === 'grande') || this.tramos[this.tramos.length - 1];
    this.calcPrecioVenta = tramoInstitucional.p75;

    this.calcularFairValue();
  }

  calcularFairValue(): void {
    const nominal = Number(this.calcNominal) || 0;
    const pCompra = Number(this.calcPrecioCompra) || 0;
    const pVenta = Number(this.calcPrecioVenta) || 0;
    const comCompraPct = Number(this.calcComisionCompra) || 0;
    const comVentaPct = Number(this.calcComisionVenta) || 0;
    const dias = Math.max(1, Number(this.calcDiasRotacion) || 25);

    // Identificar tramo
    if (nominal < 2000) {
      this.calcTramoDetectado = this.tramos.find(t => t.key === 'micro') || null;
    } else if (nominal <= 10000) {
      this.calcTramoDetectado = this.tramos.find(t => t.key === 'pequeno') || null;
    } else if (nominal <= 50000) {
      this.calcTramoDetectado = this.tramos.find(t => t.key === 'mediano') || null;
    } else {
      this.calcTramoDetectado = this.tramos.find(t => t.key === 'grande') || null;
    }

    const inversionBruta = (nominal * pCompra) / 100;
    const comisionCompraUsd = (nominal * comCompraPct) / 100;
    this.calcInversionTotal = inversionBruta + comisionCompraUsd;

    const ingresoBrutoVenta = (nominal * pVenta) / 100;
    const comisionVentaUsd = (nominal * comVentaPct) / 100;
    this.calcIngresoNeto = ingresoBrutoVenta - comisionVentaUsd;

    this.calcUtilidadNeta = this.calcIngresoNeto - this.calcInversionTotal;
    this.calcSpreadPts = pVenta - pCompra;

    if (this.calcInversionTotal > 0) {
      this.calcRoiDirecto = (this.calcUtilidadNeta / this.calcInversionTotal) * 100;
      const rotaciones = 365 / dias;
      this.calcTirAnualizada = (Math.pow(1 + (this.calcRoiDirecto / 100), rotaciones) - 1) * 100;
    } else {
      this.calcRoiDirecto = 0;
      this.calcTirAnualizada = 0;
    }
  }

  seleccionarTramoParaCalculadora(tramo: TramoCurvaItem): void {
    // Si el usuario da clic en evaluar este tramo
    if (tramo.key === 'micro') this.calcNominal = 1500;
    else if (tramo.key === 'pequeno') this.calcNominal = 5000;
    else if (tramo.key === 'mediano') this.calcNominal = 25000;
    else this.calcNominal = 80000;

    this.calcTramoDetectado = tramo;
    this.calcPrecioCompra = tramo.p25;
    const tramoInst = this.tramos.find(t => t.key === 'grande') || tramo;
    this.calcPrecioVenta = tramoInst.p75;

    this.calcularFairValue();
    // Llevar a la pestaña 3
    this.activeTabIndex = 2;
  }

  exportarExcel(): void {
    if (!this.tramos || this.tramos.length === 0) return;

    const exportRows = this.tramos.map(t => ({
      'Tramo Nominal': t.tramo,
      'Perfil Contribuyente': t.nombre,
      'Operaciones': t.ops,
      '% Mercado (Ops)': `${t.pct_ops}%`,
      'Volumen Nominal ($)': t.nominal,
      '% Volumen Total': `${t.pct_nominal}%`,
      'Volumen Efectivo ($)': t.efectivo,
      'Descuento Total ($)': t.descuento_total,
      'Precio Mínimo (%)': t.precio_min,
      'Percentil 10 (%)': t.p10,
      'P25: Compra Sugerida (%)': t.p25,
      'Mediana P50 (%)': t.mediana_p50,
      'Precio Promedio Ponderado (%)': t.precio_ponderado,
      'P75: Venta Mayorista (%)': t.p75,
      'Percentil 90 (%)': t.p90,
      'Precio Máximo (%)': t.precio_max,
      'Spread Interno (pts)': t.spread_interno,
      'Spread vs Mayorista (pts)': t.spread_vs_mayorista,
      'Ganancia Est. por $10k ($)': t.ganancia_por_10k
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Curva de Descuento NC');
    XLSX.writeFile(wb, `SIPRO_Matriz_Curva_Descuento_NC_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  exportarPdf(): void {
    if (!this.tramos || this.tramos.length === 0) return;

    const doc = new jsPDF('landscape');

    doc.setFontSize(16);
    doc.setTextColor(14, 112, 73);
    doc.text('SIPRO - Matriz de Precios por Tramo y Curva de Descuento (Notas de Crédito)', 14, 15);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Generado: ${new Date().toLocaleString()} | Período: ${this.presetSeleccionado.toUpperCase()} | Bolsa: ${this.bolsaSeleccionada}`, 14, 22);

    const head = [
      [
        'Tramo',
        'Perfil',
        'Ops',
        'Volumen Nom ($)',
        'P. Mín',
        'P25 (Compra)',
        'Mediana',
        'Prom. Ponderado',
        'P75 (Venta)',
        'P. Máx',
        'Spread vs Inst.',
        'Ganancia / $10k'
      ]
    ];

    const body = this.tramos.map(t => [
      t.tramo,
      t.nombre,
      t.ops.toLocaleString(),
      `$${t.nominal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      `${t.precio_min.toFixed(2)}%`,
      `${t.p25.toFixed(2)}%`,
      `${t.mediana_p50.toFixed(2)}%`,
      `${t.precio_ponderado.toFixed(2)}%`,
      `${t.p75.toFixed(2)}%`,
      `${t.precio_max.toFixed(2)}%`,
      `+${t.spread_vs_mayorista.toFixed(2)} pts`,
      `+$${t.ganancia_por_10k.toFixed(2)}`
    ]);

    autoTable(doc, {
      head: head,
      body: body,
      startY: 28,
      theme: 'grid',
      headStyles: {
        fillColor: [14, 112, 73],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [246, 251, 248]
      }
    });

    doc.save(`SIPRO_Curva_Descuento_NC_${new Date().toISOString().slice(0, 10)}.pdf`);
  }
}

