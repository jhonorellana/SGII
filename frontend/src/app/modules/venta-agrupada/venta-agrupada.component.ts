import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { InversionService, Inversion } from '../../core/inversion.service';
import { VentaInversionService, VentaAgrupadaRequest } from '../../core/venta-inversion.service';
import { PersonaService } from '../../core/persona.service';
import { ModalActionsComponent } from '../../core/modal-actions';
import { PaginationService } from '../../core/pagination.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MovimientoCapitalService } from '../../core/movimiento-capital.service';
import { AccionPosicionService } from '../../core/accion-posicion.service';
import { ResumenBolsaService } from '../../core/resumen-bolsa.service';
import { Table } from 'primeng/table';

@Component({
  selector: 'app-venta-agrupada',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    CheckboxModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    CalendarModule,
    DropdownModule,
    InputTextareaModule,
    CardModule,
    TagModule,
    ProgressBarModule,
    ToastModule,
    ModalActionsComponent
  ],
  providers: [MessageService],
  templateUrl: './venta-agrupada.component.html',
  styleUrl: './venta-agrupada.component.css'
})
export class VentaAgrupadaComponent implements OnInit {
  inversiones: Inversion[] = [];
  inversionesSeleccionadas: number[] = [];
  inversionSeleccionadaMap: { [key: number]: boolean } = {};
  personas: any[] = [];

  loading = false;
  loadingCalculo = false;
  displayDialog = false;
  displayPrevisualizar = false;
  generandoMensaje = false;
  displayModalIA = false;
  contextoIA = '';
  promptIA = '';
  mensajeGeneradoIA = '';
  rowsPerPage: number = 10;

  actualizarPromptIA(): void {
    const basePrompt = 'Genera una frase amigable, ingeniosa y breve (máximo 30 palabras) escrita en primera persona desde la perspectiva de un inversionista que le escribe a su corredor de bolsa en Ecuador. Debe hacer un comentario con toque de humor entusiasta sobre el estado reciente de sus acciones y pedir su recomendación u opinión experta. Usa emojis al final. La casa de Valores se llama Santa Fé. La persona a quien va dirigido el mensaje es José Luis. Usa la información del portafolio para generar la frase.';
    if (this.contextoIA && this.contextoIA.trim().length > 0) {
      this.promptIA = `${basePrompt}\n\nEl estado y movimientos recientes de su portafolio son:\n'${this.contextoIA}'`;
    } else {
      this.promptIA = basePrompt;
    }
  }
  rowsPerPageModal: number = 10;

  ventaForm: FormGroup;
  previsualizacion: any = null;
  @ViewChild('dt') table!: Table;

  constructor(
    private fb: FormBuilder,
    private inversionService: InversionService,
    private ventaService: VentaInversionService,
    private personaService: PersonaService,
    private movimientoCapitalService: MovimientoCapitalService,
    private accionPosicionService: AccionPosicionService,
    private resumenBolsaService: ResumenBolsaService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
    private paginationService: PaginationService
  ) {
    this.ventaForm = this.createForm();
  }

  ngOnInit(): void {
    this.rowsPerPage = this.paginationService.getRowsPerPage('ventaAgrupada', 10);
    this.rowsPerPageModal = this.paginationService.getRowsPerPage('ventaAgrupadaModal', 10);
    this.loadPersonas();
    this.loadInversiones();

    // Suscribirse a cambios en el formulario para actualizar cálculos
    this.ventaForm.get('precio')?.valueChanges.subscribe(() => {
      this.updateCalculos();
    });
    this.ventaForm.get('comision_operador')?.valueChanges.subscribe(() => {
      this.updateCalculos();
    });
    this.ventaForm.get('comision_bolsa')?.valueChanges.subscribe(() => {
      this.updateCalculos();
    });
  }

