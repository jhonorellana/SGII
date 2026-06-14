import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarModule } from 'primeng/calendar';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { ResumenBolsaService, DatosResumenDiario, CierreAccionRecord, AccionRecord } from '../../../core/resumen-bolsa.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'chartjs-adapter-date-fns';
import { es } from 'date-fns/locale';
import { Chart, TimeScale, TimeSeriesScale } from 'chart.js';

// Register the required temporal scales globally in Chart.js
Chart.register(TimeScale, TimeSeriesScale);

export interface RentaFijaConsolidada {
  id: number;
  tipo: string;
  emisor: string;
  plazo: number;
  tasa: number;
  precio: number;
  rendimiento: number;
  valor_nominal: number;
  valor_efectivo: number;
  fecha: string;
  emision: string;
  vencimiento: string;
}

@Component({
  selector: 'app-resumen-diario-bolsa',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CalendarModule,
    ChartModule,
    TableModule,
    TabViewModule,
    TagModule,
    ToastModule,
    InputTextModule
  ],
  providers: [MessageService],
  templateUrl: './resumen-diario-bolsa.component.html',
  styleUrls: ['./resumen-diario-bolsa.component.css']
})
export class ResumenDiarioBolsaComponent implements OnInit {
  fechaInicio: Date = new Date();
  fechaFin: Date = new Date();
  cargando = false;
  datosCargados = false;

  rentaFijaConsolidada: RentaFijaConsolidada[] = [];
  acciones: AccionRecord[] = [];
  cierresAcciones: CierreAccionRecord[] = [];

  // Métricas de inversión (KPIs)
  volumenEfectivoTotal = 0;
  rendimientoMaxCortoPlazo = 0;
  emisorMaxCortoPlazo = 'No hay operaciones';
  rendimientoMaxLargoPlazo = 0;
  emisorMaxLargoPlazo = 'No hay operaciones';
  // Nuevas métricas
  eficienciaTasa = 0;
  eficienciaPlazo = 0;
  eficienciaEmisor = 'No hay operaciones';

  descuentoPrecio = 0;
  descuentoAhorro = 0;
  descuentoEmisor = 'No hay operaciones';

  // Gráficos
  graficoRendimientoDatos: any = null;
  graficoRendimientoOpciones: any = null;
  graficoCurvaDatos: any = null;
  graficoCurvaOpciones: any = null;
  rendimientoLeyenda: any[] = [];

  constructor(
    private resumenService: ResumenBolsaService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.inicializarFechasPorDefecto();
    this.cargarDatos();
  }

  inicializarFechasPorDefecto(): void {
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0: Domingo, 6: Sábado
    const fFin = new Date(hoy);
    const fInicio = new Date(hoy);

    if (diaSemana === 6) { // Sábado
      fInicio.setDate(hoy.getDate() - 1); // Viernes (último día laborable)
    } else if (diaSemana === 0) { // Domingo
      fInicio.setDate(hoy.getDate() - 2); // Viernes (último día laborable)
    } else {
      fInicio.setDate(hoy.getDate() - 1); // Ayer
    }

    this.fechaInicio = fInicio;
    this.fechaFin = fFin;
  }

