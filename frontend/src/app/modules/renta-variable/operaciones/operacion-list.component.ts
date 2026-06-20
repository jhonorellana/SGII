import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
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

import { AccionOperacionService } from '../../../core/accion-operacion.service';
import { AccionPosicionService } from '../../../core/accion-posicion.service';
import { PersonaService } from '../../../core/persona.service';
import { InstrumentoService } from '../../../core/instrumento.service';
import { CatalogoService } from '../../../core/catalogo.service';
import { PaginationService } from '../../../core/pagination.service';
import { AccionOperacion } from '../../../core/models/accion-models';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-operacion-list',
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
    CardModule
  ],
  templateUrl: './operacion-list.component.html',
  styleUrl: './operacion-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class OperacionListComponent implements OnInit {
  operaciones: AccionOperacion[] = [];
  personas: any[] = [];
  instrumentos: any[] = [];
  tiposOperacion: any[] = [];
  loading = false;
  error = '';
  @ViewChild('dt') dt: Table | undefined;
  totalRecords: number = 0;
  rowsPerPage: number = 10;

  // Modal properties
  displayDialog: boolean = false;
  isEdit: boolean = false;
  operacionId: number | null = null;
  operacionForm!: FormGroup;
  formError: string = '';
  formLoading: boolean = false;

  // Stock validation state
  stockDisponible: number | null = null;
  cargandoStock: boolean = false;

  // Filters
  filters = {
    id_persona: null as number | null,
    id_instrumento: null as number | null,
    id_tipo_operacion: null as number | null,
    fecha_desde: null as Date | null,
    fecha_hasta: null as Date | null
  };

  cols = [
    { field: 'id_accion_operacion', header: 'ID' },
    { field: 'fecha_operacion', header: 'Fecha' },
    { field: 'persona.nombres', header: 'Socio' },
    { field: 'instrumento.nombre', header: 'Acción' },
    { field: 'tipo_operacion.nombre', header: 'Tipo Operación' },
    { field: 'cantidad', header: 'Cantidad' },
    { field: 'precio_unitario', header: 'Precio Unitario' },
    { field: 'valor_bruto', header: 'Valor Bruto' },
    { field: 'total_comisiones', header: 'Comisiones' },
    { field: 'valor_neto', header: 'Valor Neto' },
    { field: 'liquidacion', header: 'Liquidación' },
    { field: 'acciones', header: 'Acciones' }
  ];

  constructor(
    private fb: FormBuilder,
    private operacionService: AccionOperacionService,
    private posicionService: AccionPosicionService,
    private personaService: PersonaService,
    private instrumentoService: InstrumentoService,
    private catalogoService: CatalogoService,
    private paginationService: PaginationService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.rowsPerPage = this.paginationService.getRowsPerPage('accionOperaciones', 10);
    this.operacionForm = this.createForm();
    this.loadOperaciones();
    this.loadPersonas();
    this.loadInstrumentos();
    this.loadTiposOperacion();
    this.setupFormValueChanges();
  }

  createForm(): FormGroup {
    return this.fb.group({
      id_persona: [null, Validators.required],
      id_instrumento: [null, Validators.required],
      id_tipo_operacion: [null, Validators.required],
      fecha_operacion: [new Date(), Validators.required],
      cantidad: [null, [Validators.required, Validators.min(0.000001)]],
      precio_unitario: [0, [Validators.required, Validators.min(0)]],
      valor_bruto: [{ value: 0, disabled: true }, Validators.required],
      comision_bolsa: [0, [Validators.required, Validators.min(0)]],
      comision_operador: [0, [Validators.required, Validators.min(0)]],
      total_comisiones: [{ value: 0, disabled: true }, Validators.required],
      valor_neto: [{ value: 0, disabled: true }, Validators.required],
      liquidacion: ['', Validators.maxLength(50)],
      observacion: ['', Validators.maxLength(500)]
    });
  }

  loadOperaciones(): void {
    this.loading = true;
    const requestFilters = {
      id_persona: this.filters.id_persona || undefined,
      id_instrumento: this.filters.id_instrumento || undefined,
      id_tipo_operacion: this.filters.id_tipo_operacion || undefined,
      fecha_desde: this.filters.fecha_desde ? this.formatDate(this.filters.fecha_desde) : undefined,
      fecha_hasta: this.filters.fecha_hasta ? this.formatDate(this.filters.fecha_hasta) : undefined
    };

    this.operacionService.getAll(requestFilters).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.operaciones = response.data;
          this.totalRecords = this.operaciones.length;
        } else {
          this.operaciones = [];
          this.totalRecords = 0;
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar operaciones: ' + err.message;
        this.loading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las operaciones.' });
      }
    });
  }

  loadPersonas(): void {
    this.personaService.getAll().subscribe({
      next: (data: any) => {
        const personasArray = Array.isArray(data) ? data : (data as any).data || [];
        this.personas = personasArray
          .filter((p: any) => p.activo === true || p.activo === 1)
          .map((p: any) => ({
            value: p.id_persona,
            label: `${p.nombres} ${p.apellidos}`.trim()
          }));
      }
    });
  }

  loadInstrumentos(): void {
    this.instrumentoService.getAll().subscribe({
      next: (data: any) => {
        const instrumentosArray = Array.isArray(data) ? data : (data as any).data || [];
        // Filtrar solo los instrumentos activos de Renta Variable (generalmente catalogados como tales)
        this.instrumentos = instrumentosArray
          .filter((i: any) => i.activo === true || i.activo === 1)
          .map((i: any) => ({
            value: i.id_instrumento,
            label: i.nombre || i.codigo_titulo
          }));
      }
    });
  }

  loadTiposOperacion(): void {
    this.catalogoService.getValoresByCatalogo(17).subscribe({
      next: (data: any) => {
        const valoresArray = Array.isArray(data) ? data : (data as any).data || [];
        this.tiposOperacion = valoresArray
          .filter((v: any) => v.activo === true || v.activo === 1)
          .map((v: any) => ({
            value: v.id_catalogo_valor,
            label: v.nombre,
            codigo: v.codigo
          }));
      }
    });
  }

  setupFormValueChanges(): void {
    // Escuchar cambios de cálculo de montos
    const calculateFields = ['cantidad', 'precio_unitario', 'comision_bolsa', 'comision_operador', 'id_tipo_operacion'];
    calculateFields.forEach(field => {
      this.operacionForm.get(field)?.valueChanges.subscribe(() => {
        this.recalcularTotales();
      });
    });

    // Escuchar cambios de socio/instrumento/tipo para validar stock
    const validationFields = ['id_persona', 'id_instrumento', 'id_tipo_operacion'];
    validationFields.forEach(field => {
      this.operacionForm.get(field)?.valueChanges.subscribe(() => {
        this.validarStockDisponible();
      });
    });
  }

  recalcularTotales(): void {
    const cantidad = parseFloat(this.operacionForm.get('cantidad')?.value || 0);
    const precioUnitario = parseFloat(this.operacionForm.get('precio_unitario')?.value || 0);
    const comisionBolsa = parseFloat(this.operacionForm.get('comision_bolsa')?.value || 0);
    const comisionOperador = parseFloat(this.operacionForm.get('comision_operador')?.value || 0);
    const idTipoOp = this.operacionForm.get('id_tipo_operacion')?.value;

    const valorBruto = cantidad * precioUnitario;
    const totalComisiones = comisionBolsa + comisionOperador;

    let valorNeto = 0;
    // Si es COMPRA (204) o ajuste positivo (207) suma comisiones al costo. Si es VENTA (205) resta comisiones
    if (idTipoOp === 204 || idTipoOp === 207) {
      valorNeto = valorBruto + totalComisiones;
    } else if (idTipoOp === 205 || idTipoOp === 208) {
      valorNeto = valorBruto - totalComisiones;
    } else {
      // Para splits (212) o bonificaciones (206)
      valorNeto = valorBruto;
    }

    this.operacionForm.patchValue({
      valor_bruto: valorBruto,
      total_comisiones: totalComisiones,
      valor_neto: valorNeto >= 0 ? valorNeto : 0
    }, { emitEvent: false });
  }

  validarStockDisponible(): void {
    const idPersona = this.operacionForm.get('id_persona')?.value;
    const idInstrumento = this.operacionForm.get('id_instrumento')?.value;
    const idTipoOp = this.operacionForm.get('id_tipo_operacion')?.value;

    // Solo validar stock disponible para Venta (205) o Ajuste Negativo (208)
    if ((idTipoOp === 205 || idTipoOp === 208) && idPersona && idInstrumento) {
      this.cargandoStock = true;
      this.posicionService.getSocioPosicion(idPersona, idInstrumento).subscribe({
        next: (response) => {
          let stock = response.success && response.data ? response.data.cantidad_actual : 0;
          
          // Si estamos editando, sumar el stock de la propia venta actual
          if (this.isEdit && this.operacionId) {
            const originalOp = this.operaciones.find(o => o.id_accion_operacion === this.operacionId);
            if (originalOp && (originalOp.id_tipo_operacion === 205 || originalOp.id_tipo_operacion === 208)) {
              stock += originalOp.cantidad;
            }
          }

          this.stockDisponible = stock;
          this.cargandoStock = false;
          this.validarCantidadRespectoStock();
        },
        error: () => {
          this.stockDisponible = 0;
          this.cargandoStock = false;
        }
      });
    } else {
      this.stockDisponible = null;
      this.operacionForm.get('cantidad')?.setErrors(null);
    }
  }

  validarCantidadRespectoStock(): void {
    const cantidadValue = parseFloat(this.operacionForm.get('cantidad')?.value || 0);
    if (this.stockDisponible !== null && cantidadValue > this.stockDisponible) {
      this.operacionForm.get('cantidad')?.setErrors({ superarStock: true });
    } else {
      // Remover el error sin pisar otros validadores
      const errors = this.operacionForm.get('cantidad')?.errors;
      if (errors) {
        delete errors['superarStock'];
        const updatedErrors = Object.keys(errors).length > 0 ? errors : null;
        this.operacionForm.get('cantidad')?.setErrors(updatedErrors);
      }
    }
  }

  isTipoOperacionFinanciera(): boolean {
    const idTipoOp = this.operacionForm.get('id_tipo_operacion')?.value;
    // Compra (204) o Venta (205) son financieras.
    return idTipoOp === 204 || idTipoOp === 205;
  }

  applyFilters(): void {
    this.loadOperaciones();
  }

  clearFilters(): void {
    this.filters = {
      id_persona: null,
      id_instrumento: null,
      id_tipo_operacion: null,
      fecha_desde: null,
      fecha_hasta: null
    };
    this.loadOperaciones();
  }

  openCreateDialog(): void {
    this.isEdit = false;
    this.operacionId = null;
    this.stockDisponible = null;
    this.operacionForm = this.createForm();
    this.setupFormValueChanges();
    this.displayDialog = true;
    this.formError = '';
  }

  openEditDialog(op: AccionOperacion): void {
    this.isEdit = true;
    this.operacionId = op.id_accion_operacion || null;
    this.stockDisponible = null;
    this.operacionForm = this.createForm();
    this.setupFormValueChanges();

    this.operacionForm.patchValue({
      id_persona: op.id_persona,
      id_instrumento: op.id_instrumento,
      id_tipo_operacion: op.id_tipo_operacion,
      fecha_operacion: op.fecha_operacion ? this.parseDateWithoutTimezone(op.fecha_operacion) : null,
      cantidad: op.cantidad,
      precio_unitario: op.precio_unitario,
      valor_bruto: op.valor_bruto,
      comision_bolsa: op.comision_bolsa,
      comision_operador: op.comision_operador,
      total_comisiones: op.total_comisiones,
      valor_neto: op.valor_neto,
      liquidacion: op.liquidacion || '',
      observacion: op.observacion || ''
    });

    this.displayDialog = true;
    this.formError = '';
  }

  save(): void {
    // Asegurar validación del stock antes de enviar
    this.validarCantidadRespectoStock();

    if (this.operacionForm.invalid) {
      this.formError = 'Por favor complete todos los campos requeridos y corrija los errores.';
      return;
    }

    this.formLoading = true;
    this.formError = '';

    const rawValue = this.operacionForm.getRawValue();
    const payload: AccionOperacion = {
      ...rawValue,
      fecha_operacion: this.formatDate(rawValue.fecha_operacion),
      activo: true
    };

    if (this.isEdit && this.operacionId) {
      this.operacionService.update(this.operacionId, payload).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Operación actualizada correctamente.' });
            this.displayDialog = false;
            this.loadOperaciones();
          } else {
            this.formError = response.message || 'Error al actualizar la operación.';
          }
          this.formLoading = false;
        },
        error: (err) => {
          this.formError = err.error?.message || 'Error al conectar con la base de datos.';
          this.formLoading = false;
        }
      });
    } else {
      this.operacionService.create(payload).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Operación registrada correctamente.' });
            this.displayDialog = false;
            this.loadOperaciones();
          } else {
            this.formError = response.message || 'Error al registrar la operación.';
          }
          this.formLoading = false;
        },
        error: (err) => {
          this.formError = err.error?.message || 'Error al registrar la operación.';
          this.formLoading = false;
        }
      });
    }
  }

  deleteOperacion(op: AccionOperacion): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de eliminar esta operación? Esto revertirá los movimientos en caja y el stock de acciones correspondientes.`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        if (op.id_accion_operacion) {
          this.loading = true;
          this.operacionService.delete(op.id_accion_operacion).subscribe({
            next: (response) => {
              if (response.success) {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Operación eliminada con éxito.' });
                this.loadOperaciones();
              } else {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: response.message || 'No se pudo eliminar la operación.' });
                this.loading = false;
              }
            },
            error: (err) => {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al eliminar la operación.' });
              this.loading = false;
            }
          });
        }
      }
    });
  }

  formatDate(date: Date | string | null): string | null {
    if (!date) return null;
    if (typeof date === 'string') {
      return date.split('T')[0];
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  parseDateWithoutTimezone(dateString: string): Date {
    if (!dateString) return new Date();
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day);
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

  formatNumber(value: number | null | undefined, decimals = 2): string {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  }

  getPersonaNombre(op: AccionOperacion): string {
    if (!op.persona) return '-';
    return `${op.persona.nombres || ''} ${op.persona.apellidos || ''}`.trim() || '-';
  }

  getTipoOperacionClass(op: AccionOperacion): 'success' | 'danger' | 'info' | 'warning' | 'secondary' | 'contrast' {
    const cod = op.tipo_operacion?.codigo || op.tipoOperacion?.codigo;
    if (cod === 'COMPRA_ACCION' || cod === 'AJUS_POS_ACC' || cod === 'BONIF_ACCIONES') return 'success';
    if (cod === 'VENTA_ACCION' || cod === 'AJUS_NEG_ACC') return 'danger';
    return 'info'; // Split
  }

  getTipoOperacionNombre(op: AccionOperacion): string {
    return op.tipo_operacion?.nombre || op.tipoOperacion?.nombre || '-';
  }

  onGlobalFilter(event: Event): void {
    if (this.dt) {
      this.dt.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }
  }

  onPageChange(event: any): void {
    this.rowsPerPage = event.rows;
    this.paginationService.setRowsPerPage('accionOperaciones', this.rowsPerPage);
  }

  exportToExcel(): void {
    const dataToExport = this.dt?.filteredValue || this.operaciones;
    const exportData = dataToExport.map(op => ({
      ID: op.id_accion_operacion,
      Fecha: this.formatDate(op.fecha_operacion),
      Socio: this.getPersonaNombre(op),
      Acción: op.instrumento?.nombre || '-',
      Tipo: this.getTipoOperacionNombre(op),
      Cantidad: op.cantidad,
      'Precio Unitario': op.precio_unitario,
      'Valor Bruto': op.valor_bruto,
      Comisiones: op.total_comisiones,
      'Valor Neto': op.valor_neto,
      Liquidación: op.liquidacion || '',
      Observación: op.observacion || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Operaciones RV');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `operaciones_renta_variable_${new Date().toISOString().split('T')[0]}.xlsx`;

    saveAs(blob, fileName);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo Excel exportado correctamente'
    });
  }

  exportToPDF(): void {
    const dataToExport = this.dt?.filteredValue || this.operaciones;
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Historial de Operaciones - Renta Variable', 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = dataToExport.map(op => [
      op.id_accion_operacion,
      this.formatDate(op.fecha_operacion),
      this.getPersonaNombre(op),
      op.instrumento?.nombre || '-',
      this.getTipoOperacionNombre(op),
      this.formatNumber(op.cantidad, 4),
      this.formatCurrency(op.precio_unitario),
      this.formatCurrency(op.valor_bruto),
      this.formatCurrency(op.total_comisiones),
      this.formatCurrency(op.valor_neto),
      op.liquidacion || '-'
    ]);

    autoTable(doc, {
      head: [['ID', 'Fecha', 'Socio', 'Acción', 'Tipo', 'Cantidad', 'P. Unitario', 'V. Bruto', 'Comisiones', 'V. Neto', 'Liquidación']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [65, 105, 225] } // Royal Blue color standard for Stocks
    });

    doc.save(`operaciones_renta_variable_${new Date().toISOString().split('T')[0]}.pdf`);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo PDF exportado correctamente'
    });
  }
}
