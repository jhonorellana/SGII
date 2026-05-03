import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AmortizacionGeneracionService, GeneracionParams, InversionParametros, TablaAmortizacion, CuotaAmortizacion, ApiResponse } from '../../../core/amortizacion-generacion.service';
import { InversionService } from '../../../core/inversion.service';

@Component({
  selector: 'app-amortizacion-generacion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DropdownModule,
    ToastModule,
    ConfirmDialogModule
  ],
  providers: [
    AmortizacionGeneracionService,
    InversionService,
    MessageService,
    ConfirmationService
  ],
  templateUrl: './amortizacion-generacion.component.html',
  styleUrls: ['./amortizacion-generacion.component.css']
})
export class AmortizacionGeneracionComponent implements OnInit, OnDestroy {

  generacionForm!: FormGroup;
  inversiones: any[] = [];
  parametrosInversion: InversionParametros | null = null;
  tablaPrevisualizacion: TablaAmortizacion | null = null;
  loading = false;
  submitted = false;
  showPreview = false;
  showResults = false;
  mostrarCuotasPrevias = false; // Control para mostrar/ocultar cuotas previas a la compra

  // Propiedades computadas para el template
  get inversionSeleccionada(): any {
    return this.inversiones.find(i => i.id_inversion === this.generacionForm.value?.id_inversion);
  }

  get tipoAmortizacionDisplay(): string {
    return this.generacionForm.value?.tipo_amortizacion === 'A' ? 'Alemana' : 'Francesa';
  }

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private generacionService: AmortizacionGeneracionService,
    private inversionService: InversionService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    try {
      console.log('Inicializando componente de generación de amortizaciones...');
      this.cargarInversiones();
      this.setupFormListeners();
      console.log('Componente inicializado correctamente');
    } catch (error) {
      console.error('Error en ngOnInit:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error de inicialización',
        detail: 'No se pudo inicializar el componente'
      });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private initForm(): void {
    this.generacionForm = this.fb.group({
      id_inversion: [null, Validators.required],
      frecuencia_pago: [1, [Validators.required, Validators.min(1), Validators.max(12)]],
      cuotas_diferir: [0, [Validators.required, Validators.min(0), Validators.max(12)]],
      tipo_amortizacion: ['A', Validators.required]
    });
  }

  private setupFormListeners(): void {
    const inversionSub = this.generacionForm.get('id_inversion')?.valueChanges.subscribe(idInversion => {
      if (idInversion) {
        this.cargarParametrosInversion(idInversion);
        this.showPreview = false;
        this.tablaPrevisualizacion = null;
      } else {
        this.parametrosInversion = null;
      }
    });

    if (inversionSub) {
      this.subscriptions.add(inversionSub);
    }
  }

