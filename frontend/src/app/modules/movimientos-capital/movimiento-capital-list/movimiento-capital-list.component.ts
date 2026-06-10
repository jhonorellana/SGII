import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { TableModule, Table } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { ConfirmationService, MessageService } from 'primeng/api';
import { MovimientoCapitalService, MovimientoCapital } from '../../../core/movimiento-capital.service';
import { CatalogoService } from '../../../core/catalogo.service';
import { InversionService, Inversion } from '../../../core/inversion.service';
import { CuentaBancariaService, CuentaBancaria } from '../../../core/cuenta-bancaria.service';
import { PersonaService } from '../../../core/persona.service';
import { ModalActionsComponent } from '../../../core/modal-actions';
import { PaginationService } from '../../../core/pagination.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CatalogoValor {
  id_catalogo_valor: number;
  nombre: string;
  codigo: string;
}

@Component({
  selector: 'app-movimiento-capital-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    ButtonModule,
    TagModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    CalendarModule,
    CheckboxModule,
    TooltipModule,
    CardModule,
    ModalActionsComponent
  ],
  templateUrl: './movimiento-capital-list.component.html',
  styleUrl: './movimiento-capital-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class MovimientoCapitalListComponent implements OnInit {
  movimientos: MovimientoCapital[] = [];
  tiposMovimiento: any[] = [];
  signos: any[] = [];
  personas: any[] = [];
  inversiones: any[] = [];
  ventasInversion: any[] = [];
  cuentasBancarias: CuentaBancaria[] = [];
  cuentasBancariasConLabel: any[] = [];
  loading = false;
  error = '';
  @ViewChild('dt') dt: Table | undefined;
  totalRecords: number = 0;
  rowsPerPage: number = 10;

  // Summary card data
  totalIngresos: number = 0;
  totalEgresos: number = 0;
  saldoEsperado: number = 0;
  pendientesConciliacion: number = 0;
  saldosPorPersona: { [key: number]: { nombre: string; saldo: number } } = {};

  // Filters
  filters = {
    fecha_desde: null as Date | null,
    fecha_hasta: null as Date | null,
    id_tipo_movimiento: null as number | null,
    id_persona: null as number | null,
    id_inversion: null as number | null,
    id_signo: null as number | null,
    id_cuenta_bancaria: null as number | null,
    conciliado: null as boolean | null
  };

  // Modal properties
  displayDialog: boolean = false;
  isEdit: boolean = false;
  movimientoId: number | null = null;
  movimientoForm: FormGroup;
  formLoading: boolean = false;
  formError: string = '';

  // View details modal
  displayDetailsDialog: boolean = false;
  selectedMovimiento: MovimientoCapital | null = null;
  selectedMovimientos: MovimientoCapital[] = [];

  constructor(
    private movimientoService: MovimientoCapitalService,
    private catalogoService: CatalogoService,
    private inversionService: InversionService,
    private cuentaBancariaService: CuentaBancariaService,
    private personaService: PersonaService,
    private fb: FormBuilder,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
    private paginationService: PaginationService
  ) {
    this.movimientoForm = this.createForm();
  }

  ngOnInit(): void {
    this.rowsPerPage = this.paginationService.getRowsPerPage('movimientosCapital', 10);
    this.setupConciliadoListener();
    this.loadMovimientos();
    this.loadTiposMovimiento();
    this.loadSignos();
    this.loadPersonas();
    this.loadInversiones();
    this.loadVentasInversion();
    this.loadCuentasBancarias();
  }

  setupConciliadoListener(): void {
    this.movimientoForm.get('conciliado')?.valueChanges.subscribe((conciliado: boolean) => {
      if (conciliado) {
        this.movimientoForm.patchValue({ fecha_conciliacion: new Date() });
      } else if (!conciliado) {
        this.movimientoForm.patchValue({ fecha_conciliacion: null });
      }
    });
  }

  createForm(): FormGroup {
    return this.fb.group({
      fecha_movimiento: [null, Validators.required],
      id_tipo_movimiento: [null, Validators.required],
      id_persona: [null, Validators.required],
      id_signo: [null, Validators.required],
      monto: [null, Validators.nullValidator],
      id_inversion: [null],
      id_venta_inversion: [null],
      id_cuenta_bancaria: [null],
      descripcion: ['', Validators.maxLength(100)],
      conciliado: [false],
      fecha_conciliacion: [null]
    });
  }

  loadMovimientos(): void {
    this.loading = true;
    this.error = '';
    this.selectedMovimientos = [];

    const filters: any = {};
    if (this.filters.fecha_desde) filters.fecha_desde = this.formatDate(this.filters.fecha_desde);
    if (this.filters.fecha_hasta) filters.fecha_hasta = this.formatDate(this.filters.fecha_hasta);
    if (this.filters.id_tipo_movimiento) filters.id_tipo_movimiento = this.filters.id_tipo_movimiento;
    if (this.filters.id_persona) filters.id_persona = this.filters.id_persona;
    if (this.filters.id_inversion) filters.id_inversion = this.filters.id_inversion;
    if (this.filters.id_signo) filters.id_signo = this.filters.id_signo;
    if (this.filters.id_cuenta_bancaria) filters.id_cuenta_bancaria = this.filters.id_cuenta_bancaria;
    if (this.filters.conciliado !== null) filters.conciliado = this.filters.conciliado;

    this.movimientoService.getAll(filters).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.movimientos = response.data;
          this.totalRecords = response.data.length;
          this.calculateSummary();
          this.calculateSaldoAcumulado();
        } else {
          this.error = response.message || 'Error al cargar movimientos';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar movimientos: ' + err.message;
        this.loading = false;
      }
    });
  }

  loadTiposMovimiento(): void {
    this.catalogoService.getValoresByCatalogo(14).subscribe({
      next: (response) => {
        if (Array.isArray(response)) {
          // Agregar opción "Todos" al inicio
          this.tiposMovimiento = [
            { id_catalogo_valor: undefined, nombre: 'Todos' },
            ...response
          ];
        } else if (response && response.data) {
          this.tiposMovimiento = [
            { id_catalogo_valor: undefined, nombre: 'Todos' },
            ...response.data
          ];
        } else {
          this.tiposMovimiento = [{ id_catalogo_valor: undefined, nombre: 'Todos' }];
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar tipos de movimiento:', err);
        this.tiposMovimiento = [{ id_catalogo_valor: undefined, nombre: 'Todos' }];
        this.cdr.detectChanges();
      }
    });
  }

  loadSignos(): void {
    this.catalogoService.getValoresByCatalogo(15).subscribe({
      next: (response) => {
        if (Array.isArray(response)) {
          // Agregar opción "Todos" al inicio
          this.signos = [
            { id_catalogo_valor: undefined, nombre: 'Todos', codigo: 'TODOS' },
            ...response
          ];
        } else if (response && response.data) {
          this.signos = [
            { id_catalogo_valor: undefined, nombre: 'Todos', codigo: 'TODOS' },
            ...response.data
          ];
        } else {
          this.signos = [{ id_catalogo_valor: undefined, nombre: 'Todos', codigo: 'TODOS' }];
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar signos:', err);
        this.signos = [{ id_catalogo_valor: undefined, nombre: 'Todos', codigo: 'TODOS' }];
        this.cdr.detectChanges();
      }
    });
  }

  loadPersonas(): void {
    this.personaService.getAll().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Agregar opción "Todas" al inicio
          this.personas = [
            { id_persona: undefined, nombre: 'Todas' },
            ...response.data.map((p: any) => ({
              ...p,
              nombre: `${p.nombres} ${p.apellidos}`.trim()
            }))
          ];
        } else {
          this.personas = [{ id_persona: undefined, nombre: 'Todas' }];
        }
      },
      error: (err) => {
        console.error('Error al cargar personas:', err);
        this.personas = [{ id_persona: undefined, nombre: 'Todas' }];
      }
    });
  }

  loadInversiones(): void {
    this.inversionService.getAll().subscribe({
      next: (data) => {
        // Agregar opción "Todas" al inicio
        this.inversiones = [
          { id_inversion: undefined, label: 'Todas' },
          ...data.map((inv: any) => {
            const liquidacion = inv.liquidacion || 'Sin liquidación';
            return {
              id_inversion: inv.id_inversion,
              label: `#${inv.id_inversion} - ${liquidacion}`
            };
          })
        ];
      }
    });
  }

  loadVentasInversion(): void {
    // Cargar ventas de inversión para VENTA_INVERSION
    // Por ahora lo dejamos vacío, se puede implementar cuando se tenga el servicio
    this.ventasInversion = [];
  }

  loadCuentasBancarias(): void {
    this.cuentaBancariaService.getAll().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.cuentasBancarias = response.data;
          this.cuentasBancariasConLabel = response.data.map((cuenta: CuentaBancaria) => ({
            ...cuenta,
            label: this.getCuentaBancariaLabel(cuenta)
          }));
        }
      }
    });
  }

  applyFilters(): void {
    this.loadMovimientos();
  }

  clearFilters(): void {
    this.filters = {
      fecha_desde: null,
      fecha_hasta: null,
      id_tipo_movimiento: null,
      id_persona: null,
      id_inversion: null,
      id_signo: null,
      id_cuenta_bancaria: null,
      conciliado: null
    };
    this.loadMovimientos();
  }

  openCreateDialog(): void {
    this.isEdit = false;
    this.movimientoId = null;
    this.movimientoForm = this.createForm();
    this.displayDialog = true;
    this.formError = '';
  }

  onTipoMovimientoChange(): void {
    const tipoMovimientoId = this.movimientoForm.get('id_tipo_movimiento')?.value;
    if (!tipoMovimientoId) return;

    const tipoMovimiento = this.tiposMovimiento.find(t => t.id_catalogo_valor === tipoMovimientoId);
    const codigo = tipoMovimiento?.codigo;

    // Si es COMPRA_INVERSION, habilitar inversión y deshabilitar cuenta bancaria si no aplica
    if (codigo === 'COM_INV') {
      this.movimientoForm.get('id_inversion')?.enable();
      // Cuenta bancaria puede deshabilitarse según lógica de negocio
    }

    // Si es VENTA_INVERSION, habilitar venta de inversión
    if (codigo === 'VEN_INV') {
      this.movimientoForm.get('id_inversion')?.enable();
    }

    // Para movimientos manuales, limpiar monto calculado
    if (!this.isMontoReadOnly()) {
      this.movimientoForm.patchValue({ monto: null });
    }
  }

  onInversionChange(): void {
    const inversionId = this.movimientoForm.get('id_inversion')?.value;
    if (!inversionId) return;

    const tipoMovimientoId = this.movimientoForm.get('id_tipo_movimiento')?.value;
    if (!tipoMovimientoId) return;

    const tipoMovimiento = this.tiposMovimiento.find(t => t.id_catalogo_valor === tipoMovimientoId);
    const codigo = tipoMovimiento?.codigo;

    // Si es COMPRA_INVERSION, cargar monto desde capital_invertido
    if (codigo === 'COM_INV') {
      const inversion = this.inversiones.find((i: Inversion) => i.id_inversion === inversionId);
      if (inversion && inversion.capital_invertido) {
        const monto = parseFloat(String(inversion.capital_invertido));
        this.movimientoForm.patchValue({ monto: isNaN(monto) ? 0 : monto });
      }
    }

    // Si es VENTA_INVERSION, cargar monto desde valor_venta_con_comision
    if (codigo === 'VEN_INV') {
      const venta = this.ventasInversion.find((v: any) => v.id_inversion === inversionId);
      if (venta && venta.valor_venta_con_comision) {
        const monto = parseFloat(String(venta.valor_venta_con_comision));
        this.movimientoForm.patchValue({ monto: isNaN(monto) ? 0 : monto });
      }
    }
  }

  openEditDialog(movimiento: MovimientoCapital): void {
    this.isEdit = true;
    this.movimientoId = movimiento.id_movimiento_capital || null;
    this.movimientoForm = this.createForm();
    this.setupConciliadoListener();

    // Calcular el monto según el tipo de movimiento
    const monto = this.getMonto(movimiento);

    this.movimientoForm.patchValue({
      fecha_movimiento: movimiento.fecha_movimiento ? this.parseDateWithoutTimezone(movimiento.fecha_movimiento) : null,
      id_tipo_movimiento: movimiento.id_tipo_movimiento,
      id_persona: movimiento.id_persona,
      id_signo: movimiento.id_signo,
      monto: monto,
      id_inversion: movimiento.id_inversion,
      id_venta_inversion: movimiento.id_venta_inversion,
      id_cuenta_bancaria: movimiento.id_cuenta_bancaria,
      descripcion: movimiento.descripcion || '',
      conciliado: movimiento.conciliado,
      fecha_conciliacion: movimiento.fecha_conciliacion ? this.parseDateWithoutTimezone(movimiento.fecha_conciliacion) : (movimiento.conciliado ? new Date() : null)
    });

    // Forzar actualización de UI
    this.cdr.detectChanges();

    this.displayDialog = true;
    this.formError = '';
  }

  viewMovimientoDetails(movimiento: MovimientoCapital): void {
    this.selectedMovimiento = movimiento;
    this.displayDetailsDialog = true;
  }

  save(): void {
    if (this.movimientoForm.invalid) {
      this.formError = 'Por favor complete los campos requeridos';
      return;
    }

    this.formLoading = true;
    this.formError = '';

    const movimientoData = {
      ...this.movimientoForm.value,
      fecha_movimiento: this.formatDate(this.movimientoForm.value.fecha_movimiento),
      fecha_conciliacion: this.movimientoForm.value.fecha_conciliacion ? this.formatDate(this.movimientoForm.value.fecha_conciliacion) : null
    };

    if (this.isEdit && this.movimientoId) {
      this.movimientoService.update(this.movimientoId, movimientoData).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Movimiento actualizado correctamente' });
            this.displayDialog = false;
            this.loadMovimientos();
          } else {
            this.formError = response.message || 'Error al actualizar movimiento';
          }
          this.formLoading = false;
        },
        error: (err) => {
          this.formError = 'Error al actualizar movimiento: ' + err.message;
          this.formLoading = false;
        }
      });
    } else {
      this.movimientoService.create(movimientoData).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Movimiento creado correctamente' });
            this.displayDialog = false;
            this.loadMovimientos();
          } else {
            this.formError = response.message || 'Error al crear movimiento';
          }
          this.formLoading = false;
        },
        error: (err) => {
          this.formError = 'Error al crear movimiento: ' + err.message;
          this.formLoading = false;
        }
      });
    }
  }

  deleteMovimiento(movimiento: MovimientoCapital): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de eliminar el movimiento del ${movimiento.fecha_movimiento}?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        if (movimiento.id_movimiento_capital) {
          this.movimientoService.delete(movimiento.id_movimiento_capital).subscribe({
            next: (response) => {
              if (response.success) {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Movimiento eliminado correctamente' });
                this.loadMovimientos();
              } else {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: response.message || 'Error al eliminar movimiento' });
              }
            },
            error: (err) => {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar movimiento: ' + err.message });
            }
          });
        }
      }
    });
  }

  getPendingSelectedCount(): number {
    return this.selectedMovimientos.filter(m => !m.conciliado).length;
  }

  conciliarSeleccionados(): void {
    const pendingMovimientos = this.selectedMovimientos.filter(m => !m.conciliado);
    const count = pendingMovimientos.length;

    if (count === 0) {
      this.messageService.add({
        severity: 'info',
        summary: 'Información',
        detail: 'No hay movimientos pendientes de conciliación seleccionados'
      });
      return;
    }

    const ids = pendingMovimientos.map(m => m.id_movimiento_capital).filter((id): id is number => !!id);

    this.confirmationService.confirm({
      message: `¿Está seguro de conciliar los ${count} movimientos seleccionados?`,
      header: 'Confirmar conciliación masiva',
      icon: 'pi pi-check-circle',
      accept: () => {
        this.loading = true;
        this.movimientoService.conciliarLote(ids).subscribe({
          next: (response) => {
            if (response.success) {
              this.messageService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: response.message || 'Movimientos conciliados correctamente'
              });
              this.loadMovimientos();
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: response.message || 'Error al conciliar movimientos'
              });
              this.loading = false;
            }
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al conciliar movimientos: ' + err.message
            });
            this.loading = false;
          }
        });
      }
    });
  }

  formatDate(date: Date | string | null): string | null {
    if (!date) return null;
    if (typeof date === 'string') {
      // Si es string, extraer solo la parte YYYY-MM-DD
      return date.split('T')[0];
    }
    // Si es Date, formatear sin conversión de timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getConciliadoClass(conciliado: boolean): 'success' | 'danger' | 'info' | 'warning' | 'secondary' | 'contrast' {
    return conciliado ? 'success' : 'warning';
  }

  formatDateShort(dateString: string): string {
    if (!dateString) return '-';
    // Extraer solo la fecha YYYY-MM-DD sin conversión de timezone
    const datePart = dateString.split('T')[0];
    return datePart;
  }

  parseDateWithoutTimezone(dateString: string): Date {
    if (!dateString) return new Date();
    // Extraer YYYY-MM-DD y crear fecha local sin conversión de timezone
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    // Crear fecha usando hora local (mes es 0-indexed en JavaScript)
    return new Date(year, month - 1, day);
  }

  getMonto(movimiento: MovimientoCapital): number {
    const tipoCodigo = movimiento.tipo_movimiento?.codigo || movimiento.tipoMovimiento?.codigo;

    if (tipoCodigo === 'COM_INV' && movimiento.inversion) {
      // COMPRA_INVERSION: usar valor_con_interes
      const monto = parseFloat(String(movimiento.inversion.valor_con_interes || movimiento.inversion.capital_invertido || 0));
      return isNaN(monto) ? 0 : monto;
    }

    if (tipoCodigo === 'VEN_INV' && movimiento.ventaInversion) {
      // VENTA_INVERSION: usar valor_venta_con_comision
      const monto = parseFloat(String(movimiento.ventaInversion.valor_venta_con_comision || 0));
      return isNaN(monto) ? 0 : monto;
    }

    // Otros tipos: usar monto del movimiento
    const monto = parseFloat(String(movimiento.monto || 0));
    return isNaN(monto) ? 0 : monto;
  }

  getSignoLabel(id_signo: number, movimiento?: MovimientoCapital): string {
    // Usar signo_catalogo (snake_case como lo envía Laravel) o signoCatalogo
    if (movimiento && movimiento.signo_catalogo) {
      return movimiento.signo_catalogo.nombre || '-';
    }
    if (movimiento && movimiento.signoCatalogo) {
      return movimiento.signoCatalogo.nombre || '-';
    }
    // Fallback: buscar en el array local
    const signo = this.signos.find(s => s.id_catalogo_valor === id_signo);
    return signo ? signo.nombre : '-';
  }

  getSignoClass(id_signo: number, movimiento?: MovimientoCapital): 'success' | 'danger' | 'info' | 'warning' | 'secondary' | 'contrast' {
    // Usar signo_catalogo (snake_case como lo envía Laravel) o signoCatalogo
    if (movimiento && movimiento.signo_catalogo) {
      const signo = movimiento.signo_catalogo;
      return signo && signo.codigo === 'POSITIVO' ? 'success' : 'danger';
    }
    if (movimiento && movimiento.signoCatalogo) {
      const signo = movimiento.signoCatalogo;
      return signo && signo.codigo === 'POSITIVO' ? 'success' : 'danger';
    }
    // Fallback: buscar en el array local
    const signo = this.signos.find(s => s.id_catalogo_valor === id_signo);
    return signo && signo.codigo === 'POSITIVO' ? 'success' : 'danger';
  }

  getInversionLabel(movimiento: MovimientoCapital): string {
    if (!movimiento.inversion) return '-';
    const inv = movimiento.inversion;
    const liquidacion = inv.liquidacion || 'Sin liquidación';
    return `#${inv.id_inversion} - ${liquidacion}`;
  }

  getPersonaNombre(movimiento: MovimientoCapital): string {
    if (!movimiento.persona) return '-';
    // Si el backend envía el atributo 'nombre' (appended), usarlo
    if (movimiento.persona.nombre) {
      return movimiento.persona.nombre;
    }
    // Si no, concatenar nombres y apellidos
    const nombres = movimiento.persona.nombres || '';
    const apellidos = movimiento.persona.apellidos || '';
    const nombreCompleto = `${nombres} ${apellidos}`.trim();
    return nombreCompleto || '-';
  }

  getCuentaBancariaLabel(cuenta: CuentaBancaria): string {
    if (!cuenta) return '';
    const nombres = cuenta.persona?.nombres || '';
    const apellidos = cuenta.persona?.apellidos || '';
    const nombreCompleto = `${nombres} ${apellidos}`.trim();
    const banco = cuenta.banco?.nombre || cuenta.banco?.codigo || '';
    return nombreCompleto ? `${nombreCompleto} - ${banco}` : banco;
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  calculateSummary(): void {
    this.totalIngresos = 0;
    this.totalEgresos = 0;
    this.pendientesConciliacion = 0;

    this.movimientos.forEach(mov => {
      const monto = this.getMonto(mov);
      // Usar signo_catalogo (snake_case como lo envía Laravel)
      const signo = mov.signo_catalogo || mov.signoCatalogo;

      if (signo && signo.codigo === 'POSITIVO') {
        this.totalIngresos += monto;
      } else {
        this.totalEgresos += monto;
      }
      if (!mov.conciliado) {
        this.pendientesConciliacion++;
      }
    });

    this.saldoEsperado = this.totalIngresos - this.totalEgresos;
  }

  calculateSaldoAcumulado(): void {
    // Reset saldos por persona
    this.saldosPorPersona = {};

    // Agrupar movimientos por persona
    const movimientosPorPersona: { [key: number]: MovimientoCapital[] } = {};

    this.movimientos.forEach(mov => {
      const idPersona = mov.persona?.id_persona || mov.id_persona || 0; // 0 para movimientos sin persona
      if (!movimientosPorPersona[idPersona]) {
        movimientosPorPersona[idPersona] = [];
      }
      movimientosPorPersona[idPersona].push(mov);
    });

    // Calcular saldo acumulado por persona
    Object.keys(movimientosPorPersona).forEach(idPersonaStr => {
      const idPersona = parseInt(idPersonaStr);
      const movimientosPersona = movimientosPorPersona[idPersona];

      // Ordenar por fecha y ID
      const sorted = [...movimientosPersona].sort((a, b) => {
        const dateA = new Date(a.fecha_movimiento).getTime();
        const dateB = new Date(b.fecha_movimiento).getTime();
        if (dateA !== dateB) {
          return dateA - dateB;
        }
        return (a.id_movimiento_capital || 0) - (b.id_movimiento_capital || 0);
      });

      let saldoPersona = 0;
      const nombrePersona = this.getPersonaNombre(sorted[0]);

      sorted.forEach(mov => {
        const monto = this.getMonto(mov);
        // Usar signo_catalogo (snake_case como lo envía Laravel)
        const signo = mov.signo_catalogo || mov.signoCatalogo;
        if (signo && signo.codigo === 'POSITIVO') {
          saldoPersona += monto;
        } else {
          saldoPersona -= monto;
        }
        mov.saldo_acumulado = saldoPersona;
      });

      this.saldosPorPersona[idPersona] = {
        nombre: nombrePersona,
        saldo: saldoPersona
      };
    });

    // Calcular saldo general (todos los movimientos ordenados cronológicamente)
    let saldoGeneral = 0;
    const sortedAll = [...this.movimientos].sort((a, b) => {
      const dateA = new Date(a.fecha_movimiento).getTime();
      const dateB = new Date(b.fecha_movimiento).getTime();
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      return (a.id_movimiento_capital || 0) - (b.id_movimiento_capital || 0);
    });

    sortedAll.forEach(mov => {
      const monto = this.getMonto(mov);
      // Usar signo_catalogo (snake_case como lo envía Laravel)
      const signo = mov.signo_catalogo || mov.signoCatalogo;
      if (signo && signo.codigo === 'POSITIVO') {
        saldoGeneral += monto;
      } else {
        saldoGeneral -= monto;
      }
    });

    // Guardar saldo general con ID especial
    this.saldosPorPersona[0] = {
      nombre: 'Total General',
      saldo: saldoGeneral
    };
  }

  exportToExcel(): void {
    const dataToExport = this.dt?.filteredValue || this.movimientos;
    const exportData = dataToExport.map(mov => ({
      ID: mov.id_movimiento_capital,
      Fecha: this.formatDateShort(mov.fecha_movimiento),
      Tipo: mov.tipo_movimiento?.nombre || mov.tipoMovimiento?.nombre || '-',
      Persona: this.getPersonaNombre(mov),
      Descripción: mov.descripcion || '',
      Inversión: this.getInversionLabel(mov),
      Signo: this.getSignoLabel(mov.id_signo, mov),
      Monto: this.getMonto(mov),
      'Saldo Acumulado': mov.saldo_acumulado || 0,
      Conciliado: mov.conciliado ? 'Sí' : 'No'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimientos');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `movimientos_capital_${new Date().toISOString().split('T')[0]}.xlsx`;

    saveAs(blob, fileName);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo Excel exportado correctamente'
    });
  }

  exportToPDF(): void {
    const dataToExport = this.dt?.filteredValue || this.movimientos;
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Reporte de Movimientos de Capital', 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = dataToExport.map(mov => [
      mov.id_movimiento_capital,
      this.formatDateShort(mov.fecha_movimiento),
      mov.tipo_movimiento?.nombre || mov.tipoMovimiento?.nombre || '-',
      this.getPersonaNombre(mov),
      mov.descripcion || '',
      this.getInversionLabel(mov),
      this.getSignoLabel(mov.id_signo, mov),
      this.formatCurrency(this.getMonto(mov)),
      this.formatCurrency(mov.saldo_acumulado || 0),
      mov.conciliado ? 'Sí' : 'No'
    ]);

    autoTable(doc, {
      head: [['ID', 'Fecha', 'Tipo', 'Persona', 'Descripción', 'Inversión', 'Signo', 'Monto', 'Saldo Acumulado', 'Conciliado']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [97, 178, 125] }
    });

    doc.save(`movimientos_capital_${new Date().toISOString().split('T')[0]}.pdf`);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo PDF exportado correctamente'
    });
  }

  hasSaldosPorPersona(): boolean {
    return this.saldosPorPersona && Object.keys(this.saldosPorPersona).length > 0;
  }

  onGlobalFilter(event: Event): void {
    if (this.dt) {
      this.dt.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }
  }

  isMontoReadOnly(): boolean {
    const tipoMovimientoId = this.movimientoForm.get('id_tipo_movimiento')?.value;

    if (!tipoMovimientoId) {
      return false;
    }

    const tipoMovimiento = this.tiposMovimiento.find(t => t.id_catalogo_valor === tipoMovimientoId);
    const codigo = tipoMovimiento?.codigo;

    // COMPRA_INVERSION (COM_INV) y VENTA_INVERSION (VEN_INV) tienen monto calculado
    return codigo === 'COM_INV' || codigo === 'VEN_INV';
  }

  getTipoMovimientoNombre(): string {
    const tipoMovimientoId = this.movimientoForm.get('id_tipo_movimiento')?.value;
    if (!tipoMovimientoId) return '-';

    const tipoMovimiento = this.tiposMovimiento.find(t => t.id_catalogo_valor === tipoMovimientoId);
    return tipoMovimiento?.nombre || '-';
  }

  getMontoOrigen(): string {
    const tipoMovimientoId = this.movimientoForm.get('id_tipo_movimiento')?.value;
    if (!tipoMovimientoId) return '';

    const tipoMovimiento = this.tiposMovimiento.find(t => t.id_catalogo_valor === tipoMovimientoId);
    const codigo = tipoMovimiento?.codigo;

    if (codigo === 'COM_INV') return 'la inversión';
    if (codigo === 'VEN_INV') return 'la venta de inversión';
    return '';
  }

  isCuentaBancariaNotApplicable(): boolean {
    const tipoMovimientoId = this.movimientoForm.get('id_tipo_movimiento')?.value;
    if (!tipoMovimientoId) return false;

    const tipoMovimiento = this.tiposMovimiento.find(t => t.id_catalogo_valor === tipoMovimientoId);
    const codigo = tipoMovimiento?.codigo;

    // Ajustar según lógica de negocio
    return false;
  }

  onPageChange(event: any): void {
    this.rowsPerPage = event.rows;
    this.paginationService.setRowsPerPage('movimientosCapital', this.rowsPerPage);
  }
}
