import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { ButtonModule } from 'primeng/button';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { InversionService, Inversion } from '../../core/inversion.service';
import { VentaInversionService } from '../../core/venta-inversion.service';
import { MovimientoCapitalService, MovimientoCapital } from '../../core/movimiento-capital.service';
import { AccionPosicionService } from '../../core/accion-posicion.service';
import { ResumenBolsaService } from '../../core/resumen-bolsa.service';

@Component({
  selector: 'app-mensajeria-ia',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TabViewModule,
    ButtonModule,
    InputTextareaModule,
    CardModule,
    ToastModule,
    TableModule,
    CheckboxModule
  ],
  providers: [MessageService],
  templateUrl: './mensajeria-ia.component.html',
  styleUrl: './mensajeria-ia.component.css'
})
export class MensajeriaIaComponent implements OnInit {

  // TAB 1: Inicio de Día (Notas de Crédito)
  inversionesNotas: Inversion[] = [];
  inversionesSeleccionadasMap: { [key: number]: boolean } = {};
  loadingNotas = false;

  contextoTab1 = '';
  promptTab1 = '';
  mensajeFinalTab1 = '';
  generandoTab1 = false;

  // TAB 2: Cierre del Día (Contabilidad)
  saldoEsperadoVal: number | null = null;
  saldosPersonasTexto = '';
  totalGeneralMovimientos = 0;
  cantidadPersonasConSaldo = 0;
  loadingContabilidad = false;
  contextoTab2 = '';
  promptTab2 = '';
  mensajeFinalTab2 = '';
  generandoTab2 = false;

  // TAB 3: Renta Variable (Casa de Valores Santa Fé - José Luis)
  loadingRentaVariable = false;
  contextoTab3 = '';
  promptTab3 = '';
  mensajeFinalTab3 = '';
  generandoTab3 = false;

  constructor(
    private inversionService: InversionService,
    private ventaService: VentaInversionService,
    private movimientoCapitalService: MovimientoCapitalService,
    private accionPosicionService: AccionPosicionService,
    private resumenBolsaService: ResumenBolsaService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.cargarDatosTab1();
    this.cargarDatosTab2();
    this.cargarDatosTab3();
  }

  // ==========================================
  // TAB 1: INICIO DE DÍA (NOTAS DE CRÉDITO)
  // ==========================================
  cargarDatosTab1(): void {
    this.loadingNotas = true;
    this.inversionService.getAll({ tipo_inversion: 91 }).subscribe({
      next: (data: Inversion[]) => {
        if (data) {
          // Filtrar inversiones activas / sin vender de Notas de Crédito
          this.inversionesNotas = data.filter((i: Inversion) => i.fecha_venta === null || i.fecha_venta === undefined);
          // Marcar todas por defecto
          this.inversionesNotas.forEach(i => {
            if (i.id_inversion) this.inversionesSeleccionadasMap[i.id_inversion] = true;
          });
          this.actualizarContextoTab1();
        }
        this.loadingNotas = false;
      },
      error: () => {
        this.loadingNotas = false;
      }
    });
  }

  getNombrePropietario(i: Inversion): string {
    if (i.propietario) {
      return i.propietario.nombre || i.propietario.razon_social || (i.propietario.persona ? i.propietario.persona.nombre : '');
    }
    return `Socio #${i.id_propietario}`;
  }

  get inversionesSeleccionadasTab1(): Inversion[] {
    return this.inversionesNotas.filter(i => i.id_inversion && this.inversionesSeleccionadasMap[i.id_inversion]);
  }

  toggleSeleccionTodas(event: any): void {
    const checked = event.checked;
    this.inversionesNotas.forEach(i => {
      if (i.id_inversion) this.inversionesSeleccionadasMap[i.id_inversion] = checked;
    });
    this.actualizarContextoTab1();
  }