  private cargarInversiones(): void {
    this.loading = true;
    const sub = this.inversionService.getAll().subscribe({
      next: (response: any) => {
        this.inversiones = response || [];
        this.loading = false;
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las inversiones'
        });
        this.loading = false;
      }
    });
    this.subscriptions.add(sub);
  }

  private cargarParametrosInversion(idInversion: number): void {
    this.loading = true;
    const sub = this.generacionService.getParametros(idInversion).subscribe({
      next: (response: any) => {
        this.parametrosInversion = response.data || null;
        this.loading = false;

        if (this.parametrosInversion) {
          // Establecer valores por defecto basados en la inversión
          this.actualizarValoresPorDefecto();
        }
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los parámetros de la inversión'
        });
        this.loading = false;
      }
    });
    this.subscriptions.add(sub);
  }

  getFechasRecuperacionFormateadas(): string[] {
    if (!this.parametrosInversion?.fechas_recuperacion) {
      return [];
    }

    try {
      // Separar por comas y limpiar espacios
      const fechas = this.parametrosInversion.fechas_recuperacion
        .split(',')
        .map(fecha => fecha.trim())
        .filter(fecha => fecha.length > 0);

      return fechas;
    } catch (error) {
      console.error('Error al procesar fechas de recuperación:', error);
      return [];
    }
  }

  getFechasRecuperacionCount(): number {
    return this.getFechasRecuperacionFormateadas().length;
  }

  getFrecuenciaSugerida(): string {
    if (!this.parametrosInversion) return '1';

    const tipoInstrumento = this.parametrosInversion.tipo_instrumento?.toLowerCase() || '';

    // Reglas específicas según tipo de instrumento
    if (tipoInstrumento.includes('bono') && tipoInstrumento.includes('estado')) {
      return '1'; // Mensual para Bonos del Estado
    } else if (tipoInstrumento.includes('obligacion')) {
      return '3'; // Trimestral para Obligaciones
    }

    // Reglas por defecto basadas en el plazo
    const meses = this.calcularPlazoMeses();
    if (meses <= 6) return '1'; // Mensual
    if (meses <= 12) return '1'; // Mensual
    if (meses <= 24) return '2'; // Bimensual
    if (meses <= 36) return '3'; // Trimestral
    return '6'; // Semestral
  }

  calcularPlazoMeses(): number {
    if (!this.parametrosInversion) return 0;

    try {
      const fechaEmision = new Date(this.parametrosInversion.fecha_emision);
      const fechaVencimiento = new Date(this.parametrosInversion.fecha_vencimiento);

      if (isNaN(fechaEmision.getTime()) || isNaN(fechaVencimiento.getTime())) {
        return 0;
      }

      return this.calcularMesesEntreFechas(fechaEmision, fechaVencimiento);
    } catch (error) {
      return 0;
    }
  }

  getFrecuenciaTexto(): string {
    const freq = this.generacionForm.value?.frecuencia_pago || 1;
    switch (freq) {
      case 1: return 'mes(es)';
      case 2: return 'mes(es) - Bimensual';
      case 3: return 'mes(es) - Trimestral';
      case 4: return 'mes(es) - Cuatrimestral';
      case 6: return 'mes(es) - Semestral';
      case 12: return 'mes(es) - Anual';
      default: return 'mes(es)';
    }
  }

  validarFechasInversion(): boolean {
    if (!this.parametrosInversion) return false;

    try {
      const fechaEmision = new Date(this.parametrosInversion.fecha_emision);
      const fechaVencimiento = new Date(this.parametrosInversion.fecha_vencimiento);

      return !isNaN(fechaEmision.getTime()) &&
             !isNaN(fechaVencimiento.getTime()) &&
             fechaEmision < fechaVencimiento;
    } catch (error) {
      return false;
    }
  }

  private actualizarValoresPorDefecto(): void {
    if (!this.parametrosInversion) return;

    try {
      // Resetear el filtro de cuotas previas al cargar nuevos parámetros
      this.mostrarCuotasPrevias = false;

      // Usar la misma lógica que getFrecuenciaSugerida()
      const frecuenciaSugerida = this.getFrecuenciaSugerida();

      // Aplicar la frecuencia sugerida al combo
      this.generacionForm.patchValue({
        frecuencia_pago: parseInt(frecuenciaSugerida)
      });

      console.log('Frecuencia sugerida aplicada:', frecuenciaSugerida, 'para tipo:', this.parametrosInversion.tipo_instrumento);

      // Mostrar información importante en consola para depuración
      console.log('Datos importantes para generación (desde tabla instrumento):', {
        idInversion: this.parametrosInversion.id_inversion,
        metodoAmortizacion: this.generacionForm.value.tipo_amortizacion === 'A' ? 'Alemán' : 'Francés',
        valorNominal: this.parametrosInversion.valor_nominal,
        // Fechas desde instrumento
        fechaEmision: this.parametrosInversion.fecha_emision + ' (instrumento)',
        fechaVencimiento: this.parametrosInversion.fecha_vencimiento + ' (instrumento)',
        // Datos financieros
        tasaInteres: this.parametrosInversion.tasa_interes,
        capitalInvertido: this.parametrosInversion.capital_invertido,
        valorInteres: this.parametrosInversion.valor_interes + ' (instrumento)',
        // Configuración
        frecuenciaPago: frecuenciaSugerida,
        tipoInstrumento: this.parametrosInversion.tipo_instrumento + ' (catalogo_valor.descripcion)',
        // Fechas de recuperación desde instrumento
        fechasRecuperacionRaw: this.parametrosInversion.fechas_recuperacion + ' (instrumento)',
        fechasRecuperacionProcesadas: this.getFechasRecuperacionFormateadas(),
        cantidadFechasRecuperacion: this.getFechasRecuperacionCount(),
        // Cálculos
        plazoMeses: this.calcularPlazoMeses()
      });

    } catch (error) {
      console.error('Error al actualizar valores por defecto:', error);
    }
  }

  onPrevisualizar(): void {
    if (this.generacionForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario inválido',
        detail: 'Por favor complete todos los campos requeridos'
      });
      return;
    }

    // Validar datos importantes antes de previsualizar
    if (!this.validarDatosParaGeneracion()) {
      return;
    }

    console.log('Iniciando previsualización con parámetros:', this.generacionForm.value);

    this.loading = true;
    const params = this.generacionForm.value as GeneracionParams;

    // Convertir id_inversion a número
    const paramsToSend = {
      ...params,
      id_inversion: Number(params.id_inversion),
      frecuencia_pago: Number(params.frecuencia_pago)
    };

    console.log('Parámetros corregidos para enviar:', paramsToSend);

    const sub = this.generacionService.previsualizar(paramsToSend).subscribe({
      next: (response: ApiResponse<TablaAmortizacion>) => {
        console.log('Respuesta del servidor:', response);

        this.tablaPrevisualizacion = response.data || null;
        this.showPreview = true;
        this.loading = false;

        console.log('Tabla previsualización:', this.tablaPrevisualizacion);

        this.messageService.add({
          severity: 'success',
          summary: 'Previsualización generada',
          detail: `Se generaron ${this.tablaPrevisualizacion?.cuotas.length} cuotas`
        });
      },
      error: (error: any) => {
        console.error('Error en previsualización:', error);
        console.error('Error completo:', error);

        // Intentar extraer más información del error
        let errorMessage = 'No se pudo generar la previsualización';
        if (error.error) {
          errorMessage += ': ' + error.error;
        } else if (error.message) {
          errorMessage += ': ' + error.message;
        } else if (error.status) {
          errorMessage += ': Status ' + error.status;
        }

        console.log('Mensaje de error final:', errorMessage);

        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage
        });
        this.loading = false;
      }
    });
    this.subscriptions.add(sub);
  }

  validarDatosParaGeneracion(): boolean {
    if (!this.parametrosInversion) {
      this.messageService.add({
        severity: 'error',
        summary: 'Datos incompletos',
        detail: 'No se han cargado los parámetros de la inversión'
      });
      return false;
    }

    // Validar fechas
    if (!this.validarFechasInversion()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Fechas inválidas',
        detail: 'Las fechas de emisión o vencimiento son inválidas'
      });
      return false;
    }

    // Validar fechas de recuperación
    const fechasRecuperacion = this.getFechasRecuperacionFormateadas();
    if (fechasRecuperacion.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Datos incompletos',
        detail: 'Las fechas de recuperación de capital no están especificadas. La tabla puede no ser precisa.'
      });
      // Permitir continuar pero con advertencia
    } else {
      // Validar formato de fechas de recuperación
      const fechasInvalidas = fechasRecuperacion.filter(fecha => {
        const fechaObj = new Date(fecha);
        return isNaN(fechaObj.getTime());
      });

      if (fechasInvalidas.length > 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Formato de fechas inválido',
          detail: `Hay ${fechasInvalidas.length} fechas de recuperación con formato incorrecto.`
        });
      }
    }

    return true;
  }

  onGenerar(): void {
    if (this.generacionForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario inválido',
        detail: 'Por favor complete todos los campos requeridos'
      });
      return;
    }

    // Validar datos importantes antes de generar
    if (!this.validarDatosParaGeneracion()) {
      return;
    }

    this.loading = true;
    const params = this.generacionForm.value as GeneracionParams;

    // Convertir id_inversion a número
    const paramsToSend = {
      ...params,
      id_inversion: Number(params.id_inversion),
      frecuencia_pago: Number(params.frecuencia_pago)
    };

    // Generar directamente sin verificar existencia (método verificarExistencia no implementado aún)
    this.ejecutarGeneracion(paramsToSend);
  }

  private ejecutarGeneracion(params: GeneracionParams): void {
    this.loading = true;

    const sub = this.generacionService.generar(params).subscribe({
      next: (response: ApiResponse<any>) => {
        this.loading = false;
        this.submitted = true;
        this.showResults = true;

        this.messageService.add({
          severity: 'success',
          summary: 'Tabla generada',
          detail: response.data ?
            `Se generaron ${response.data.cuotas_generadas} cuotas exitosamente` :
            'Tabla generada exitosamente'
        });
      },
      error: (error: any) => {
        this.loading = false;

        if (error.error?.error === 'TABLE_EXISTS') {
          this.messageService.add({
            severity: 'warn',
            summary: 'Tabla existente',
            detail: 'Ya existe una tabla de amortización para esta inversión'
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo generar la tabla de amortización'
          });
        }
      }
    });
    this.subscriptions.add(sub);
  }

  onEliminar(): void {
    const idInversion = this.generacionForm.value.id_inversion;

    if (!idInversion) {
      return;
    }

    this.confirmationService.confirm({
      message: '¿Está seguro de eliminar la tabla de amortización existente? Esta acción no se puede deshacer.',
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.ejecutarEliminacion(idInversion);
      }
    });
  }

  private ejecutarEliminacion(idInversion: number): void {
    this.loading = true;

    const sub = this.generacionService.eliminar(idInversion).subscribe({
      next: (response: ApiResponse<any>) => {
        this.loading = false;
        this.submitted = false;
        this.showResults = false;
        this.tablaPrevisualizacion = null;
        this.showPreview = false;

        this.messageService.add({
          severity: 'success',
          summary: 'Tabla eliminada',
          detail: response.message || 'Tabla eliminada exitosamente'
        });
      },
      error: (error: any) => {
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar la tabla'
        });
      }
    });
    this.subscriptions.add(sub);
  }

  onLimpiar(): void {
    this.generacionForm.reset();
    this.generacionForm.patchValue({
      frecuencia_pago: 1,
      cuotas_diferir: 0,
      tipo_amortizacion: 'A'
    });

    this.parametrosInversion = null;
    this.tablaPrevisualizacion = null;
    this.showPreview = false;
    this.showResults = false;
    this.mostrarCuotasPrevias = false; // Resetear filtro de cuotas previas
    this.submitted = false;
  }

  // Métodos de utilidad
  getInversionDisplay(inversion: any): string {
    if (!inversion) return '';

    const codigo = inversion.id_inversion || '';
    const liquidacion = inversion.liquidacion || 'Sin liquidación';
    const tipoInstrumento = inversion.instrumento?.tipoInversion?.descripcion ||
                           inversion.instrumento?.tipoInversion?.nombre ||
                           inversion.tipo_instrumento || 'Sin tipo';

    // Fechas desde instrumento
    const fechaCompra = inversion.fecha_compra ? this.formatDate(inversion.fecha_compra) : 'Sin fecha';
    const fechaVencimiento = inversion.instrumento?.fecha_vencimiento ?
                             this.formatDate(inversion.instrumento.fecha_vencimiento) :
                             'Sin vencimiento';

    // Formato: "Compra: YYYY-MM-DD - Vencimiento: YYYY-MM-DD"
    const fechas = fechaCompra !== 'Sin fecha' && fechaVencimiento !== 'Sin vencimiento'
      ? `Compra: ${fechaCompra} - Vencimiento: ${fechaVencimiento}`
      : `${fechaCompra} ${fechaVencimiento}`;

    return `${codigo} - ${liquidacion} - ${tipoInstrumento} - ${fechas}`;
  }

  // Filtrar cuotas según fecha de compra
  getCuotasFiltradas(): any[] {
    if (!this.tablaPrevisualizacion || !this.tablaPrevisualizacion.cuotas) {
      return [];
    }

    // Si se muestran todas las cuotas, devolver todo
    if (this.mostrarCuotasPrevias) {
      return this.tablaPrevisualizacion.cuotas;
    }

    // Filtrar cuotas con fecha >= fecha de compra
    const fechaCompra = this.parametrosInversion?.fecha_compra;
    if (!fechaCompra) {
      return this.tablaPrevisualizacion.cuotas; // Si no hay fecha de compra, mostrar todo
    }

    return this.tablaPrevisualizacion.cuotas.filter(cuota => {
      return new Date(cuota.fecha_pago) >= new Date(fechaCompra);
    });
  }

  // Obtener cuotas previas (antes de la fecha de compra)
  getCuotasPrevias(): any[] {
    if (!this.tablaPrevisualizacion || !this.tablaPrevisualizacion.cuotas || !this.parametrosInversion?.fecha_compra) {
      return [];
    }

    const fechaCompra = this.parametrosInversion.fecha_compra;
    if (!fechaCompra) {
      return [];
    }

    return this.tablaPrevisualizacion.cuotas.filter(cuota => {
      return new Date(cuota.fecha_pago) < new Date(fechaCompra);
    });
  }

  // Toggle para mostrar/ocultar cuotas previas
  toggleCuotasPrevias(): void {
    this.mostrarCuotasPrevias = !this.mostrarCuotasPrevias;
  }

  // Verificar si hay cuotas con interés acumulado previo
  tieneCuotasConInteresAcumulado(): boolean {
    if (!this.tablaPrevisualizacion || !this.tablaPrevisualizacion.cuotas) {
      return false;
    }
    return this.tablaPrevisualizacion.cuotas.some(cuota => cuota.tiene_interes_acumulado_previo);
  }

  getTipoAmortizacionDisplay(tipo: string): string {
    return tipo === 'A' ? 'Alemana' : 'Francesa';
  }

  formatCurrency(value: number): string {
    return this.generacionService.formatCurrency(value);
  }

  formatDate(date: string): string {
    return this.generacionService.formatDate(date);
  }

  private calcularMesesEntreFechas(fechaInicio: Date, fechaFin: Date): number {
    const años = fechaFin.getFullYear() - fechaInicio.getFullYear();
    const meses = fechaFin.getMonth() - fechaInicio.getMonth();
    return años * 12 + meses;
  }

  // Getters para validación de formulario
  get f() {
    return this.generacionForm.controls;
  }

  get frecuenciaPagoControl(): FormControl {
    return this.generacionForm.get('frecuencia_pago') as FormControl;
  }

  get cuotasDiferirControl(): FormControl {
    return this.generacionForm.get('cuotas_diferir') as FormControl;
  }

  get tipoAmortizacionControl(): FormControl {
    return this.generacionForm.get('tipo_amortizacion') as FormControl;
  }
}