  cargarDatos(): void {
    if (!this.fechaInicio || !this.fechaFin) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Por favor, seleccione un rango de fechas de consulta válido.'
      });
      return;
    }

    this.cargando = true;
    this.datosCargados = false;

    // Convertir Date a formato de fecha YYYY-MM-DD
    const anioI = this.fechaInicio.getFullYear();
    const mesI = String(this.fechaInicio.getMonth() + 1).padStart(2, '0');
    const diaI = String(this.fechaInicio.getDate()).padStart(2, '0');
    const fechaInicioStr = `${anioI}-${mesI}-${diaI}`;

    const anioF = this.fechaFin.getFullYear();
    const mesF = String(this.fechaFin.getMonth() + 1).padStart(2, '0');
    const diaF = String(this.fechaFin.getDate()).padStart(2, '0');
    const fechaFinStr = `${anioF}-${mesF}-${diaF}`;

    this.resumenService.obtenerResumenDiario(fechaInicioStr, fechaFinStr).subscribe({
      next: (respuesta) => {
        if (respuesta.exito && respuesta.datos) {
          const d = respuesta.datos;
          this.acciones = d.acciones || [];
          this.consolidarRentaFija(d);
          this.calcularMetricas(d);
          this.construirGraficoRendimientoMaximo(d);
          this.construirGraficoCurva(d);
          this.datosCargados = true;

          // Mostrar mensaje de éxito si hay transacciones
          const totalTrans = this.rentaFijaConsolidada.length + this.acciones.length;
          if (totalTrans > 0) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: `Se encontraron ${totalTrans} transacciones para el rango seleccionado.`
            });
          } else {
            this.messageService.add({
              severity: 'info',
              summary: 'Información',
              detail: 'No se encontraron transacciones en este rango de fechas.'
            });
          }
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: respuesta.mensaje || 'Error al recuperar el resumen diario.'
          });
        }
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar datos del resumen:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Ocurrió un error al conectar con el servidor.'
        });
        this.cargando = false;
        this.datosCargados = false;
        this.cdr.detectChanges();
      }
    });

    // Cargar los últimos cierres de acciones del mercado
    this.resumenService.obtenerUltimoCierreAcciones().subscribe({
      next: (respuesta) => {
        if (respuesta.exito && respuesta.datos) {
          this.cierresAcciones = respuesta.datos || [];
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar cierres de acciones:', err);
      }
    });
  }

  consolidarRentaFija(d: DatosResumenDiario): void {
    const lista: RentaFijaConsolidada[] = [];
    const limpiarFecha = (f: string | null | undefined): string => {
      if (!f) return '';
      return f.split(' ')[0];
    };

    if (d.bonos) {
      d.bonos.forEach(b => {
        lista.push({
          id: b.id,
          tipo: 'Bono',
          emisor: b.decreto || 'Estado (Decreto)',
          plazo: Number(b.dias_por_vencer || 0),
          tasa: Number(b.tasa_interes || 0),
          precio: Number(b.precio_porc || 0),
          rendimiento: Number(b.rendimiento || 0),
          valor_nominal: Number(b.valor_nominal || 0),
          valor_efectivo: Number(b.valor_efectivo || 0),
          fecha: limpiarFecha(b.fecha),
          emision: limpiarFecha(b.fecha_emision),
          vencimiento: limpiarFecha(b.fecha_vencimiento)
        });
      });
    }

    if (d.obligaciones) {
      d.obligaciones.forEach(o => {
        lista.push({
          id: o.id,
          tipo: 'Obligación',
          emisor: o.emisor,
          plazo: Number(o.plazo_dias || 0),
          tasa: Number(o.interes || 0),
          precio: Number(o.precio_porc || 0),
          rendimiento: Number(o.rendimiento || 0),
          valor_nominal: Number(o.valor_nominal || 0),
          valor_efectivo: Number(o.valor_efectivo || 0),
          fecha: limpiarFecha(o.fecha),
          emision: limpiarFecha(o.emision),
          vencimiento: limpiarFecha(o.vencimiento)
        });
      });
    }

    if (d.papeles) {
      d.papeles.forEach(p => {
        lista.push({
          id: p.id,
          tipo: 'Papel Comercial',
          emisor: p.emisor,
          plazo: Number(p.plazo_dias || 0),
          tasa: Number(p.interes || 0),
          precio: Number(p.precio_porc || 0),
          rendimiento: Number(p.rendimiento || 0),
          valor_nominal: Number(p.valor_nominal || 0),
          valor_efectivo: Number(p.valor_efectivo || 0),
          fecha: limpiarFecha(p.fecha),
          emision: limpiarFecha(p.emision),
          vencimiento: limpiarFecha(p.vencimiento)
        });
      });
    }

    if (d.facturas) {
      d.facturas.forEach(f => {
        let plazo = 0;
        if (f.emision && f.vencimiento) {
          const emisionLimpia = f.emision.split(' ')[0];
          const vencimientoLimpio = f.vencimiento.split(' ')[0];
          const fEmision = new Date(emisionLimpia + 'T00:00:00');
          const fVenc = new Date(vencimientoLimpio + 'T00:00:00');
          plazo = Math.round((fVenc.getTime() - fEmision.getTime()) / (1000 * 60 * 60 * 24));
        } else if (f.fecha && f.vencimiento) {
          const fechaLimpia = f.fecha.split(' ')[0];
          const vencimientoLimpio = f.vencimiento.split(' ')[0];
          const fFecha = new Date(fechaLimpia + 'T00:00:00');
          const fVenc = new Date(vencimientoLimpio + 'T00:00:00');
          plazo = Math.round((fVenc.getTime() - fFecha.getTime()) / (1000 * 60 * 60 * 24));
        }
        lista.push({
          id: f.id,
          tipo: 'Factura',
          emisor: f.emisor,
          plazo: Number(plazo || 0),
          tasa: 0,
          precio: Number(f.precio_porc || 0),
          rendimiento: Number(f.rendimiento || 0),
          valor_nominal: Number(f.valor_nominal || 0),
          valor_efectivo: Number(f.valor_efectivo || 0),
          fecha: limpiarFecha(f.fecha),
          emision: limpiarFecha(f.emision),
          vencimiento: limpiarFecha(f.vencimiento)
        });
      });
    }

    if (d.titularizaciones) {
      d.titularizaciones.forEach(t => {
        lista.push({
          id: t.id,
          tipo: 'Titularización',
          emisor: t.emisor,
          plazo: Number(t.plazo_dias || 0),
          tasa: Number(t.interes || 0),
          precio: Number(t.precio_porc || 0),
          rendimiento: Number(t.rendimiento || 0),
          valor_nominal: Number(t.valor_nominal || 0),
          valor_efectivo: Number(t.valor_efectivo || 0),
          fecha: limpiarFecha(t.fecha),
          emision: limpiarFecha(t.emision),
          vencimiento: limpiarFecha(t.vencimiento)
        });
      });
    }

    if (d.genericos) {
      d.genericos.forEach(g => {
        lista.push({
          id: g.id,
          tipo: 'Valor Genérico',
          emisor: g.emisor,
          plazo: Number(g.plazo_dias || 0),
          tasa: Number(g.interes || 0),
          precio: Number(g.precio_porc || 0),
          rendimiento: Number(g.rendimiento || 0),
          valor_nominal: Number(g.valor_nominal || 0),
          valor_efectivo: Number(g.valor_efectivo || 0),
          fecha: limpiarFecha(g.fecha),
          emision: limpiarFecha(g.emision),
          vencimiento: limpiarFecha(g.vencimiento)
        });
      });
    }

    this.rentaFijaConsolidada = lista.sort((a, b) => b.rendimiento - a.rendimiento);
  }

  calcularMetricas(d: DatosResumenDiario): void {
    let volTotal = 0;
    
    // Inicializar nuevas métricas
    let maxCortoPlazo = 0;
    let emisorCorto = 'No hay operaciones';
    let maxLargoPlazo = 0;
    let emisorLargo = 'No hay operaciones';

    // Eficiencia (Rendimiento / Plazo)
    let maxEficiencia = 0;
    let tasaEficiencia = 0;
    let plazoEficiencia = 0;
    let emisorEficiencia = 'No hay operaciones';

    // Mayor Descuento (Precio mínimo RF)
    let minPrecioRF = 999999;
    let emisorDescuento = 'No hay operaciones';
    let descAhorro = 0;

    this.rentaFijaConsolidada.forEach(item => {
      const efectivo = Number(item.valor_efectivo || 0);
      volTotal += efectivo;

      // Calcular rendimiento máximo por plazos (Renta Fija únicamente)
      if (item.rendimiento > 0 && item.plazo > 0) {
        if (item.plazo <= 360) {
          if (item.rendimiento > maxCortoPlazo) {
            maxCortoPlazo = item.rendimiento;
            emisorCorto = `${item.tipo} - ${item.emisor}`;
          }
        } else {
          if (item.rendimiento > maxLargoPlazo) {
            maxLargoPlazo = item.rendimiento;
            emisorLargo = `${item.tipo} - ${item.emisor}`;
          }
        }
      }

      // 1. Eficiencia: rendimiento / plazo
      if (item.rendimiento > 0 && item.plazo > 0) {
        const eficiencia = item.rendimiento / item.plazo;
        if (eficiencia > maxEficiencia) {
          maxEficiencia = eficiencia;
          tasaEficiencia = item.rendimiento;
          plazoEficiencia = item.plazo;
          emisorEficiencia = `${item.tipo} - ${item.emisor}`;
        }
      }

      // 2. Mayor Descuento: precio más bajo por debajo de 100
      const precio = Number(item.precio || 0);
      if (precio > 0) {
        if (precio < minPrecioRF) {
          minPrecioRF = precio;
          descAhorro = precio < 100 ? (100 - precio) : 0;
          emisorDescuento = `${item.tipo} - ${item.emisor}`;
        }
      }
    });

    this.acciones.forEach(item => {
      const efectivo = Number(item.efectivo || 0);
      volTotal += efectivo;
    });

    this.volumenEfectivoTotal = volTotal;

    this.rendimientoMaxCortoPlazo = maxCortoPlazo;
    this.emisorMaxCortoPlazo = emisorCorto;
    this.rendimientoMaxLargoPlazo = maxLargoPlazo;
    this.emisorMaxLargoPlazo = emisorLargo;

    // Asignar nuevas métricas
    this.eficienciaTasa = tasaEficiencia;
    this.eficienciaPlazo = plazoEficiencia;
    this.eficienciaEmisor = emisorEficiencia;

    this.descuentoPrecio = minPrecioRF < 999999 ? minPrecioRF : 0;
    this.descuentoAhorro = descAhorro;
    this.descuentoEmisor = emisorDescuento;
  }

  construirGraficoRendimientoMaximo(d: DatosResumenDiario): void {
    const maximos: { [key: string]: { tasa: number; emisor: string; emision: string; vencimiento: string } } = {
      'Bono': { tasa: 0, emisor: 'No hay operaciones', emision: '', vencimiento: '' },
      'Obligación': { tasa: 0, emisor: 'No hay operaciones', emision: '', vencimiento: '' },
      'Papel Comercial': { tasa: 0, emisor: 'No hay operaciones', emision: '', vencimiento: '' },
      'Factura': { tasa: 0, emisor: 'No hay operaciones', emision: '', vencimiento: '' },
      'Titularización': { tasa: 0, emisor: 'No hay operaciones', emision: '', vencimiento: '' },
      'Valor Genérico': { tasa: 0, emisor: 'No hay operaciones', emision: '', vencimiento: '' }
    };

    this.rentaFijaConsolidada.forEach(item => {
      if (item.rendimiento > 0 && maximos[item.tipo] !== undefined) {
        if (item.rendimiento > maximos[item.tipo].tasa) {
          maximos[item.tipo].tasa = item.rendimiento;
          maximos[item.tipo].emisor = item.emisor;
          maximos[item.tipo].emision = item.emision;
          maximos[item.tipo].vencimiento = item.vencimiento;
        }
      }
    });

    const labels: string[] = [];
    const data: number[] = [];
    const backgroundColors: string[] = [];
    const borderColors: string[] = [];

    const configInstrumentos = [
      { tipo: 'Bono', label: 'Bonos', color: '#3b82f6' },
      { tipo: 'Obligación', label: 'Obligaciones', color: '#10b981' },
      { tipo: 'Titularización', label: 'Titularizaciones', color: '#ec4899' },
      { tipo: 'Factura', label: 'Facturas Comerciales', color: '#8b5cf6' },
      { tipo: 'Papel Comercial', label: 'Papeles Comerciales', color: '#f59e0b' },
      { tipo: 'Valor Genérico', label: 'Valores Genéricos', color: '#06b6d4' }
    ];

    // Ordenar de mayor a menor por rendimiento máximo
    configInstrumentos.sort((a, b) => {
      const tasaA = maximos[a.tipo]?.tasa || 0;
      const tasaB = maximos[b.tipo]?.tasa || 0;
      return tasaB - tasaA;
    });

    configInstrumentos.forEach(item => {
      const maxObj = maximos[item.tipo];
      labels.push(item.label);
      data.push(Number(maxObj.tasa.toFixed(2)));
      backgroundColors.push(item.color);
      borderColors.push(item.color);
    });

    this.graficoRendimientoDatos = {
      labels: labels,
      datasets: [
        {
          label: 'Rendimiento Máximo (%)',
          data: data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.5
        }
      ]
    };

    this.rendimientoLeyenda = configInstrumentos
      .map(item => {
        const maxObj = maximos[item.tipo];
        let detalle = maxObj.emisor;
        if (maxObj.tasa > 0) {
          const emisionLimpia = maxObj.emision ? maxObj.emision.split(' ')[0] : 'N/A';
          const vencimientoLimpio = maxObj.vencimiento ? maxObj.vencimiento.split(' ')[0] : 'N/A';
          detalle = `${maxObj.emisor} (Emi: ${emisionLimpia} - Venc: ${vencimientoLimpio})`;
        }
        return {
          color: item.color,
          label: item.label,
          valor: maxObj.tasa > 0 ? `${maxObj.tasa.toFixed(2)}%` : '0.00%',
          detalle: detalle
        };
      });

    this.graficoRendimientoOpciones = {
      responsive: true,
      maintainAspectRatio: false,
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
              const valor = context.raw;
              const matchedConfig = configInstrumentos.find(c => c.label === context.label);
              if (matchedConfig) {
                const maxObj = maximos[matchedConfig.tipo];
                if (maxObj.tasa > 0) {
                  const emisionLimpia = maxObj.emision ? maxObj.emision.split(' ')[0] : 'N/A';
                  const vencimientoLimpio = maxObj.vencimiento ? maxObj.vencimiento.split(' ')[0] : 'N/A';
                  return ` Rendimiento Máximo: ${valor.toFixed(2)}% (${maxObj.emisor} | Emi: ${emisionLimpia} - Venc: ${vencimientoLimpio})`;
                }
              }
              return ` Rendimiento Máximo: ${valor.toFixed(2)}%`;
            }
          }
        },
        datalabels: {
          display: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#475569',
            font: { size: 10, weight: 'bold' }
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#94a3b8',
            callback: (value: any) => value + '%',
            font: { size: 9 }
          },
          grid: {
            color: '#f1f5f9'
          },
          title: {
            display: true,
            text: 'Rendimiento Máximo (%)',
            color: '#475569',
            font: { size: 10, weight: 'bold' }
          }
        }
      }
    };
  }

  construirGraficoCurva(d: DatosResumenDiario): void {
    const seriesMap: { [key: string]: any[] } = {
      'Bono': [],
      'Obligación': [],
      'Papel Comercial': [],
      'Factura': [],
      'Titularización': [],
      'Valor Genérico': []
    };

    this.rentaFijaConsolidada.forEach(item => {
      if (item.vencimiento && item.vencimiento !== '0000-00-00' && item.rendimiento > 0) {
        // Clean up the date string to remove any time components (e.g. "2033-05-07 00:00:00")
        const fechaLimpia = item.vencimiento.split(' ')[0];
        const timestamp = new Date(fechaLimpia + 'T00:00:00').getTime();
        if (!isNaN(timestamp)) {
          if (!seriesMap[item.tipo]) {
            seriesMap[item.tipo] = [];
          }
          seriesMap[item.tipo].push({
            x: timestamp,
            y: item.rendimiento,
            label: item.tipo,
            emisor: item.emisor,
            vencimiento: item.vencimiento
          });
        }
      }
    });

    const datasets: any[] = [];
    const colors: { [key: string]: string } = {
      'Bono': '#3b82f6',
      'Obligación': '#10b981',
      'Papel Comercial': '#f59e0b',
      'Factura': '#8b5cf6',
      'Titularización': '#ec4899',
      'Valor Genérico': '#06b6d4'
    };

    for (const tipo in seriesMap) {
      if (seriesMap[tipo].length > 0) {
        const nombresPlurales: { [key: string]: string } = {
          'Bono': 'Bonos',
          'Obligación': 'Obligaciones',
          'Papel Comercial': 'Papeles Comerciales',
          'Factura': 'Facturas Comerciales',
          'Titularización': 'Titularizaciones',
          'Valor Genérico': 'Valores Genéricos'
        };
        datasets.push({
          label: nombresPlurales[tipo] || tipo,
          data: seriesMap[tipo],
          backgroundColor: colors[tipo] || '#6b7280',
          pointRadius: 6,
          pointHoverRadius: 8,
          pointHitRadius: 10
        });
      }
    }

    this.graficoCurvaDatos = {
      datasets: datasets
    };

    this.graficoCurvaOpciones = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false,
        axis: 'xy'
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
            tooltipFormat: 'yyyy-MM-dd',
            displayFormats: {
              month: 'yyyy-MM'
            }
          },
          title: {
            display: true,
            text: 'Año-Mes de Vencimiento',
            color: '#495057',
            font: { size: 11, weight: 'bold' }
          },
          grid: {
            color: '#e5e7eb'
          }
        },
        y: {
          type: 'linear',
          title: {
            display: true,
            text: 'Rendimiento (%)',
            color: '#495057',
            font: { size: 11, weight: 'bold' }
          },
          grid: {
            color: '#e5e7eb'
          }
        }
      },
      plugins: {
        datalabels: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const p = context.raw;
              return ` ${p.label} - ${p.emisor}: Vence: ${p.vencimiento}, Rend. ${p.y.toFixed(2)}%`;
            }
          }
        }
      }
    };
  }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
  }

  formatearNumero(valor: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor);
  }

  formatearPorcentaje(valor: number): string {
    return valor.toFixed(2) + '%';
  }

  obtenerTipoBadge(tipo: string): "success" | "secondary" | "info" | "warning" | "danger" | "contrast" | undefined {
    switch (tipo) {
      case 'Bono': return 'info';
      case 'Obligación': return 'success';
      case 'Papel Comercial': return 'warning';
      case 'Factura': return 'danger';
      case 'Titularización': return 'secondary';
      case 'Valor Genérico': return 'contrast';
      default: return 'warning';
    }
  }

  exportarExcel(): void {
    if (this.rentaFijaConsolidada.length === 0 && this.acciones.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No hay datos disponibles para exportar.'
      });
      return;
    }

    const wb = XLSX.utils.book_new();

    const fechaInicioStr = this.fechaInicio.toLocaleDateString('es-EC');
    const fechaFinStr = this.fechaFin.toLocaleDateString('es-EC');
    const rangoFechas = fechaInicioStr === fechaFinStr ? fechaInicioStr : `${fechaInicioStr} al ${fechaFinStr}`;

    // 1. Hoja de Resumen
    const resumenData = [
      ['RESUMEN DE TRANSACCIONES DE BOLSA'],
      [`Rango de Fechas: ${rangoFechas}`],
      [],
      ['Métrica', 'Valor', 'Detalle / Instrumento'],
      ['Rendimiento Máx. Corto Plazo (<= 360 días)', this.rendimientoMaxCortoPlazo / 100, this.emisorMaxCortoPlazo],
      ['Rendimiento Máx. Largo Plazo (> 360 días)', this.rendimientoMaxLargoPlazo / 100, this.emisorMaxLargoPlazo],
      ['Mejor Relación Rendimiento/Plazo (Eficiencia)', this.eficienciaTasa / 100, `A ${this.eficienciaPlazo} días - ${this.eficienciaEmisor}`],
      ['Mayor Descuento (Precio Mínimo Renta Fija)', this.descuentoPrecio / 100, `Ahorro: ${this.descuentoAhorro.toFixed(2)}% - ${this.descuentoEmisor}`],
      ['Volumen Efectivo Total Negociado', this.volumenEfectivoTotal, 'Renta Fija + Renta Variable'],
      []
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    // 2. Hoja de Renta Fija
    const rfData = this.rentaFijaConsolidada.map(item => ({
      'Tipo de Papel': item.tipo,
      'Emisor / Decreto': item.emisor,
      'Plazo (Días)': item.plazo,
      'Tasa (%)': item.tasa,
      'Precio (%)': item.precio,
      'Rendimiento (%)': item.rendimiento,
      'Valor Nominal ($)': item.valor_nominal,
      'Valor Efectivo ($)': item.valor_efectivo,
      'Vencimiento': item.vencimiento
    }));
    const wsRF = XLSX.utils.json_to_sheet(rfData);
    XLSX.utils.book_append_sheet(wb, wsRF, 'Renta Fija');

    // 3. Hoja de Acciones
    const rvData = this.acciones.map(item => ({
      'Emisor': item.emisor,
      'Tipo': item.tipo,
      'Valor Nominal ($)': item.valor_nominal,
      'Precio ($)': item.precio,
      'Cantidad': item.cantidad,
      'Efectivo ($)': item.efectivo,
      'Procedencia': item.procedencia
    }));
    const wsRV = XLSX.utils.json_to_sheet(rvData);
    XLSX.utils.book_append_sheet(wb, wsRV, 'Acciones');

    // 4. Hoja de Cierres de Mercado
    const cierresData = this.cierresAcciones.map(item => ({
      'Emisor': item.emisor,
      'Fecha Último Cierre': item.fecha_maxima,
      'Precio Máximo ($)': item.precio_maximo,
      'Precio Mínimo ($)': item.precio_minimo,
      'Precio Promedio ($)': item.precio_promedio
    }));
    const wsCierres = XLSX.utils.json_to_sheet(cierresData);
    XLSX.utils.book_append_sheet(wb, wsCierres, 'Últimos Cierres');

    const fechaInicioF = this.fechaInicio.toISOString().slice(0, 10);
    const fechaFinF = this.fechaFin.toISOString().slice(0, 10);
    const rangoF = fechaInicioF === fechaFinF ? fechaInicioF : `${fechaInicioF}_a_${fechaFinF}`;
    XLSX.writeFile(wb, `Resumen_Bolsa_${rangoF}.xlsx`);

    this.messageService.add({
      severity: 'success',
      summary: 'Exportación',
      detail: 'Archivo Excel generado y descargado correctamente.'
    });
  }

  exportarPDF(): void {
    if (this.rentaFijaConsolidada.length === 0 && this.acciones.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No hay datos disponibles para exportar.'
      });
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const fechaInicioStr = this.fechaInicio.toLocaleDateString('es-EC');
    const fechaFinStr = this.fechaFin.toLocaleDateString('es-EC');
    const rangoFechas = fechaInicioStr === fechaFinStr ? fechaInicioStr : `${fechaInicioStr} al ${fechaFinStr}`;

    // Título principal
    doc.setFontSize(16);
    doc.setTextColor(33, 37, 41);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN DE TRANSACCIONES DE BOLSA', 148, 15, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Rango de Fechas: ${rangoFechas}`, 148, 22, { align: 'center' });

    // Dibujar Cajas de Métricas (KPI Cards)
    doc.setDrawColor(220, 224, 230);
    doc.setFillColor(248, 249, 250);
    
    // Card 1: Rendimiento Máx. Corto Plazo
    doc.rect(15, 28, 60, 22, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text('REND. MÁX. CORTO PLAZO', 18, 33);
    doc.setFontSize(11);
    doc.setTextColor(34, 197, 94); // Verde
    doc.text(this.formatearPorcentaje(this.rendimientoMaxCortoPlazo), 18, 39);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(108, 117, 125);
    const emisorCortoTrunc = this.emisorMaxCortoPlazo.length > 38 
      ? this.emisorMaxCortoPlazo.substring(0, 35) + '...' 
      : this.emisorMaxCortoPlazo;
    doc.text(emisorCortoTrunc, 18, 45);

    // Card 2: Rendimiento Máx. Largo Plazo
    doc.rect(82, 28, 60, 22, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text('REND. MÁX. LARGO PLAZO', 85, 33);
    doc.setFontSize(11);
    doc.setTextColor(59, 130, 246); // Azul
    doc.text(this.formatearPorcentaje(this.rendimientoMaxLargoPlazo), 85, 39);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(108, 117, 125);
    const emisorLargoTrunc = this.emisorMaxLargoPlazo.length > 38 
      ? this.emisorMaxLargoPlazo.substring(0, 35) + '...' 
      : this.emisorMaxLargoPlazo;
    doc.text(emisorLargoTrunc, 85, 45);

    // Card 3: Eficiencia de Tasa
    doc.rect(149, 28, 60, 22, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text('EFICIENCIA TASA (REND/PLAZO)', 152, 33);
    doc.setFontSize(11);
    doc.setTextColor(139, 92, 246); // Púrpura/Indigo
    doc.text(this.eficienciaTasa > 0 ? this.formatearPorcentaje(this.eficienciaTasa) : 'N/A', 152, 39);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(108, 117, 125);
    const eficienciaDetalle = `A ${this.eficienciaPlazo}d - ${this.eficienciaEmisor}`;
    const eficienciaDetalleTrunc = eficienciaDetalle.length > 38 
      ? eficienciaDetalle.substring(0, 35) + '...' 
      : eficienciaDetalle;
    doc.text(eficienciaDetalleTrunc, 152, 45);

    // Card 4: Mayor Descuento
    doc.rect(216, 28, 60, 22, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text('MAYOR DESCUENTO (PRECIO MÍN)', 219, 33);
    doc.setFontSize(11);
    doc.setTextColor(245, 158, 11); // Naranja
    doc.text(this.descuentoPrecio > 0 ? `${this.descuentoPrecio.toFixed(2)}%` : 'N/A', 219, 39);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(108, 117, 125);
    const descuentoDetalle = this.descuentoAhorro > 0 
      ? `Ahorro: ${this.descuentoAhorro.toFixed(2)}% - ${this.descuentoEmisor}`
      : `Precio: ${this.descuentoPrecio.toFixed(2)}% - ${this.descuentoEmisor}`;
    const descuentoDetalleTrunc = descuentoDetalle.length > 38 
      ? descuentoDetalle.substring(0, 35) + '...' 
      : descuentoDetalle;
    doc.text(descuentoDetalleTrunc, 219, 45);

    let currentY = 56;

    if (this.rentaFijaConsolidada.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41);
      doc.text('Renta Fija (Papeles de Deuda)', 15, currentY);

      const headersRF = [
        { title: 'Tipo', dataKey: 'tipo' },
        { title: 'Emisor', dataKey: 'emisor' },
        { title: 'Plazo', dataKey: 'plazo' },
        { title: 'Tasa', dataKey: 'tasa' },
        { title: 'Precio', dataKey: 'precio' },
        { title: 'Rendimiento', dataKey: 'rendimiento' },
        { title: 'Valor Nominal', dataKey: 'valor_nominal' },
        { title: 'Valor Efectivo', dataKey: 'valor_efectivo' },
        { title: 'Vencimiento', dataKey: 'vencimiento' }
      ];

      const bodyRF = this.rentaFijaConsolidada.map(item => ({
        tipo: item.tipo,
        emisor: item.emisor,
        plazo: item.plazo + ' días',
        tasa: item.tasa ? item.tasa.toFixed(2) + '%' : 'N/A',
        precio: item.precio.toFixed(4) + '%',
        rendimiento: item.rendimiento.toFixed(2) + '%',
        valor_nominal: this.formatearMoneda(item.valor_nominal),
        valor_efectivo: this.formatearMoneda(item.valor_efectivo),
        vencimiento: item.vencimiento
      }));

      autoTable(doc, {
        columns: headersRF,
        body: bodyRF,
        startY: currentY + 3,
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
        columnStyles: {
          tipo: { cellWidth: 25 },
          emisor: { cellWidth: 55 },
          plazo: { halign: 'right' },
          tasa: { halign: 'right' },
          precio: { halign: 'right' },
          rendimiento: { halign: 'right' },
          valor_nominal: { halign: 'right' },
          valor_efectivo: { halign: 'right' },
          vencimiento: { halign: 'center' }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (this.acciones.length > 0) {
      if (currentY > 150) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41);
      doc.text('Renta Variable (Acciones)', 15, currentY);

      const headersRV = [
        { title: 'Emisor', dataKey: 'emisor' },
        { title: 'Tipo', dataKey: 'tipo' },
        { title: 'Valor Nominal', dataKey: 'valor_nominal' },
        { title: 'Precio', dataKey: 'precio' },
        { title: 'Cantidad', dataKey: 'cantidad' },
        { title: 'Efectivo', dataKey: 'efectivo' },
        { title: 'Procedencia', dataKey: 'procedencia' }
      ];

      const bodyRV = this.acciones.map(item => ({
        emisor: item.emisor,
        tipo: item.tipo,
        valor_nominal: this.formatearMoneda(item.valor_nominal),
        precio: this.formatearMoneda(item.precio),
        cantidad: this.formatearNumero(item.cantidad),
        efectivo: this.formatearMoneda(item.efectivo),
        procedencia: item.procedencia
      }));

      autoTable(doc, {
        columns: headersRV,
        body: bodyRV,
        startY: currentY + 3,
        headStyles: { fillColor: [20, 184, 166] },
        styles: { fontSize: 8 },
        columnStyles: {
          emisor: { cellWidth: 70 },
          tipo: { cellWidth: 30 },
          valor_nominal: { halign: 'right' },
          precio: { halign: 'right' },
          cantidad: { halign: 'right' },
          efectivo: { halign: 'right' },
          procedencia: { halign: 'center' }
        }
      });
    }

    const fechaInicioF = this.fechaInicio.toISOString().slice(0, 10);
    const fechaFinF = this.fechaFin.toISOString().slice(0, 10);
    const rangoF = fechaInicioF === fechaFinF ? fechaInicioF : `${fechaInicioF}_a_${fechaFinF}`;
    doc.save(`Resumen_Bolsa_${rangoF}.pdf`);

    this.messageService.add({
      severity: 'success',
      summary: 'Exportación',
      detail: 'Reporte PDF generado y descargado correctamente.'
    });
  }
}