  actualizarContextoTab1(): void {
    const seleccionadas = this.inversionesSeleccionadasTab1;
    let nominalTotal = 0;
    let capitalTotal = 0;

    seleccionadas.forEach(i => {
      nominalTotal += Number(i.valor_nominal || 0);
      capitalTotal += Number(i.capital_invertido || 0);
    });

    const diferencia = nominalTotal - capitalTotal;
    let saldoMovTexto = '';
    if (this.saldosPersonasTexto && this.saldosPersonasTexto.trim().length > 0 && !this.saldosPersonasTexto.includes('Error') && !this.saldosPersonasTexto.includes('Sin saldos')) {
      saldoMovTexto = `\n• 💳 Fondos disponibles para seguir comprando Notas de Crédito:\n${this.saldosPersonasTexto}`;
    }

    this.contextoTab1 = `• Nominal Total: ${this.formatCurrency(nominalTotal)}\n` +
      `• Capital Invertido: ${this.formatCurrency(capitalTotal)}\n` +
      `• Diferencia a favor: ${this.formatCurrency(diferencia)} (${seleccionadas.length} notas seleccionadas)` +
      `${saldoMovTexto}`;

    this.actualizarPromptTab1();
  }

  actualizarPromptTab1(): void {
    const basePrompt = 'Genera 3 elementos breves en español (máximo 60 palabras en total) para el mensaje de inicio de día de Notas de Crédito dirigido a José Luis Vásquez (Presidente de la Casa de Valores Santa Fé). Trato formal de "Usted", sin cifras numéricas.\n\n' +
      'DEBES RESPONDER ÚNICAMENTE CON EL SIGUIENTE FORMATO DE 3 LÍNEAS:\n' +
      'SALUDO: [Escribe aquí un saludo matutino variado a José Luis Vásquez, ej: ¡Buenos días estimado José Luis! / ¡Muy buenos días, Sr. José Luis!]\n' +
      'ARRANQUE: [Escribe aquí una frase variada indicando que a continuación se presenta el estado actual de las Notas de Crédito, ej: Así arrancamos hoy con las Notas de Crédito: / Le comparto los valores de apertura para las Notas de Crédito:]\n' +
      'CIERRE: [Escribe aquí una frase graciosa, alegre o motivacional sobre inversiones para alentar el día laboral]';

    if (this.contextoTab1 && this.contextoTab1.trim().length > 0) {
      this.promptTab1 = `${basePrompt}\nIndicación: Generar SALUDO, ARRANQUE y CIERRE variados para hoy.`;
    } else {
      this.promptTab1 = basePrompt;
    }
  }

