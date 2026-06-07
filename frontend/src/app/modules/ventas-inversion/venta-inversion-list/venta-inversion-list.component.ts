import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule, Table } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { AccordionModule } from 'primeng/accordion';
import { ConfirmationService, MessageService } from 'primeng/api';
import { VentaInversionService, VentaInversion } from '../../../core/venta-inversion.service';
import { InversionService, Inversion } from '../../../core/inversion.service';
import { CatalogoService } from '../../../core/catalogo.service';
import { PaginationService } from '../../../core/pagination.service';
import { ModalActionsComponent } from '../../../core/modal-actions';

interface CatalogoValor {
  id_catalogo_valor: number;
  nombre: string;
  codigo: string;
}

@Component({
  selector: 'app-venta-inversion-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TableModule,
    InputTextModule,
    DropdownModule,
    ButtonModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    CalendarModule,
    TooltipModule,
    AutoCompleteModule,
    AccordionModule,
    ModalActionsComponent
  ],
  templateUrl: './venta-inversion-list.component.html',
  styleUrl: './venta-inversion-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class VentaInversionListComponent implements OnInit {
  ventas: VentaInversion[] = [];
  inversiones: Inversion[] = [];
  posicionesVendibles: any[] = [];
  posicionesFiltradas: any[] = [];
  selectedPosicion: any = null;
  selectedInstrumentoInfo: any = null;
  selectedPropietarioInfo: any = null;
  inversionesAsociadas: any[] = [];
  resumenInversiones: any = null;
  inversionesAccordionOpen: boolean = false;
  tiposVenta: CatalogoValor[] = [];
  loading = false;
  error = '';
  @ViewChild('dt') dt: Table | undefined;
  totalRecords: number = 0;

  // Selector de posición
  displaySelectorPosicion: boolean = false;
  posicionSeleccionada: any = null;
  loadingPosiciones: boolean = false;
  filtroGlobalPosicion: string = '';
  filtroPropietario: string = '';
  filtroTipoInversion: string = '';
  filtroEmisor: string = '';
  filtroVencimiento: string = '';
  propietariosUnicos: string[] = [];
  tiposInversionUnicos: string[] = [];
  emisoresUnicos: string[] = [];

  // Pagination
  rowsPerPage: number = 10;

  // Modal properties
  displayDialog: boolean = false;
  displayDetailDialog: boolean = false;
  isEdit: boolean = false;
  ventaId: number | null = null;
  ventaForm: FormGroup;
  formLoading: boolean = false;
  formError: string = '';
  selectedVenta: VentaInversion | null = null;
  private isCalculating = false;

  constructor(
    private ventaService: VentaInversionService,
    private inversionService: InversionService,
    private catalogoService: CatalogoService,
    private fb: FormBuilder,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private paginationService: PaginationService,
    private router: Router
  ) {
    // Crear el formulario en el constructor para que siempre exista en el DOM
    this.ventaForm = this.createForm();
    this.setupFormSubscribers();
  }

  ngOnInit(): void {
    this.rowsPerPage = this.paginationService.getRowsPerPage('ventasInversion', 10);
    this.loadVentas();
    this.loadInversiones();
    this.loadPosicionesVendibles();
    this.loadTiposVenta();
  }

  createForm(): FormGroup {
    return this.fb.group({
      id_instrumento: [null, Validators.required],
      tipo_venta: ['TOTAL', Validators.required],
      porcentaje_vendido: [100, Validators.required],
      valor_nominal_vendido: [0, Validators.required],
      fecha_venta: [null, Validators.required],
      liquidacion_venta: ['', Validators.required],
      precio_venta: [null, Validators.required],
      precio_neto_venta: [null],
      interes_previo_venta: [0, Validators.required],
      valor_venta_sin_comision: [null],
      comision_operador: [0, Validators.required],
      comision_bolsa: [0, Validators.required],
      retenciones: [0, Validators.required],
      valor_venta_con_comision: [null],
      total_vendedor_neto: [null],
      observacion: ['']
    });
  }

  get f() {
    return this.ventaForm.controls;
  }

  loadVentas(): void {
    this.loading = true;
    this.error = '';

    this.ventaService.getAll({}).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.ventas = response.data.map(venta => ({
            ...venta,
            inversionDisplay: this.formatInversionDisplay(venta),
            instrumentoDisplay: this.formatInstrumentoDisplay(venta)
          }));
          this.totalRecords = response.data.length;
        } else {
          this.error = response.message || 'Error al cargar ventas';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar ventas';
        this.loading = false;
      }
    });
  }

  loadInversiones(): void {
    this.inversionService.getAll().subscribe({
      next: (inversiones: Inversion[]) => {
        this.inversiones = inversiones;
      },
      error: (err) => {
        console.error('Error al cargar inversiones:', err);
      }
    });
  }

  loadPosicionesVendibles(): void {
    this.ventaService.getPosicionesVendibles().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.posicionesVendibles = response.data;
          this.posicionesFiltradas = [...response.data];
          this.extraerValoresUnicos();
        }
      },
      error: (err) => {
        console.error('Error al cargar posiciones vendibles:', err);
      }
    });
  }

  extraerValoresUnicos(): void {
    const propietarios = new Set<string>();
    const tiposInversion = new Set<string>();
    const emisores = new Set<string>();

    this.posicionesVendibles.forEach(pos => {
      if (pos.nombre_propietario) propietarios.add(pos.nombre_propietario);
      if (pos.nombre_tipo_inversion) tiposInversion.add(pos.nombre_tipo_inversion);
      if (pos.nombre_emisor) emisores.add(pos.nombre_emisor);
    });

    this.propietariosUnicos = Array.from(propietarios).sort();
    this.tiposInversionUnicos = Array.from(tiposInversion).sort();
    this.emisoresUnicos = Array.from(emisores).sort();
  }

  abrirSelectorPosicion(): void {
    this.displaySelectorPosicion = true;
    this.posicionSeleccionada = null;
    this.filtroGlobalPosicion = '';
    this.filtroPropietario = '';
    this.filtroTipoInversion = '';
    this.filtroEmisor = '';
    this.filtroVencimiento = '';
    this.filtrarPosiciones();
  }

  cerrarSelectorPosicion(): void {
    this.displaySelectorPosicion = false;
    this.posicionSeleccionada = null;
  }

  filtrarPosiciones(): void {
    this.posicionesFiltradas = this.posicionesVendibles.filter(posicion => {
      // Filtro global
      if (this.filtroGlobalPosicion) {
        const query = this.filtroGlobalPosicion.toLowerCase();
        const propietario = (posicion.nombre_propietario || '').toLowerCase();
        const idInstrumento = String(posicion.id_instrumento).toLowerCase();
        const nombreInstrumento = (posicion.nombre_instrumento || '').toLowerCase();
        const tipoInversion = (posicion.nombre_tipo_inversion || '').toLowerCase();
        const emisor = (posicion.nombre_emisor || '').toLowerCase();
        const fechaVencimiento = (posicion.fecha_vencimiento || '').toLowerCase();
        const liquidaciones = (posicion.liquidaciones || '').toLowerCase();

        if (!propietario.includes(query) &&
            !idInstrumento.includes(query) &&
            !nombreInstrumento.includes(query) &&
            !tipoInversion.includes(query) &&
            !emisor.includes(query) &&
            !fechaVencimiento.includes(query) &&
            !liquidaciones.includes(query)) {
          return false;
        }
      }

      // Filtro por propietario
      if (this.filtroPropietario && posicion.nombre_propietario !== this.filtroPropietario) {
        return false;
      }

      // Filtro por tipo de inversión
      if (this.filtroTipoInversion && posicion.nombre_tipo_inversion !== this.filtroTipoInversion) {
        return false;
      }

      // Filtro por emisor
      if (this.filtroEmisor && posicion.nombre_emisor !== this.filtroEmisor) {
        return false;
      }

      // Filtro por vencimiento
      if (this.filtroVencimiento) {
        const query = this.filtroVencimiento.toLowerCase();
        const vencimiento = this.formatDate(posicion.fecha_vencimiento).toLowerCase();
        if (!vencimiento.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }

  limpiarFiltrosPosicion(): void {
    this.filtroGlobalPosicion = '';
    this.filtroPropietario = '';
    this.filtroTipoInversion = '';
    this.filtroEmisor = '';
    this.filtroVencimiento = '';
    this.filtrarPosiciones();
  }

  confirmarSeleccionPosicion(): void {
    if (this.posicionSeleccionada) {
      this.selectedPosicion = this.posicionSeleccionada;
      this.ventaForm.patchValue({
        id_instrumento: this.posicionSeleccionada.id_instrumento
      });
      this.inversionesAccordionOpen = true;
      this.loadPosicionInfo(this.posicionSeleccionada.id_instrumento, this.posicionSeleccionada.id_propietario);
      this.cerrarSelectorPosicion();
    }
  }

  formatPosicionLabel(posicion: any): string {
    if (!posicion) return '';
    return `${posicion.nombre_propietario} | ${posicion.id_instrumento} - ${posicion.nombre_instrumento} | Valor Nominal: ${this.formatCurrency(posicion.valor_nominal_total)}`;
  }

  onPosicionSelect(event: any): void {
    const posicion = event.value;
    if (posicion) {
      // Actualizar el formulario con el ID del instrumento seleccionado
      this.ventaForm.patchValue({
        id_instrumento: posicion.id_instrumento
      });
      // Abrir el acordeón automáticamente
      this.inversionesAccordionOpen = true;
      // Cargar información relacionada del instrumento y propietario
      this.loadPosicionInfo(posicion.id_instrumento, posicion.id_propietario);
    }
  }

  loadPosicionInfo(idInstrumento: number, idPropietario: number): void {
    this.ventaService.getInfoPosicion(idInstrumento, idPropietario).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data as any;
          this.selectedInstrumentoInfo = data.instrumento;
          this.selectedPropietarioInfo = data.propietario;
          this.inversionesAsociadas = data.instrumento?.inversiones || [];
          this.resumenInversiones = data.resumen;
          console.log('Info posición:', response.data);

          // Trigger calculations after loading position info
          if (this.ventaForm.get('tipo_venta')?.value === 'TOTAL') {
            this.ventaForm.patchValue({
              porcentaje_vendido: 100,
              valor_nominal_vendido: this.resumenInversiones?.valor_nominal_acumulado || 0
            }, { emitEvent: false });
          } else {
            const pct = this.ventaForm.get('porcentaje_vendido')?.value || 0;
            const nominalVendido = (this.resumenInversiones?.valor_nominal_acumulado || 0) * (pct / 100);
            this.ventaForm.patchValue({
              valor_nominal_vendido: parseFloat(nominalVendido.toFixed(2))
            }, { emitEvent: false });
          }
          this.calculateFormValues();
        }
      },
      error: (err) => {
        console.error('Error al cargar información de la posición:', err);
        this.selectedInstrumentoInfo = null;
        this.selectedPropietarioInfo = null;
        this.inversionesAsociadas = [];
        this.resumenInversiones = null;
      }
    });
  }

  clearInstrumentoInfo(): void {
    this.selectedInstrumentoInfo = null;
    this.selectedPropietarioInfo = null;
    this.inversionesAsociadas = [];
    this.resumenInversiones = null;
  }

  getEstadoClass(codigo: string): string {
    switch (codigo) {
      case 'ACTIVA':
        return 'bg-success';
      case 'VENDIDA_TOTAL':
        return 'bg-danger';
      case 'VENCIDA':
        return 'bg-warning';
      case 'CANCELADA':
        return 'bg-secondary';
      default:
        return 'bg-info';
    }
  }

  getAccordionHeader(): string {
    if (!this.resumenInversiones) {
      return 'Inversiones asociadas';
    }
    const cantidad = this.resumenInversiones.cantidad_inversiones || 0;
    const valorNominal = this.formatCurrency(this.resumenInversiones.valor_nominal_acumulado || 0);
    return `Inversiones asociadas (${cantidad} inversiones | Valor nominal acumulado: ${valorNominal})`;
  }

  loadTiposVenta(): void {
    // Comentado temporalmente - el método correcto debe verificarse en CatalogoService
    // this.catalogoService.getCatalogo('tipo_venta').subscribe({
    //   next: (response: any) => {
    //     if (response.success && response.data) {
    //       this.tiposVenta = response.data;
    //     }
    //   },
    //   error: (err: any) => {
    //     console.error('Error al cargar tipos de venta:', err);
    //   }
    // });
  }

  formatDate(date: Date | string | null): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }

  formatPrecioVenta(value: number | null | undefined): string {
    if (value === null || value === undefined) return '0.00%';
    // El precio venta representa el porcentaje de negociación
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value / 100);
  }

  formatInversionDisplay(venta: VentaInversion): string {
    if (!venta.inversion) {
      return `ID ${venta.id_inversion || 'N/A'}`;
    }
    const inversion = venta.inversion;
    const liquidacion = inversion.liquidacion || 'N/A';
    const instrumento = inversion.instrumento?.nombre || inversion.id_instrumento || 'N/A';
    return `ID ${venta.id_inversion} - Liquidación ${liquidacion} - ${instrumento}`;
  }

  formatInstrumentoDisplay(venta: VentaInversion): string {
    if (!venta.instrumento) {
      return `ID ${venta.id_instrumento || 'N/A'}`;
    }
    const instrumento = venta.instrumento;
    const id = venta.id_instrumento || 'N/A';
    const nombre = instrumento.nombre || instrumento.descripcion || 'N/A';
    return `${id} - ${nombre}`;
  }

  formatPercentage(value: number | null | undefined): string {
    if (value === null || value === undefined) return '0.00%';
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value / 100);
  }

  // Métodos para calcular totales de los detalles
  getTotalValorNominal(): number {
    if (!this.selectedVenta?.detalles || this.selectedVenta.detalles.length === 0) return 0;
    return this.selectedVenta.detalles.reduce((sum, d) => {
      const val = parseFloat(d.valor_nominal as any) || 0;
      return sum + val;
    }, 0);
  }

  getTotalValorCompra(): number {
    if (!this.selectedVenta?.detalles || this.selectedVenta.detalles.length === 0) return 0;
    return this.selectedVenta.detalles.reduce((sum, d) => {
      const val = parseFloat(d.valor_compra as any) || 0;
      return sum + val;
    }, 0);
  }

  getTotalMontoVendido(): number {
    if (!this.selectedVenta?.detalles || this.selectedVenta.detalles.length === 0) return 0;
    return this.selectedVenta.detalles.reduce((sum, d) => {
      const val = parseFloat(d.valor_venta_asignado as any) || 0;
      return sum + val;
    }, 0);
  }

  getTotalUtilidad(): number {
    if (!this.selectedVenta?.detalles || this.selectedVenta.detalles.length === 0) return 0;
    return this.selectedVenta.detalles.reduce((sum, d) => {
      const val = parseFloat(d.utilidad as any) || 0;
      return sum + val;
    }, 0);
  }

  async viewDetail(venta: VentaInversion): Promise<void> {
    this.selectedVenta = venta;

    // Cargar los detalles de la venta si no están cargados
    if (!venta.detalles || venta.detalles.length === 0) {
      try {
        const response = await this.ventaService.getById(venta.id_venta_inversion!).toPromise();
        if (response && response.data) {
          this.selectedVenta = response.data;
        }
      } catch (error) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los detalles de la venta'
        });
        return;
      }
    }

    this.displayDetailDialog = true;
  }

  createVenta(): void {
    this.isEdit = false;
    this.ventaId = null;
    this.ventaForm.reset();
    this.selectedPosicion = null;
    this.clearInstrumentoInfo();
    this.inversionesAccordionOpen = false;
    // Establecer fecha actual por defecto
    const today = new Date();
    this.ventaForm.patchValue({
      fecha_venta: this.formatDate(today),
      tipo_venta: 'TOTAL',
      retenciones: 0
    });
    this.displayDialog = true;
    this.formError = '';
  }

  hideDialog(): void {
    this.displayDialog = false;
    this.ventaForm.reset();
    this.selectedPosicion = null;
    this.formError = '';
  }

  editVenta(venta: VentaInversion): void {
    this.isEdit = true;
    this.ventaId = venta.id_venta_inversion || null;
    this.ventaForm.reset();
    this.selectedPosicion = null;

    // Buscar la posición en la lista (si existe)
    const posicion = this.posicionesVendibles.find(p => p.id_instrumento === venta.id_instrumento && p.id_propietario === venta.id_propietario);
    if (posicion) {
      this.selectedPosicion = posicion;
      this.loadPosicionInfo(posicion.id_instrumento, posicion.id_propietario);
    }

    this.ventaForm.patchValue({
      id_instrumento: venta.id_instrumento,
      tipo_venta: venta.id_tipo_venta === 1 ? 'TOTAL' : 'PARCIAL',
      porcentaje_vendido: venta.porcentaje_vendido,
      valor_nominal_vendido: 0,
      fecha_venta: this.formatDate(venta.fecha_venta),
      liquidacion_venta: venta.liquidacion_venta,
      precio_venta: venta.precio_venta,
      precio_neto_venta: venta.precio_neto_venta,
      interes_previo_venta: venta.interes_previo_venta !== null && venta.interes_previo_venta !== undefined ? venta.interes_previo_venta : 0,
      valor_venta_sin_comision: venta.valor_venta_sin_comision,
      comision_operador: venta.comision_operador !== null && venta.comision_operador !== undefined ? venta.comision_operador : 0,
      comision_bolsa: venta.comision_bolsa !== null && venta.comision_bolsa !== undefined ? venta.comision_bolsa : 0,
      retenciones: venta.retenciones !== null && venta.retenciones !== undefined ? venta.retenciones : 0,
      valor_venta_con_comision: venta.valor_venta_con_comision,
      total_vendedor_neto: 0,
      observacion: venta.observacion
    });
    this.displayDialog = true;
    this.formError = '';
  }

  save(): void {
    // Validar posición seleccionada
    if (!this.selectedPosicion) {
      this.ventaForm.get('id_instrumento')?.markAsDirty();
      this.ventaForm.get('id_instrumento')?.setErrors({ required: true });
      return;
    }

    // Validar que existan inversiones asociadas
    if (this.inversionesAsociadas.length === 0) {
      this.formError = 'No existen inversiones activas para este instrumento. No se puede realizar la venta.';
      return;
    }

    if (this.ventaForm.invalid) {
      this.markFormAsDirty();
      return;
    }

    this.formLoading = true;
    this.formError = '';

    const ventaData = {
      ...this.ventaForm.value,
      id_instrumento: this.selectedPosicion.id_instrumento,
      id_propietario: this.selectedPosicion.id_propietario
    };

    if (this.isEdit && this.ventaId) {
      this.ventaService.update(this.ventaId, ventaData).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Venta actualizada correctamente'
            });
            this.hideDialog();
            this.loadVentas();
          } else {
            this.formError = response.message || 'Error al actualizar venta';
          }
          this.formLoading = false;
        },
        error: (err) => {
          this.formError = 'Error al actualizar venta';
          this.formLoading = false;
        }
      });
    } else {
      this.ventaService.create(ventaData).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Venta creada correctamente'
            });
            this.hideDialog();
            this.loadVentas();
          } else {
            this.formError = response.message || 'Error al crear venta';
          }
          this.formLoading = false;
        },
        error: (err) => {
          this.formError = 'Error al crear venta';
          this.formLoading = false;
        }
      });
    }
  }

  private markFormAsDirty(): void {
    Object.keys(this.ventaForm.controls).forEach(key => {
      this.ventaForm.get(key)?.markAsDirty();
    });
  }

  deleteVenta(venta: VentaInversion): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de eliminar la venta ${venta.id_venta_inversion}?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.ventaService.delete(venta.id_venta_inversion!).subscribe({
          next: (response) => {
            if (response.success) {
              this.messageService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Venta eliminada correctamente'
              });
              this.loadVentas();
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: response.message || 'Error al eliminar venta'
              });
            }
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al eliminar venta'
            });
          }
        });
      }
    });
  }

  setupFormSubscribers(): void {
    // 1. Listen to tipo_venta changes
    this.ventaForm.get('tipo_venta')?.valueChanges.subscribe(tipo => {
      if (this.isCalculating) return;
      this.isCalculating = true;
      try {
        const nominalTotal = this.resumenInversiones?.valor_nominal_acumulado || 0;
        if (tipo === 'TOTAL') {
          this.ventaForm.patchValue({
            porcentaje_vendido: 100,
            valor_nominal_vendido: nominalTotal
          }, { emitEvent: false });
        } else {
          this.ventaForm.patchValue({
            porcentaje_vendido: 0,
            valor_nominal_vendido: 0
          }, { emitEvent: false });
        }
      } finally {
        this.isCalculating = false;
      }
      setTimeout(() => this.calculateFormValues());
    });

    // 2. Listen to porcentaje_vendido changes (bidirectional sync)
    this.ventaForm.get('porcentaje_vendido')?.valueChanges.subscribe(pct => {
      if (this.isCalculating) return;
      this.isCalculating = true;
      try {
        const nominalTotal = this.resumenInversiones?.valor_nominal_acumulado || 0;
        const nominalVendido = (nominalTotal * (pct || 0)) / 100;
        this.ventaForm.patchValue({
          valor_nominal_vendido: parseFloat(nominalVendido.toFixed(2))
        }, { emitEvent: false });
      } finally {
        this.isCalculating = false;
      }
      setTimeout(() => this.calculateFormValues());
    });

    // 3. Listen to valor_nominal_vendido changes (bidirectional sync)
    this.ventaForm.get('valor_nominal_vendido')?.valueChanges.subscribe(nominal => {
      if (this.isCalculating) return;
      this.isCalculating = true;
      try {
        const nominalTotal = this.resumenInversiones?.valor_nominal_acumulado || 0;
        const pct = nominalTotal > 0 ? ((nominal || 0) / nominalTotal) * 100 : 0;
        this.ventaForm.patchValue({
          porcentaje_vendido: parseFloat(pct.toFixed(4))
        }, { emitEvent: false });
      } finally {
        this.isCalculating = false;
      }
      setTimeout(() => this.calculateFormValues());
    });

    // 4. Listen to other fields to recalculate formulas
    const fieldNames = ['precio_venta', 'interes_previo_venta', 'comision_operador', 'comision_bolsa'];
    fieldNames.forEach(field => {
      this.ventaForm.get(field)?.valueChanges.subscribe(() => {
        setTimeout(() => this.calculateFormValues());
      });
    });
  }

  calculateFormValues(): void {
    if (this.isCalculating) return;
    this.isCalculating = true;

    try {
      const formVal = this.ventaForm.value;
      const tipoVenta = formVal.tipo_venta;
      const nominalTotal = this.resumenInversiones?.valor_nominal_acumulado || 0;

      let valorNominal = 0;
      if (tipoVenta === 'TOTAL') {
        valorNominal = nominalTotal;
      } else {
        valorNominal = formVal.valor_nominal_vendido || 0;
      }

      const precioVenta = formVal.precio_venta || 0;
      const interesPrevio = formVal.interes_previo_venta || 0;
      const comisionOperador = formVal.comision_operador || 0;
      const comisionBolsa = formVal.comision_bolsa || 0;

      // 1. Valor Venta sin Comisión (Valor Efectivo) = Valor Nominal * (Precio de Venta / 100)
      const valorVentaSinComision = valorNominal * (precioVenta / 100);

      // 2. Valor Venta con Comisión = Valor sin Comisión - Comisión Operador - Comisión Bolsa
      const valorVentaConComision = valorVentaSinComision - comisionOperador - comisionBolsa;

      // 3. Total Vendedor Neto = Valor sin Comisión (Valor Efectivo) + Interés Previo - Comisión Bolsa - Comisión Operador
      const totalVendedorNeto = valorVentaSinComision + interesPrevio - comisionBolsa - comisionOperador;

      // 4. Precio Neto de Venta = (Total Vendedor Neto / Valor Nominal) * 100
      const precioNetoVenta = valorNominal > 0 ? (totalVendedorNeto / valorNominal) * 100 : 0;

      this.ventaForm.patchValue({
        valor_venta_sin_comision: valorVentaSinComision ? parseFloat(valorVentaSinComision.toFixed(2)) : 0,
        valor_venta_con_comision: valorVentaConComision ? parseFloat(valorVentaConComision.toFixed(2)) : 0,
        total_vendedor_neto: totalVendedorNeto ? parseFloat(totalVendedorNeto.toFixed(2)) : 0,
        precio_neto_venta: precioNetoVenta ? parseFloat(precioNetoVenta.toFixed(4)) : 0
      }, { emitEvent: false });

    } finally {
      this.isCalculating = false;
    }
  }

  onPageChange(event: any): void {
    this.rowsPerPage = event.rows;
    this.paginationService.setRowsPerPage('ventasInversion', event.rows);
  }

  onFilter(event: any): void {
    // Actualizar totalRecords cuando se filtra la tabla
    if (event.filteredValue) {
      this.totalRecords = event.filteredValue.length;
    } else {
      this.totalRecords = this.ventas.length;
    }
  }
}