  createForm(): FormGroup {
    return this.fb.group({
      id_persona: [null, Validators.required],
      precio: [100, [Validators.min(0), Validators.max(100)]],
      valor_total_recibido: [{ value: null, disabled: true }, [Validators.min(0)]],
      fecha_venta: [new Date(), Validators.required],
      liquidacion_venta: ['', Validators.required],
      comision_operador: [0, [Validators.min(0)]],
      comision_bolsa: [0, [Validators.min(0)]],
      observacion: ['']
    });
  }

  // Getters para cálculos financieros
  get inversionesSeleccionadasArray(): Inversion[] {
    return this.inversiones.filter(i => this.inversionesSeleccionadas.includes(i.id_inversion!));
  }

  parseNumber(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    return isNaN(num) ? 0 : num;
  }

  get valorNominalTotalModal(): number {
    return this.inversionesSeleccionadasArray.reduce((sum, i) => sum + this.parseNumber(i.valor_nominal), 0);
  }

  get capitalInvertidoTotalModal(): number {
    return this.inversionesSeleccionadasArray.reduce((sum, i) => sum + this.parseNumber(i.capital_invertido), 0);
  }

  get valorEfectivo(): number {
    const precio = this.ventaForm.get('precio')?.value || 0;
    return this.valorNominalTotalModal * (precio / 100);
  }

  get valorTotalRecibido(): number {
    const comisionOperador = this.ventaForm.get('comision_operador')?.value || 0;
    const comisionBolsa = this.ventaForm.get('comision_bolsa')?.value || 0;
    return this.valorEfectivo - comisionOperador - comisionBolsa;
  }

  get precioNeto(): number {
    if (this.valorNominalTotalModal === 0) return 0;
    return (this.valorTotalRecibido / this.valorNominalTotalModal) * 100;
  }

  get precioCompraPonderado(): number {
    if (this.valorNominalTotalModal === 0) return 0;
    const sumaPonderada = this.inversionesSeleccionadasArray.reduce((sum, i) => sum + (this.parseNumber(i.precio_compra) * this.parseNumber(i.valor_nominal)), 0);
    return sumaPonderada / this.valorNominalTotalModal;
  }

  get precioCompraNetoPonderado(): number {
    if (this.valorNominalTotalModal === 0) return 0;
    const sumaPonderada = this.inversionesSeleccionadasArray.reduce((sum, i) => sum + (this.parseNumber(i.precio_neto_compra) * this.parseNumber(i.valor_nominal)), 0);
    return sumaPonderada / this.valorNominalTotalModal;
  }

  get utilidadSinComision(): number {
    return this.valorEfectivo - this.capitalInvertidoTotalModal;
  }

  get utilidadConComision(): number {
    return this.valorTotalRecibido - this.capitalInvertidoTotalModal;
  }

  get gananciaPerdida(): number {
    return this.valorTotalRecibido - this.capitalInvertidoTotalModal;
  }

  get rendimientoTotal(): number {
    if (this.capitalInvertidoTotalModal === 0) return 0;
    return (this.utilidadConComision / this.capitalInvertidoTotalModal) * 100;
  }

  get roi(): number {
    if (this.capitalInvertidoTotalModal === 0) return 0;
    return (this.utilidadConComision / this.capitalInvertidoTotalModal) * 100;
  }