  generarMensajeTab1(): void {
    this.generandoTab1 = true;
    const seleccionadas = this.inversionesSeleccionadasTab1;
    let nominalTotal = 0;
    let capitalTotal = 0;

    seleccionadas.forEach(i => {
      nominalTotal += Number(i.valor_nominal || 0);
      capitalTotal += Number(i.capital_invertido || 0);
    });

    const nominal = this.formatCurrency(nominalTotal);
    const capital = this.formatCurrency(capitalTotal);
    const diferencia = this.formatCurrency(nominalTotal - capitalTotal);

    this.ventaService.getBromaDiaria(this.contextoTab1, this.promptTab1).pipe(catchError(() => of(null))).subscribe({
      next: (bromaRes: any) => {
        let saludoText = "¡Buenos días estimado José Luis!";
        let arranqueText = "Así arrancamos hoy con las Notas de Crédito:";
        let cierreText = "¡A comprar y vender se ha dicho! 🚀";

        if (bromaRes && bromaRes.success && bromaRes.data) {
          const rawText = bromaRes.data.trim();
          
          const saludoMatch = rawText.match(/SALUDO:\s*([^\n]+)/i);
          const arranqueMatch = rawText.match(/ARRANQUE:\s*([^\n]+)/i);
          const cierreMatch = rawText.match(/CIERRE:\s*([\s\S]+)/i);

          if (saludoMatch && saludoMatch[1]) {
            saludoText = saludoMatch[1].trim().replace(/^_*|_+$/g, '').replace(/^\*+|\*+$/g, '');
          }
          if (arranqueMatch && arranqueMatch[1]) {
            arranqueText = arranqueMatch[1].trim().replace(/^_*|_+$/g, '').replace(/^\*+|\*+$/g, '');
          }
          if (cierreMatch && cierreMatch[1]) {
            cierreText = cierreMatch[1].trim().replace(/^_*|_+$/g, '').replace(/^\*+|\*+$/g, '');
          }

          // Fallback en caso de que no haya venido alguna de las etiquetas
          if (!saludoMatch && !arranqueMatch && !cierreMatch) {
            const lines = rawText.split('\n').filter((l: string) => l.trim().length > 0);
            if (lines.length >= 1) saludoText = lines[0].trim();
            if (lines.length >= 2) arranqueText = lines[1].trim();
            if (lines.length >= 3) cierreText = lines[2].trim();
          }

          // Garantizar que el saludo incluya a José Luis y buenos días
          if (!/José Luis/i.test(saludoText)) {
            saludoText = `¡Buenos días estimado José Luis!`;
          }
          if (!/^(¡?(buenos|muy buenos|hola|estimado))/i.test(saludoText)) {
            saludoText = `¡Buenos días! ${saludoText}`;
          }

          // Garantizar que el arranque mencione Notas de Crédito o estado
          if (!/notas/i.test(arranqueText) && !/arrancamos/i.test(arranqueText) && !/estado/i.test(arranqueText)) {
            arranqueText = `${arranqueText} Así arrancamos hoy con las Notas de Crédito:`;
          }
        }

        const headerText = `${saludoText} ${arranqueText}`.replace(/\s+/g, ' ').trim();

        let saldoLine = '';
        if (this.saldosPersonasTexto && this.saldosPersonasTexto.trim().length > 0 && !this.saldosPersonasTexto.includes('Error') && !this.saldosPersonasTexto.includes('Sin saldos')) {
          saldoLine = `\n• 💳 *Fondos disponibles para seguir comprando Notas de Crédito:*\n${this.saldosPersonasTexto}`;
        }

        this.mensajeFinalTab1 = `🌅 *${headerText}*\n\n` +
          `• 💰 *Nominal Total:* ${nominal}\n` +
          `• 💵 *Capital Invertido:* ${capital}\n` +
          `• 📈 *Diferencia a favor:* ${diferencia}` +
          `${saldoLine}\n\n` +
          `_${cierreText}_`;

        this.generandoTab1 = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Mensaje Generado',
          detail: 'Mensaje de Inicio de Día generado con éxito.'
        });
      },
      error: () => {
        this.generandoTab1 = false;
      }
    });
  }

  // ==========================================
  // TAB 2: CIERRE DEL DÍA (CONTABILIDAD)
  // ==========================================
  cargarDatosTab2(): void {
    this.loadingContabilidad = true;
    this.movimientoCapitalService.getAll().subscribe({
      next: (res: any) => {
        const movimientos: MovimientoCapital[] = (res && res.success && res.data) ? res.data : [];

        // Agrupar por persona
        const movimientosPorPersona: { [key: number]: MovimientoCapital[] } = {};
        movimientos.forEach(mov => {
          const idPersona = mov.persona?.id_persona || mov.id_persona || 0;
          if (!movimientosPorPersona[idPersona]) {
            movimientosPorPersona[idPersona] = [];
          }
          movimientosPorPersona[idPersona].push(mov);
        });

        const saldosActivos: string[] = [];
        let totalGeneral = 0;

        Object.keys(movimientosPorPersona).forEach(idPersonaStr => {
          const idPersona = parseInt(idPersonaStr);
          const movs = movimientosPorPersona[idPersona];

          // Ordenar por fecha e ID
          const sorted = [...movs].sort((a, b) => {
            const dateA = new Date(a.fecha_movimiento).getTime();
            const dateB = new Date(b.fecha_movimiento).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return (a.id_movimiento_capital || 0) - (b.id_movimiento_capital || 0);
          });

          let saldoPersona = 0;
          let nombrePersona = 'General / Sin asignación';
          if (sorted[0].persona) {
            const p = sorted[0].persona;
            nombrePersona = `${p.nombres || p.nombre || ''} ${p.apellidos || ''}`.trim() || 'Socio';
          }

          sorted.forEach(mov => {
            const monto = Number(mov.monto || 0);
            const signo = mov.signo_catalogo || mov.signoCatalogo;
            if (signo && signo.codigo === 'POSITIVO') {
              saldoPersona += monto;
            } else {
              saldoPersona -= monto;
            }
          });

          if (Math.abs(saldoPersona) < 0.005) {
            saldoPersona = 0;
          }

          if (saldoPersona !== 0) {
            saldosActivos.push(`• 👤 ${nombrePersona}: ${this.formatCurrency(saldoPersona)}`);
          }
          totalGeneral += saldoPersona;
        });

        this.totalGeneralMovimientos = totalGeneral;
        this.cantidadPersonasConSaldo = saldosActivos.length;
        this.saldosPersonasTexto = saldosActivos.length > 0
          ? saldosActivos.join('\n')
          : '• _Sin saldos activos por persona_';

        this.actualizarContextoTab2();
        this.actualizarContextoTab1();
        this.loadingContabilidad = false;
      },
      error: () => {
        this.saldosPersonasTexto = '• _Error al cargar movimientos de capital_';
        this.totalGeneralMovimientos = 0;
        this.cantidadPersonasConSaldo = 0;
        this.actualizarContextoTab2();
        this.actualizarContextoTab1();
        this.loadingContabilidad = false;
      }
    });
  }

  actualizarContextoTab2(): void {
    const totalGeneralStr = this.formatCurrency(this.totalGeneralMovimientos || 0);
    let resumenLineas = '';

    if (this.cantidadPersonasConSaldo > 1) {
      resumenLineas = `• 🏦 Total General: ${totalGeneralStr}\n${this.saldosPersonasTexto}`;
    } else {
      resumenLineas = `${this.saldosPersonasTexto}`;
    }

    this.contextoTab2 = `Saldos de Movimientos de Capital al cierre:\n` +
      `${resumenLineas}\n` +
      `• ✅ He registrado las operaciones de la jornada.`;

    this.actualizarPromptTab2();
  }

  actualizarPromptTab2(): void {
    const basePrompt = 'Genera una frase corta de alivio, satisfacción o saludo cordial en español para notificar a la contadora Maribel Molina al cierre del día laboral. No incluyas ni repitas ninguna cifra o monto de dinero. Pide amablemente su confirmación de que todo quedó conforme. Máximo 25 palabras. Usa siempre el trato formal de "Usted" y un emoji al final.';
    if (this.contextoTab2 && this.contextoTab2.trim().length > 0) {
      this.promptTab2 = `${basePrompt}\nIndicación: Pedir confirmación de que todo está conforme amablemente.`;
    } else {
      this.promptTab2 = basePrompt;
    }
  }

  generarMensajeTab2(): void {
    this.generandoTab2 = true;
    this.ventaService.getBromaDiaria(this.contextoTab2, this.promptTab2).subscribe({
      next: (res: any) => {
        let fraseCierre = "¡Caja cuadrada y día finalizado con éxito! 🌆";
        if (res && res.success && res.data) {
          fraseCierre = res.data;
        }

        const totalGeneralStr = this.formatCurrency(this.totalGeneralMovimientos || 0);
        let desgloseSaldos = '';

        if (this.cantidadPersonasConSaldo > 1) {
          desgloseSaldos = `• 🏦 *Total General Movimientos de Capital:* ${totalGeneralStr}\n👥 *Saldos por Persona:*\n${this.saldosPersonasTexto}`;
        } else {
          desgloseSaldos = `👥 *Saldo por Persona:*\n${this.saldosPersonasTexto}`;
        }

        this.mensajeFinalTab2 = `🌆 *¡Buenas tardes estimada Maribel! Reporte de Cierre del Día para Contabilidad:*\n\n` +
          `${desgloseSaldos}\n\n` +
          `• ✅ *Estado del Cuadre:* He registrado las operaciones de la jornada.\n\n` +
          `_${fraseCierre}_`;

        this.generandoTab2 = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Mensaje Generado',
          detail: 'Mensaje de Cierre Contable generado con éxito.'
        });
      },
      error: () => {
        this.generandoTab2 = false;
      }
    });
  }

  // ==========================================
  // TAB 3: RENTA VARIABLE (CASA DE VALORES SANTA FÉ - JOSÉ LUIS)
  // ==========================================
  cargarDatosTab3(): void {
    this.loadingRentaVariable = true;
    forkJoin({
      posicionesRes: this.accionPosicionService.getPosiciones().pipe(catchError(() => of(null))),
      cierresRes: this.resumenBolsaService.obtenerUltimoCierreAcciones().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ posicionesRes, cierresRes }: any) => {
        const cierresLista = (cierresRes && cierresRes.exito && cierresRes.datos) ? cierresRes.datos : [];

        const findCierreOficial = (emisor: string): any => {
          if (!emisor || cierresLista.length === 0) return null;
          const eNorm = emisor.toUpperCase();
          let match = cierresLista.find((c: any) => {
            const cNorm = (c.emisor || '').toUpperCase();
            return cNorm === eNorm || cNorm.includes(eNorm) || eNorm.includes(cNorm);
          });
          if (match) return match;

          const palabrasClave = ['GUAYAQUIL', 'PICHINCHA', 'PRODUBANCO', 'BOLIVARIANO', 'AUSTRO', 'FAVORITA', 'CRIDESA', 'SAN CARLOS', 'HOLCIM', 'NATLUK'];
          const kw = palabrasClave.find(k => eNorm.includes(k));
          if (kw) {
            return cierresLista.find((c: any) => (c.emisor || '').toUpperCase().includes(kw));
          }
          return null;
        };

        const lineas: string[] = [];

        if (posicionesRes && posicionesRes.success && posicionesRes.data && posicionesRes.data.length > 0) {
          const emisoresMap: { [key: string]: { precio: number; capital: number; mercado: number; emisorOriginal: string } } = {};

          posicionesRes.data.forEach((p: any) => {
            const emisor = (p.emisor_nombre || p.instrumento || 'Acción').trim();
            const key = emisor.toUpperCase();
            const precio = p.precio_ultimo ? Number(p.precio_ultimo) : 0;
            const cap = p.capital_invertido ? Number(p.capital_invertido) : 0;
            const merc = p.valor_mercado ? Number(p.valor_mercado) : (p.cantidad_actual ? Number(p.cantidad_actual) * precio : 0);

            if (!emisoresMap[key]) {
              emisoresMap[key] = {
                precio,
                capital: 0,
                mercado: 0,
                emisorOriginal: emisor
              };
            }
            if (precio > 0) emisoresMap[key].precio = precio;
            emisoresMap[key].capital += cap;
            emisoresMap[key].mercado += merc;
          });

          Object.keys(emisoresMap).forEach(key => {
            const d = emisoresMap[key];
            const emisorNombre = d.emisorOriginal;
            const cierreOficial = findCierreOficial(emisorNombre);

            if (cierreOficial) {
              const precioUltimo = cierreOficial.precio_promedio ? parseFloat(cierreOficial.precio_promedio) : d.precio;
              if (precioUltimo > 0) d.precio = precioUltimo;

              const cambio = cierreOficial.cambio_diario !== undefined && cierreOficial.cambio_diario !== null
                ? parseFloat(cierreOficial.cambio_diario)
                : 0;

              if (cambio > 0) {
                lineas.push(`• ${emisorNombre}: 📈 último precio: $${d.precio.toFixed(2)}, subió $${Math.abs(cambio).toFixed(2)}`);
              } else if (cambio < 0) {
                lineas.push(`• ${emisorNombre}: 🔻 último precio: $${d.precio.toFixed(2)}, bajó $${Math.abs(cambio).toFixed(2)}`);
              } else {
                lineas.push(`• ${emisorNombre}: ➡️ último precio: $${d.precio.toFixed(2)}, sin cambio`);
              }
            } else {
              lineas.push(`• ${emisorNombre}: ➡️ último precio: $${d.precio.toFixed(2)}, sin cambio`);
            }
          });

          this.contextoTab3 = lineas.join('\n');
        } else {
          this.contextoTab3 = 'Sin posiciones activas de renta variable en el portafolio.';
        }

        this.actualizarPromptTab3();
        this.loadingRentaVariable = false;
      },
      error: () => {
        this.contextoTab3 = 'Error al consultar variaciones de acciones.';
        this.actualizarPromptTab3();
        this.loadingRentaVariable = false;
      }
    });
  }

  actualizarPromptTab3(): void {
    const basePrompt = 'Genera una frase amigable, ingeniosa y breve (máximo 50 palabras) escrita en primera persona desde la perspectiva del inversionista que le escribe a su corredor de bolsa en Ecuador. Debe hacer un comentario con toque de humor entusiasta sobre el estado reciente de sus acciones y pedir su recomendación u opinión experta. Usa emojis al final. El mensaje va dirigido al Presidente de la Casa de Valores Santa Fé, su nombre es José Luis. Usa la información del portafolio para generar la frase. El trato debe ser de usted.';
    if (this.contextoTab3 && this.contextoTab3.trim().length > 0) {
      this.promptTab3 = `${basePrompt} El estado y movimientos recientes de mi portafolio son:\n'${this.contextoTab3}'`;
    } else {
      this.promptTab3 = basePrompt;
    }
  }

  generarMensajeTab3(): void {
    this.generandoTab3 = true;
    this.ventaService.getBromaDiaria(this.contextoTab3, this.promptTab3).subscribe({
      next: (res: any) => {
        let fraseIA = "¡Hola José Luis! ¿Cómo ves las acciones hoy para mover ficha en Santa Fé? 🚀";
        if (res && res.success && res.data) {
          fraseIA = res.data;
        }

        this.mensajeFinalTab3 = `📊 *Reporte de Situación de Renta Variable:*\n` +
          `${this.contextoTab3}\n\n` +
          `_${fraseIA}_`;

        this.generandoTab3 = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Mensaje Generado',
          detail: 'Mensaje para Renta Variable generado con éxito.'
        });
      },
      error: () => {
        this.generandoTab3 = false;
      }
    });
  }

  // ==========================================
  // UTILERÍAS DE COPIADO Y FORMATO
  // ==========================================
  copiarAlPortapapeles(texto: string, titulo: string): void {
    if (!texto) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Texto Vacío',
        detail: 'No hay mensaje generado para copiar.'
      });
      return;
    }

    navigator.clipboard.writeText(texto).then(() => {
      this.messageService.add({
        severity: 'success',
        summary: '¡Copiado!',
        detail: `${titulo} copiado al portapapeles con éxito.`
      });
    }).catch(err => {
      console.error('Error al copiar:', err);
    });
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  getDiferencia(nota: Inversion): number {
    return Number(nota.valor_nominal || 0) - Number(nota.capital_invertido || 0);
  }

  getPrecioCompraPercent(nota: Inversion): string {
    if (nota.precio_compra !== undefined && nota.precio_compra !== null) {
      return Number(nota.precio_compra).toFixed(2) + '%';
    }
    const nominal = Number(nota.valor_nominal || 0);
    const capital = Number(nota.capital_invertido || 0);
    if (nominal > 0) {
      return ((capital / nominal) * 100).toFixed(2) + '%';
    }
    return '100.00%';
  }

  getDiasTranscurridos(fechaCompra?: string): number {
    if (!fechaCompra) return 0;
    const inicio = new Date(fechaCompra);
    const hoy = new Date();
    const diffTime = Math.abs(hoy.getTime() - inicio.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }
}
