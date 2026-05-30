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

  ventaForm: FormGroup;
  previsualizacion: any = null;
  @ViewChild('dt') table!: Table;

  constructor(
    private fb: FormBuilder,
    private inversionService: InversionService,
    private ventaService: VentaInversionService,
    private personaService: PersonaService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {
    this.ventaForm = this.createForm();
  }

  ngOnInit(): void {
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
      valor_total_recibido: [{value: null, disabled: true}, [Validators.min(0)]],
      fecha_venta: [new Date(), Validators.required],
      liquidacion_venta: [''],
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
      this.inversionService.getAll().subscribe({
        next: (data) => {
          this.inversiones = data.filter((inv: Inversion) =>
            inv.id_propietario === idPersona &&
            inv.fecha_venta === null &&
            inv.instrumento?.id_tipo_inversion === 91 // Solo Notas de Crédito
          );
          // Inicializar el mapa de selección
          this.inversiones.forEach(i => {
            this.inversionSeleccionadaMap[i.id_inversion!] = false;
          });
          // Limpiar selecciones anteriores
          this.inversionesSeleccionadas = [];
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
      this.inversionService.getAll().subscribe({
        next: (data) => {
          this.inversiones = data.filter((inv: Inversion) =>
            inv.fecha_venta === null &&
            inv.instrumento?.id_tipo_inversion === 91 // Solo Notas de Crédito
          );
          // Inicializar el mapa de selección
          this.inversiones.forEach(i => {
            this.inversionSeleccionadaMap[i.id_inversion!] = false;
          });
          // Limpiar selecciones anteriores
          this.inversionesSeleccionadas = [];
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

    // Pre-llenar el campo de persona con el propietario de las inversiones seleccionadas
    const primeraInversion = this.inversionesSeleccionadasArray[0];
    if (primeraInversion && primeraInversion.id_propietario) {
      this.ventaForm.patchValue({ id_persona: primeraInversion.id_propietario });
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
    this.ventaForm.reset();
  }

  getNombrePersona(idPersona: number | null): string {
    if (!idPersona) return '-';
    const persona = this.personas.find(p => p.id_persona === idPersona);
    return persona ? persona.nombre : '-';
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
}
