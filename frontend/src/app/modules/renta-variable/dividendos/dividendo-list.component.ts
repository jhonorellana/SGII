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

import { AccionDividendoService } from '../../../core/accion-dividendo.service';
import { PersonaService } from '../../../core/persona.service';
import { InstrumentoService } from '../../../core/instrumento.service';
import { CatalogoService } from '../../../core/catalogo.service';
import { CuentaBancariaService, CuentaBancaria } from '../../../core/cuenta-bancaria.service';
import { PaginationService } from '../../../core/pagination.service';
import { AccionDividendo } from '../../../core/models/accion-models';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-dividendo-list',
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
  templateUrl: './dividendo-list.component.html',
  styleUrl: './dividendo-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class DividendoListComponent implements OnInit {
  dividendos: AccionDividendo[] = [];
  personas: any[] = [];
  instrumentos: any[] = [];
  tiposDividendo: any[] = [];
  cuentasBancarias: CuentaBancaria[] = [];
  cuentasFiltradas: any[] = [];
  loading = false;
  error = '';
  @ViewChild('dt') dt: Table | undefined;
  totalRecords: number = 0;
  rowsPerPage: number = 10;

  // Modal properties
  displayDialog: boolean = false;
  isEdit: boolean = false;
  dividendoId: number | null = null;
  dividendoForm!: FormGroup;
  formError: string = '';
  formLoading: boolean = false;

  // Filters
  filters = {
    id_persona: null as number | null,
    id_instrumento: null as number | null,
    id_tipo_dividendo: null as number | null,
    fecha_desde: null as Date | null,
    fecha_hasta: null as Date | null
  };

  cols = [
    { field: 'id_accion_dividendo', header: 'ID' },
    { field: 'fecha_pago', header: 'Fecha Pago' },
    { field: 'persona.nombres', header: 'Socio' },
    { field: 'instrumento.nombre', header: 'Acción' },
    { field: 'tipo_dividendo.nombre', header: 'Tipo Dividendo' },
    { field: 'cantidad_acciones_base', header: 'Acciones Base' },
    { field: 'dividendo_por_accion', header: 'Div. por Acción' },
    { field: 'valor_neto', header: 'Neto Efectivo' },
    { field: 'acciones_recibidas', header: 'Acciones Recibidas' },
    { field: 'acciones', header: 'Acciones' }
  ];

  constructor(
    private fb: FormBuilder,
    private dividendoService: AccionDividendoService,
    private personaService: PersonaService,
    private instrumentoService: InstrumentoService,
    private catalogoService: CatalogoService,
    private cuentaBancariaService: CuentaBancariaService,
    private paginationService: PaginationService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.rowsPerPage = this.paginationService.getRowsPerPage('accionDividendos', 10);
    this.dividendoForm = this.createForm();
    this.loadDividendos();
    this.loadPersonas();
    this.loadInstrumentos();
    this.loadTiposDividendo();
    this.loadCuentasBancarias();
    this.setupFormValueChanges();
  }

  createForm(): FormGroup {
    return this.fb.group({
      id_persona: [null, Validators.required],
      id_instrumento: [null, Validators.required],
      id_tipo_dividendo: [null, Validators.required],
      fecha_declaracion: [null],
      fecha_corte: [null],
      fecha_pago: [new Date(), Validators.required],
      cantidad_acciones_base: [null, [Validators.required, Validators.min(0.000001)]],
      dividendo_por_accion: [0, [Validators.required, Validators.min(0)]],
      valor_bruto: [{ value: 0, disabled: true }, Validators.required],
      retencion: [0, [Validators.required, Validators.min(0)]],
      valor_neto: [{ value: 0, disabled: true }, Validators.required],
      acciones_recibidas: [0, [Validators.min(0)]],
      factor_acciones: [0, [Validators.min(0)]],
      precio_referencial_accion: [0, [Validators.min(0)]],
      valor_referencial_acciones: [{ value: 0, disabled: true }],
      id_cuenta_bancaria: [null],
      observacion: ['', Validators.maxLength(500)]
    });
  }

  loadDividendos(): void {
    this.loading = true;
    const requestFilters = {
      id_persona: this.filters.id_persona || undefined,
      id_instrumento: this.filters.id_instrumento || undefined,
      id_tipo_dividendo: this.filters.id_tipo_dividendo || undefined,
      fecha_desde: this.filters.fecha_desde ? this.formatDate(this.filters.fecha_desde) : undefined,
      fecha_hasta: this.filters.fecha_hasta ? this.formatDate(this.filters.fecha_hasta) : undefined
    };

    this.dividendoService.getAll(requestFilters).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.dividendos = response.data;
          this.totalRecords = this.dividendos.length;
        } else {
          this.dividendos = [];
          this.totalRecords = 0;
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar dividendos: ' + err.message;
        this.loading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los dividendos.' });
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
        this.instrumentos = instrumentosArray
          .filter((i: any) => i.activo === true || i.activo === 1)
          .map((i: any) => ({
            value: i.id_instrumento,
            label: i.nombre || i.codigo_titulo
          }));
      }
    });
  }

  loadTiposDividendo(): void {
    this.catalogoService.getValoresByCatalogo(18).subscribe({
      next: (data: any) => {
        const valoresArray = Array.isArray(data) ? data : (data as any).data || [];
        this.tiposDividendo = valoresArray
          .filter((v: any) => v.activo === true || v.activo === 1)
          .map((v: any) => ({
            value: v.id_catalogo_valor,
            label: v.nombre,
            codigo: v.codigo
          }));
      }
    });
  }

  loadCuentasBancarias(): void {
    this.cuentaBancariaService.getAll().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.cuentasBancarias = response.data;
          this.filtrarCuentasBancarias();
        }
      }
    });
  }

  setupFormValueChanges(): void {
    // Escuchar cambios de cálculo monetario
    const monetaryFields = ['cantidad_acciones_base', 'dividendo_por_accion', 'retencion'];
    monetaryFields.forEach(field => {
      this.dividendoForm.get(field)?.valueChanges.subscribe(() => {
        this.recalcularTotalesMonetarios();
      });
    });

    // Escuchar cambios de cálculo de acciones
    const shareFields = ['acciones_recibidas', 'precio_referencial_accion'];
    shareFields.forEach(field => {
      this.dividendoForm.get(field)?.valueChanges.subscribe(() => {
        this.recalcularTotalesAcciones();
      });
    });

    // Filtrar cuentas bancarias al cambiar de socio
    this.dividendoForm.get('id_persona')?.valueChanges.subscribe(() => {
      this.filtrarCuentasBancarias();
    });

    // Activar/desactivar validaciones dinámicas según tipo de dividendo
    this.dividendoForm.get('id_tipo_dividendo')?.valueChanges.subscribe((tipo) => {
      this.actualizarValidacionesDinamicas(tipo);
    });
  }

  recalcularTotalesMonetarios(): void {
    const cantidadBase = parseFloat(this.dividendoForm.get('cantidad_acciones_base')?.value || 0);
    const divPorAccion = parseFloat(this.dividendoForm.get('dividendo_por_accion')?.value || 0);
    const retencion = parseFloat(this.dividendoForm.get('retencion')?.value || 0);

    const valorBruto = cantidadBase * divPorAccion;
    const valorNeto = valorBruto - retencion;

    this.dividendoForm.patchValue({
      valor_bruto: valorBruto,
      valor_neto: valorNeto >= 0 ? valorNeto : 0
    }, { emitEvent: false });
  }

  recalcularTotalesAcciones(): void {
    const accionesRecibidas = parseFloat(this.dividendoForm.get('acciones_recibidas')?.value || 0);
    const precioRef = parseFloat(this.dividendoForm.get('precio_referencial_accion')?.value || 0);

    const valorRef = accionesRecibidas * precioRef;

    this.dividendoForm.patchValue({
      valor_referencial_acciones: valorRef
    }, { emitEvent: false });
  }

  filtrarCuentasBancarias(): void {
    const idPersona = this.dividendoForm.get('id_persona')?.value;
    if (!idPersona) {
      this.cuentasFiltradas = [];
      return;
    }

    this.cuentasFiltradas = this.cuentasBancarias
      .filter(c => c.id_persona === idPersona && (c.activo === true || c.activo === 1))
      .map(c => ({
        value: c.id_cuenta_bancaria,
        label: `${c.banco?.nombre || 'Banco'} - Cuenta Nº ${c.numero_cuenta || 'S/N'}`
      }));
  }

  actualizarValidacionesDinamicas(idTipoDividendo: number): void {
    const fieldsEfectivo = ['retencion', 'id_cuenta_bancaria'];
    const fieldsAcciones = ['acciones_recibidas', 'precio_referencial_accion'];

    // Efectivo = 209, Acciones = 210, Mixto = 211
    if (idTipoDividendo === 209) {
      // Habilitar campos financieros, deshabilitar acciones
      fieldsEfectivo.forEach(f => this.enableField(f));
      fieldsAcciones.forEach(f => this.disableAndResetField(f));
      this.dividendoForm.get('dividendo_por_accion')?.setValidators([Validators.required, Validators.min(0.000001)]);
      this.dividendoForm.get('id_cuenta_bancaria')?.setValidators([Validators.required]);
    } else if (idTipoDividendo === 210) {
      // Habilitar campos de acciones, deshabilitar financieros
      fieldsAcciones.forEach(f => this.enableField(f));
      fieldsEfectivo.forEach(f => this.disableAndResetField(f));
      this.dividendoForm.get('dividendo_por_accion')?.setValidators([Validators.min(0)]);
      this.dividendoForm.get('dividendo_por_accion')?.setValue(0, { emitEvent: false });
      this.dividendoForm.get('id_cuenta_bancaria')?.setValidators(null);
      this.dividendoForm.get('acciones_recibidas')?.setValidators([Validators.required, Validators.min(0.000001)]);
    } else if (idTipoDividendo === 211) {
      // Habilitar todos
      fieldsEfectivo.forEach(f => this.enableField(f));
      fieldsAcciones.forEach(f => this.enableField(f));
      this.dividendoForm.get('dividendo_por_accion')?.setValidators([Validators.required, Validators.min(0.000001)]);
      this.dividendoForm.get('id_cuenta_bancaria')?.setValidators([Validators.required]);
      this.dividendoForm.get('acciones_recibidas')?.setValidators([Validators.required, Validators.min(0.000001)]);
    }

    // Refrescar validaciones
    this.dividendoForm.get('dividendo_por_accion')?.updateValueAndValidity();
    this.dividendoForm.get('id_cuenta_bancaria')?.updateValueAndValidity();
    this.dividendoForm.get('acciones_recibidas')?.updateValueAndValidity();
    this.recalcularTotalesMonetarios();
    this.recalcularTotalesAcciones();
  }

  private enableField(field: string): void {
    this.dividendoForm.get(field)?.enable({ emitEvent: false });
  }

  private disableAndResetField(field: string): void {
    this.dividendoForm.get(field)?.disable({ emitEvent: false });
    this.dividendoForm.get(field)?.setValue(0, { emitEvent: false });
  }

  isEfectivoHabilitado(): boolean {
    const tipo = this.dividendoForm.get('id_tipo_dividendo')?.value;
    return tipo === 209 || tipo === 211;
  }

  isAccionesHabilitado(): boolean {
    const tipo = this.dividendoForm.get('id_tipo_dividendo')?.value;
    return tipo === 210 || tipo === 211;
  }

  applyFilters(): void {
    this.loadDividendos();
  }

  clearFilters(): void {
    this.filters = {
      id_persona: null,
      id_instrumento: null,
      id_tipo_dividendo: null,
      fecha_desde: null,
      fecha_hasta: null
    };
    this.loadDividendos();
  }

  openCreateDialog(): void {
    this.isEdit = false;
    this.dividendoId = null;
    this.dividendoForm = this.createForm();
    this.setupFormValueChanges();
    this.displayDialog = true;
    this.formError = '';
  }

  openEditDialog(div: AccionDividendo): void {
    this.isEdit = true;
    this.dividendoId = div.id_accion_dividendo || null;
    this.dividendoForm = this.createForm();
    this.setupFormValueChanges();

    this.dividendoForm.patchValue({
      id_persona: div.id_persona,
      id_instrumento: div.id_instrumento,
      id_tipo_dividendo: div.id_tipo_dividendo,
      fecha_declaracion: div.fecha_declaracion ? this.parseDateWithoutTimezone(div.fecha_declaracion) : null,
      fecha_corte: div.fecha_corte ? this.parseDateWithoutTimezone(div.fecha_corte) : null,
      fecha_pago: div.fecha_pago ? this.parseDateWithoutTimezone(div.fecha_pago) : null,
      cantidad_acciones_base: div.cantidad_acciones_base,
      dividendo_por_accion: div.dividendo_por_accion,
      valor_bruto: div.valor_bruto,
      retencion: div.retencion,
      valor_neto: div.valor_neto,
      acciones_recibidas: div.acciones_recibidas || 0,
      factor_acciones: div.factor_acciones || 0,
      precio_referencial_accion: div.precio_referencial_accion || 0,
      valor_referencial_acciones: div.valor_referencial_acciones || 0,
      id_cuenta_bancaria: div.id_cuenta_bancaria,
      observacion: div.observacion || ''
    });

    this.displayDialog = true;
    this.formError = '';
  }

  save(): void {
    if (this.dividendoForm.invalid) {
      this.formError = 'Por favor complete todos los campos requeridos y corrija los errores.';
      return;
    }

    this.formLoading = true;
    this.formError = '';

    const rawValue = this.dividendoForm.getRawValue();
    const payload: AccionDividendo = {
      ...rawValue,
      fecha_declaracion: rawValue.fecha_declaracion ? this.formatDate(rawValue.fecha_declaracion) : null,
      fecha_corte: rawValue.fecha_corte ? this.formatDate(rawValue.fecha_corte) : null,
      fecha_pago: this.formatDate(rawValue.fecha_pago),
      activo: true
    };

    if (this.isEdit && this.dividendoId) {
      this.dividendoService.update(this.dividendoId, payload).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Registro de dividendo actualizado.' });
            this.displayDialog = false;
            this.loadDividendos();
          } else {
            this.formError = response.message || 'Error al actualizar el dividendo.';
          }
          this.formLoading = false;
        },
        error: (err) => {
          this.formError = err.error?.message || 'Error al conectar con la base de datos.';
          this.formLoading = false;
        }
      });
    } else {
      this.dividendoService.create(payload).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Cobro de dividendo registrado.' });
            this.displayDialog = false;
            this.loadDividendos();
          } else {
            this.formError = response.message || 'Error al registrar el dividendo.';
          }
          this.formLoading = false;
        },
        error: (err) => {
          this.formError = err.error?.message || 'Error al registrar el dividendo.';
          this.formLoading = false;
        }
      });
    }
  }

  deleteDividendo(div: AccionDividendo): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de eliminar este cobro de dividendo? Esto anulará el movimiento en caja y el registro de bonificación de acciones correspondientes.`,
      header: 'Confirmar Anulación de Dividendo',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        if (div.id_accion_dividendo) {
          this.loading = true;
          this.dividendoService.delete(div.id_accion_dividendo).subscribe({
            next: (response) => {
              if (response.success) {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Cobro de dividendo eliminado.' });
                this.loadDividendos();
              } else {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: response.message || 'No se pudo eliminar el cobro.' });
                this.loading = false;
              }
            },
            error: (err) => {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al eliminar el dividendo.' });
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

  getPersonaNombre(div: AccionDividendo): string {
    if (!div.persona) return '-';
    return `${div.persona.nombres || ''} ${div.persona.apellidos || ''}`.trim() || '-';
  }

  getTipoDividendoClass(div: AccionDividendo): 'success' | 'danger' | 'info' | 'warning' | 'secondary' | 'contrast' {
    const cod = div.tipo_dividendo?.codigo || div.tipoDividendo?.codigo;
    if (cod === 'DIV_EFECTIVO' || cod === 'Efectivo') return 'success';
    if (cod === 'DIV_ACCIONES' || cod === 'Acciones') return 'info';
    return 'warning'; // Mixto
  }

  getTipoDividendoNombre(div: AccionDividendo): string {
    return div.tipo_dividendo?.nombre || div.tipoDividendo?.nombre || '-';
  }

  onGlobalFilter(event: Event): void {
    if (this.dt) {
      this.dt.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }
  }

  onPageChange(event: any): void {
    this.rowsPerPage = event.rows;
    this.paginationService.setRowsPerPage('accionDividendos', this.rowsPerPage);
  }

  exportToExcel(): void {
    const dataToExport = this.dt?.filteredValue || this.dividendos;
    const exportData = dataToExport.map(div => ({
      ID: div.id_accion_dividendo,
      Socio: this.getPersonaNombre(div),
      Acción: div.instrumento?.nombre || '-',
      Tipo: this.getTipoDividendoNombre(div),
      'Fecha Declaración': this.formatDate(div.fecha_declaracion),
      'Fecha Pago': this.formatDate(div.fecha_pago),
      'Acciones Base': div.cantidad_acciones_base,
      'Div. por Acción': div.dividendo_por_accion,
      'Valor Neto Efectivo': div.valor_neto,
      'Acciones Recibidas': div.acciones_recibidas || 0,
      Observación: div.observacion || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dividendos RV');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `dividendos_renta_variable_${new Date().toISOString().split('T')[0]}.xlsx`;

    saveAs(blob, fileName);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo Excel exportado correctamente'
    });
  }

  exportToPDF(): void {
    const dataToExport = this.dt?.filteredValue || this.dividendos;
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Historial de Dividendos - Renta Variable', 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = dataToExport.map(div => [
      div.id_accion_dividendo,
      this.formatDate(div.fecha_pago),
      this.getPersonaNombre(div),
      div.instrumento?.nombre || '-',
      this.getTipoDividendoNombre(div),
      this.formatNumber(div.cantidad_acciones_base, 2),
      this.formatCurrency(div.dividendo_por_accion),
      this.formatCurrency(div.valor_neto),
      this.formatNumber(div.acciones_recibidas || 0, 4),
      this.formatCurrency(div.valor_referencial_acciones || 0)
    ]);

    autoTable(doc, {
      head: [['ID', 'F. Pago', 'Socio', 'Acción', 'Tipo', 'Acc. Base', 'Div. por Acción', 'Neto Efectivo', 'Acc. Recibidas', 'Valor Ref. Acc.']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [46, 139, 87] } // SeaGreen standard for dividends
    });

    doc.save(`dividendos_renta_variable_${new Date().toISOString().split('T')[0]}.pdf`);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo PDF exportado correctamente'
    });
  }
}