  get diasTranscurridos(): number {
    if (this.inversionesSeleccionadasArray.length === 0) return 0;
    const fechaVenta = this.ventaForm.get('fecha_venta')?.value;
    if (!fechaVenta) return 0;

    // Encontrar la fecha de compra más antigua
    const fechasCompra = this.inversionesSeleccionadasArray
      .map(i => new Date(i.fecha_compra))
      .filter(d => !isNaN(d.getTime()));

    if (fechasCompra.length === 0) return 0;
    const fechaCompraMin = new Date(Math.min(...fechasCompra.map(d => d.getTime())));

    const diffTime = fechaVenta.getTime() - fechaCompraMin.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  get diferencia(): number {
    return this.valorNominalTotalModal - this.capitalInvertidoTotalModal;
  }

  get gananciaAnual(): number {
    const dias = this.diasTranscurridos;
    if (dias === 0) return 0;
    return (this.roi * 365) / dias;
  }

  get utilidadEstimada(): number {
    return this.valorTotalRecibido - this.capitalInvertidoTotalModal;
  }

  // Actualizar valor_total_recibido cuando cambian los campos relevantes
  updateCalculos(): void {
    const valorTotalRecibido = this.valorTotalRecibido;
    this.ventaForm.patchValue({ valor_total_recibido: valorTotalRecibido }, { emitEvent: false });
  }

  loadInversiones(): void {
    this.loading = true;
    const idPersona = this.ventaForm.get('id_persona')?.value;

    if (idPersona) {
      // Cargar solo inversiones de la persona seleccionada
      this.inversionService.getAll({ tipo_inversion: 91 }).subscribe({
        next: (data) => {
          this.inversiones = data.filter((inv: Inversion) =>
            inv.id_propietario === idPersona &&
            inv.fecha_venta === null &&
            inv.instrumento?.id_tipo_inversion === 91 // Solo Notas de Crédito
          );
          // Inicializar el mapa de selección con TRUE por defecto (todas las notas de crédito seleccionadas)
          this.inversiones.forEach(i => {
            this.inversionSeleccionadaMap[i.id_inversion!] = true;
          });
          this.inversionesSeleccionadas = this.inversiones.map(i => i.id_inversion!);
          this.updateCalculos();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error al cargar inversiones:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar las inversiones'
          });
          this.loading = false;
        }
      });
    } else {
      // Cargar todas las inversiones disponibles (no vendidas) de tipo Notas de Crédito
      this.inversionService.getAll({ tipo_inversion: 91 }).subscribe({
        next: (data) => {
          this.inversiones = data.filter((inv: Inversion) =>
            inv.fecha_venta === null &&
            inv.instrumento?.id_tipo_inversion === 91 // Solo Notas de Crédito
          );
          // Inicializar el mapa de selección con TRUE por defecto (todas las notas de crédito seleccionadas)
          this.inversiones.forEach(i => {
            this.inversionSeleccionadaMap[i.id_inversion!] = true;
          });
          this.inversionesSeleccionadas = this.inversiones.map(i => i.id_inversion!);
          this.updateCalculos();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error al cargar inversiones:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar las inversiones'
          });
          this.loading = false;
        }
      });
    }
  }

  loadPersonas(): void {
    this.personaService.getAll().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.personas = response.data.map((p: any) => ({
            ...p,
            nombre: `${p.nombres} ${p.apellidos}`.trim()
          }));
        } else {
          this.personas = [];
        }
      },
      error: (err) => {
        console.error('Error al cargar personas:', err);
        this.personas = [];
      }
    });
  }

  formatNumeroCuenta(numero: string): string {
    if (!numero) return '';
    // Eliminar espacios existentes
    const cleanNumero = numero.replace(/\s/g, '');
    // Formatear: 105 682 8691 (grupos de 3 dígitos desde la derecha)
    if (cleanNumero.length <= 3) return cleanNumero;
    const grupos = [];
    let i = cleanNumero.length;
    while (i > 0) {
      grupos.unshift(cleanNumero.substring(Math.max(0, i - 3), i));
      i -= 3;
    }
    return grupos.join(' ');
  }

  onInversionSeleccionada(id_inversion: number, checked: boolean): void {
    // Actualizar el mapa
    this.inversionSeleccionadaMap[id_inversion] = checked;

    // Reconstruir el array a partir del mapa
    this.inversionesSeleccionadas = this.inversiones
      .filter(i => this.inversionSeleccionadaMap[i.id_inversion!])
      .map(i => i.id_inversion!);

    this.cdr.detectChanges();
    // Actualizar cálculos siempre
    this.updateCalculos();
  }

  onSeleccionarTodas(checked: boolean): void {
    // Actualizar el mapa para todas las inversiones
    this.inversiones.forEach(i => {
      this.inversionSeleccionadaMap[i.id_inversion!] = checked;
    });

    // Reconstruir el array a partir del mapa
    this.inversionesSeleccionadas = this.inversiones
      .filter(i => this.inversionSeleccionadaMap[i.id_inversion!])
      .map(i => i.id_inversion!);

    this.cdr.detectChanges();
    // Actualizar cálculos siempre
    this.updateCalculos();
  }

  abrirDialogoVenta(): void {
    if (this.inversionesSeleccionadas.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Debe seleccionar al menos una inversión'
      });
      return;
    }

    // Pre-llenar el campo de persona solo si está vacío (para mantener el estado del borrador)
    if (!this.ventaForm.get('id_persona')?.value) {
      const primeraInversion = this.inversionesSeleccionadasArray[0];
      if (primeraInversion && primeraInversion.id_propietario) {
        this.ventaForm.patchValue({ id_persona: primeraInversion.id_propietario });
      }
    }

    this.displayDialog = true;
    // Forzar detección de cambios
    this.cdr.detectChanges();
    // Actualizar cálculos al abrir el modal
    this.updateCalculos();
  }

  previsualizarVenta(): void {
    if (this.ventaForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Complete los campos requeridos'
      });
      return;
    }

    const formValue = this.ventaForm.value;

    // Validaciones
    if (this.inversionesSeleccionadas.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Debe seleccionar al menos una nota de crédito'
      });
      return;
    }

    if (!formValue.precio || formValue.precio <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El precio debe ser mayor a 0'
      });
      return;
    }

    if (this.valorNominalTotalModal <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El valor nominal total debe ser mayor a 0'
      });
      return;
    }

    if (this.capitalInvertidoTotalModal <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El capital invertido total debe ser mayor a 0'
      });
      return;
    }

    this.loadingCalculo = true;

    this.ventaService.previsualizarVentaAgrupada({
      inversiones: this.inversionesSeleccionadas,
      id_persona: formValue.id_persona,
      precio: formValue.precio,
      valor_total_recibido: this.valorTotalRecibido,
      comision_operador: formValue.comision_operador,
      comision_bolsa: formValue.comision_bolsa
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.previsualizacion = response.data;
          this.displayPrevisualizar = true;
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: response.message || 'Error al previsualizar venta'
          });
        }
        this.loadingCalculo = false;
      },
      error: (err) => {
        console.error('Error al previsualizar venta:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al previsualizar venta'
        });
        this.loadingCalculo = false;
      }
    });
  }

  confirmarVenta(): void {
    const formValue = this.ventaForm.value;

    // Validaciones adicionales
    if (this.diasTranscurridos <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Los días transcurridos deben ser mayores a 0'
      });
      return;
    }

    const request: VentaAgrupadaRequest = {
      inversiones: this.inversionesSeleccionadas,
      id_persona: formValue.id_persona,
      precio: formValue.precio,
      precio_neto: this.precioNeto,
      valor_total_recibido: this.valorTotalRecibido,
      valor_efectivo: this.valorEfectivo,
      utilidad_sin_comision: this.utilidadSinComision,
      utilidad_con_comision: this.utilidadConComision,
      ganancia_perdida: this.gananciaPerdida,
      rendimiento_total: this.rendimientoTotal,
      dias_transcurridos: this.diasTranscurridos,
      roi: this.roi,
      ganancia_anual: this.gananciaAnual,
      fecha_venta: this.formatDate(formValue.fecha_venta),
      liquidacion_venta: formValue.liquidacion_venta,
      comision_operador: formValue.comision_operador,
      comision_bolsa: formValue.comision_bolsa,
      observacion: formValue.observacion
    };

    this.loadingCalculo = true;

    this.ventaService.crearVentaAgrupada(request).subscribe({
      next: (response) => {
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Venta agrupada registrada exitosamente'
          });
          this.displayDialog = false;
          this.displayPrevisualizar = false;
          this.ventaForm.reset();
          this.inversionesSeleccionadas = [];
          this.loadInversiones(); // Recargar inversiones
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: response.message || 'Error al registrar venta'
          });
        }
        this.loadingCalculo = false;
      },
      error: (err) => {
        console.error('Error al registrar venta:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al registrar venta'
        });
        this.loadingCalculo = false;
      }
    });
  }

  cancelarVenta(): void {
    this.displayDialog = false;
    this.displayPrevisualizar = false;
    // No resetear el formulario para mantener el estado del borrador
  }

  getNombrePersona(idPersona: number | null): string {
    if (!idPersona) return '-';
    const persona = this.personas.find(p => p.id_persona === idPersona);
    return persona ? persona.nombre : '-';
  }

  getNombrePropietarioOrigen(): string {
    if (!this.previsualizacion?.inversiones_reasignar || this.previsualizacion.inversiones_reasignar.length === 0) {
      return '-';
    }
    // Obtener todos los propietarios únicos que serán reasignados
    const propietariosUnicos = new Set<number>(
      this.previsualizacion.inversiones_reasignar
        .map((inv: any) => inv.id_propietario_anterior)
        .filter((id: number) => id)
    );

    // Obtener nombres de los propietarios
    const nombres = Array.from(propietariosUnicos)
      .map((id: number) => this.getNombrePersona(id))
      .filter((nombre: string) => nombre !== '-')
      .join(', ');

    return nombres || '-';
  }

  getCapitalReasignar(): number {
    if (!this.previsualizacion?.inversiones_reasignar || this.previsualizacion.inversiones_reasignar.length === 0) {
      return 0;
    }
    return this.previsualizacion.inversiones_reasignar.reduce((sum: number, inv: any) => {
      // El campo correcto es valor_compra (viene como string, convertir a número)
      const capital = this.parseNumber(inv.valor_compra);
      return sum + capital;
    }, 0);
  }

  getReasignacionPorPropietario(): any[] {
    if (!this.previsualizacion?.inversiones_reasignar || this.previsualizacion.inversiones_reasignar.length === 0) {
      return [];
    }

    // Agrupar por propietario origen
    const agrupado = this.previsualizacion.inversiones_reasignar.reduce((acc: any, inv: any) => {
      const idPropietario = inv.id_propietario_anterior;
      if (!acc[idPropietario]) {
        acc[idPropietario] = {
          id_propietario: idPropietario,
          nombre: this.getNombrePersona(idPropietario),
          capital_total: 0,
          nominal_total: 0,
          cantidad: 0
        };
      }
      acc[idPropietario].capital_total += this.parseNumber(inv.valor_compra);
      acc[idPropietario].nominal_total += this.parseNumber(inv.valor_nominal);
      acc[idPropietario].cantidad += 1;
      return acc;
    }, {});

    return Object.values(agrupado);
  }

  getTotalValorNominal(): number {
    if (!this.previsualizacion?.detalles_distribucion) return 0;
    return this.previsualizacion.detalles_distribucion.reduce((sum: number, det: any) => {
      return sum + this.parseNumber(det.valor_nominal);
    }, 0);
  }

  getTotalCapitalInvertido(): number {
    if (!this.previsualizacion?.detalles_distribucion) return 0;
    return this.previsualizacion.detalles_distribucion.reduce((sum: number, det: any) => {
      return sum + this.parseNumber(det.valor_compra);
    }, 0);
  }

  getTotalValorVenta(): number {
    if (!this.previsualizacion?.detalles_distribucion) return 0;
    return this.previsualizacion.detalles_distribucion.reduce((sum: number, det: any) => {
      return sum + this.parseNumber(det.valor_venta_asignado);
    }, 0);
  }

  getTotalUtilidad(): number {
    if (!this.previsualizacion?.detalles_distribucion) return 0;
    return this.previsualizacion.detalles_distribucion.reduce((sum: number, det: any) => {
      return sum + this.parseNumber(det.utilidad);
    }, 0);
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateDisplay(dateString: string): string {
    if (!dateString) return '-';
    // Extraer solo la parte de la fecha (YYYY-MM-DD) sin timezone
    const datePart = dateString.split('T')[0];
    if (!datePart) return '-';
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  }

  formatCurrency(value: number): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '$0.00';
    }
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }

  formatPercent(value: number): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00%';
    }
    return `${value.toFixed(2)}%`;
  }

  formatPrecio6Decimales(value: any): string {
    if (value === null || value === undefined || isNaN(this.parseNumber(value))) {
      return '0.000000';
    }
    return Number(value).toFixed(6);
  }

  get inversionesSeleccionadasCount(): number {
    return this.inversionesSeleccionadas.length;
  }

  get valorNominalTotal(): number {
    return this.inversiones
      .filter(i => this.inversionesSeleccionadas.includes(i.id_inversion!))
      .reduce((sum, i) => {
        const valor = typeof i.valor_nominal === 'string'
          ? parseFloat(i.valor_nominal)
          : (i.valor_nominal || 0);
        return sum + (isNaN(valor) ? 0 : valor);
      }, 0);
  }

  get valorCompraTotal(): number {
    return this.inversiones
      .filter(i => this.inversionesSeleccionadas.includes(i.id_inversion!))
      .reduce((sum, i) => {
        const valor = typeof i.capital_invertido === 'string'
          ? parseFloat(i.capital_invertido)
          : (i.capital_invertido || 0);
        return sum + (isNaN(valor) ? 0 : valor);
      }, 0);
  }

  get todasInversionesSeleccionadas(): boolean {
    return this.inversiones.length > 0 &&
      this.inversiones.every(i => this.inversionesSeleccionadas.includes(i.id_inversion!));
  }

  abrirModalIA(): void {
    if (this.inversionesSeleccionadasCount === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Seleccione al menos una nota de crédito para generar el resumen.'
      });
      return;
    }

    this.mensajeGeneradoIA = '';
    this.contextoIA = 'Cargando datos de mercado (inversion.shares_lastdate)...';
    this.displayModalIA = true;

    // Cargar las posiciones activas del portafolio y los últimos cierres oficiales de la tabla inversion.shares_lastdate
    forkJoin({
      posicionesRes: this.accionPosicionService.getPosiciones().pipe(catchError(() => of(null))),
      cierresRes: this.resumenBolsaService.obtenerUltimoCierreAcciones().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ posicionesRes, cierresRes }: any) => {
        // Lista de cierres de la tabla inversion.shares_lastdate
        const cierresLista = (cierresRes && cierresRes.exito && cierresRes.datos) ? cierresRes.datos : [];

        // Función para emparejar de forma inteligente nombres de emisores entre portafolio y shares_lastdate
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
            const varPct = d.capital > 0 ? ((d.mercado - d.capital) / d.capital) * 100 : 0;
            const signoStr = varPct >= 0 ? '+' : '';

            // Consultar datos oficiales de inversion.shares_lastdate usando findCierreOficial
            const cierreOficial = findCierreOficial(emisorNombre);
            let diarioText = '';

            if (cierreOficial) {
              const precioUltimo = cierreOficial.precio_promedio ? parseFloat(cierreOficial.precio_promedio) : d.precio;
              if (precioUltimo > 0) d.precio = precioUltimo;

              const cambio = cierreOficial.cambio_diario !== undefined && cierreOficial.cambio_diario !== null
                ? parseFloat(cierreOficial.cambio_diario)
                : 0;
              const varDiariaPct = cierreOficial.variacion_diaria_pct !== undefined && cierreOficial.variacion_diaria_pct !== null
                ? parseFloat(cierreOficial.variacion_diaria_pct)
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

          this.contextoIA = lineas.join('\n');
        } else {
          this.contextoIA = 'Sin posiciones activas de renta variable en el portafolio.';
        }
        this.actualizarPromptIA();
      },
      error: (err) => {
        console.error('Error al cargar posiciones/cierres para IA:', err);
        this.contextoIA = 'Error al consultar inversion.shares_lastdate.';
        this.actualizarPromptIA();
      }
    });
  }

  generarMensajeIA(): void {
    if (this.inversionesSeleccionadasCount === 0) return;

    this.generandoMensaje = true;

    const nominal = this.formatCurrency(this.valorNominalTotal);
    const capital = this.formatCurrency(this.valorCompraTotal);
    const diferencia = this.formatCurrency(this.valorNominalTotal - this.valorCompraTotal);
    const dias = this.diasTranscurridos;
    const diasText = dias > 0 ? ` (con ${dias} días transcurridos)` : '';

    forkJoin({
      bromaRes: this.ventaService.getBromaDiaria(this.contextoIA, this.promptIA).pipe(catchError(() => of(null))),
      saldoRes: this.movimientoCapitalService.getSaldoEsperado().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ bromaRes, saldoRes }: any) => {
        let broma = "¡A comprar y vender se ha dicho! 🚀";
        if (bromaRes && bromaRes.success && bromaRes.data) {
          broma = bromaRes.data;
        }

        let saldoDisponibleLine = '';
        if (saldoRes) {
          const saldoVal = saldoRes.saldo_esperado !== undefined ? saldoRes.saldo_esperado : (saldoRes.data ? (saldoRes.data as any).saldo_esperado : null);
          if (saldoVal !== null && saldoVal !== undefined) {
            saldoDisponibleLine = `• 💳 *Saldo disponible para inversión:* ${this.formatCurrency(saldoVal)}\n`;
          }
        }

        this.mensajeGeneradoIA = `🌅 *¡Buenos días! Así arrancamos hoy con las Notas de Crédito:*\n` +
          `• 💰 *Nominal Total:* ${nominal}\n` +
          `• 💵 *Capital Invertido:* ${capital}\n` +
          `• 📈 *Diferencia a favor:* ${diferencia}${diasText}\n` +
          `${saldoDisponibleLine}\n` +
          `_${broma}_`;

        this.generandoMensaje = false;
        this.messageService.add({
          severity: 'info',
          summary: '¡Mensaje Generado!',
          detail: 'Puedes revisar o editar el mensaje antes de copiarlo.'
        });
      },
      error: (err: any) => {
        console.error('Error al generar resumen:', err);
        this.mensajeGeneradoIA = `🌅 *¡Buenos días! Así arrancamos hoy con las Notas de Crédito:*\n` +
          `• 💰 *Nominal Total:* ${nominal}\n` +
          `• 💵 *Capital Invertido:* ${capital}\n` +
          `• 📈 *Diferencia a favor:* ${diferencia}${diasText}\n\n` +
          `_¡A seguir moviendo esas notas en el mercado!_ 🚀`;

        this.generandoMensaje = false;
      }
    });
  }

  copiarMensajeFinalIA(): void {
    if (!this.mensajeGeneradoIA) return;

    this.copiarTextoAlPortapapeles(this.mensajeGeneradoIA).then((exito) => {
      if (exito) {
        this.messageService.add({
          severity: 'success',
          summary: '¡Copiado!',
          detail: 'El resumen diario ha sido copiado al portapapeles.'
        });
        this.displayModalIA = false;
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo copiar el texto automáticamente.'
        });
      }
    });
  }

  copiarTextoAlPortapapeles(texto: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto)
        .then(() => true)
        .catch(() => this.fallbackCopiarTexto(texto));
    } else {
      return Promise.resolve(this.fallbackCopiarTexto(texto));
    }
  }

  fallbackCopiarTexto(texto: string): boolean {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = texto;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const exito = document.execCommand('copy');
      document.body.removeChild(textArea);
      return exito;
    } catch (err) {
      console.error('Error en fallback de copiado:', err);
      return false;
    }
  }

  onPageChange(event: any): void {
    this.rowsPerPage = event.rows;
    this.paginationService.setRowsPerPage('ventaAgrupada', this.rowsPerPage);
  }

  onPageChangeModal(event: any): void {
    this.rowsPerPageModal = event.rows;
    this.paginationService.setRowsPerPage('ventaAgrupadaModal', this.rowsPerPageModal);
  }
}
