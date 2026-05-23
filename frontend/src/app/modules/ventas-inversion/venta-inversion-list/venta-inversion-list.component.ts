import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { TableModule, Table } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CalendarModule } from 'primeng/calendar';
import { ConfirmationService, MessageService } from 'primeng/api';
import { VentaInversionService, VentaInversion } from '../../../core/venta-inversion.service';
import { InversionService, Inversion } from '../../../core/inversion.service';
import { CatalogoService } from '../../../core/catalogo.service';
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
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    InputTextModule,
    DropdownModule,
    ButtonModule,
    TagModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    CalendarModule,
    ModalActionsComponent
  ],
  templateUrl: './venta-inversion-list.component.html',
  styleUrl: './venta-inversion-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class VentaInversionListComponent implements OnInit {
  ventas: VentaInversion[] = [];
  inversiones: Inversion[] = [];
  tiposVenta: CatalogoValor[] = [];
  loading = false;
  error = '';
  @ViewChild('dt') dt: Table | undefined;
  totalRecords: number = 0;

  // Filters
  filters = {
    id_inversion: null as number | null,
    id_instrumento: null as number | null,
    fecha_desde: null as Date | null,
    fecha_hasta: null as Date | null
  };

  // Modal properties
  displayDialog: boolean = false;
  isEdit: boolean = false;
  ventaId: number | null = null;
  ventaForm: FormGroup;
  formLoading: boolean = false;
  formError: string = '';

  constructor(
    private ventaService: VentaInversionService,
    private inversionService: InversionService,
    private catalogoService: CatalogoService,
    private fb: FormBuilder,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    this.ventaForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadVentas();
    this.loadInversiones();
    this.loadTiposVenta();
  }

  createForm(): FormGroup {
    return this.fb.group({
      id_inversion: [null, Validators.required],
      id_instrumento: [null],
      id_tipo_venta: [null],
      porcentaje_vendido: [0],
      fecha_venta: [null, Validators.required],
      liquidacion_venta: [''],
      precio_venta: [null, Validators.required],
      precio_neto_venta: [null],
      interes_previo_venta: [null],
      valor_venta_sin_comision: [null],
      comision_operador: [null],
      comision_bolsa: [null],
      valor_venta_con_comision: [null],
      utilidad_sin_comision: [null],
      utilidad_con_comision: [null],
      ganancia_perdida: [null],
      rendimiento_total: [null],
      dias_transcurridos: [null],
      roi: [null],
      ganancia_anual: [null],
      comisiones_santa_fe: [null],
      retenciones: [null],
      observacion: ['']
    });
  }

  loadVentas(): void {
    this.loading = true;
    this.error = '';

    const filters: any = {};
    if (this.filters.id_inversion) filters.id_inversion = this.filters.id_inversion;
    if (this.filters.id_instrumento) filters.id_instrumento = this.filters.id_instrumento;
    if (this.filters.fecha_desde) filters.fecha_desde = this.formatDate(this.filters.fecha_desde);
    if (this.filters.fecha_hasta) filters.fecha_hasta = this.formatDate(this.filters.fecha_hasta);

    this.ventaService.getAll(filters).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.ventas = response.data;
          this.totalRecords = response.data.length;
        } else {
          this.error = response.message || 'Error al cargar ventas';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar ventas: ' + err.message;
        this.loading = false;
      }
    });
  }

  loadInversiones(): void {
    this.inversionService.getAll().subscribe({
      next: (data) => {
        this.inversiones = data;
      }
    });
  }

  loadTiposVenta(): void {
    this.catalogoService.getValoresByCatalogo(16).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.tiposVenta = response.data;
        }
      }
    });
  }

  applyFilters(): void {
    this.loadVentas();
  }

  clearFilters(): void {
    this.filters = {
      id_inversion: null,
      id_instrumento: null,
      fecha_desde: null,
      fecha_hasta: null
    };
    this.loadVentas();
  }

  openCreateDialog(): void {
    this.isEdit = false;
    this.ventaId = null;
    this.ventaForm = this.createForm();
    this.displayDialog = true;
    this.formError = '';
  }

  openEditDialog(venta: VentaInversion): void {
    this.isEdit = true;
    this.ventaId = venta.id_venta_inversion || null;
    this.ventaForm = this.createForm();
    this.ventaForm.patchValue({
      id_inversion: venta.id_inversion,
      id_instrumento: venta.id_instrumento,
      id_tipo_venta: venta.id_tipo_venta,
      porcentaje_vendido: venta.porcentaje_vendido,
      fecha_venta: venta.fecha_venta ? new Date(venta.fecha_venta) : null,
      liquidacion_venta: venta.liquidacion_venta,
      precio_venta: venta.precio_venta,
      precio_neto_venta: venta.precio_neto_venta,
      interes_previo_venta: venta.interes_previo_venta,
      valor_venta_sin_comision: venta.valor_venta_sin_comision,
      comision_operador: venta.comision_operador,
      comision_bolsa: venta.comision_bolsa,
      valor_venta_con_comision: venta.valor_venta_con_comision,
      utilidad_sin_comision: venta.utilidad_sin_comision,
      utilidad_con_comision: venta.utilidad_con_comision,
      ganancia_perdida: venta.ganancia_perdida,
      rendimiento_total: venta.rendimiento_total,
      dias_transcurridos: venta.dias_transcurridos,
      roi: venta.roi,
      ganancia_anual: venta.ganancia_anual,
      comisiones_santa_fe: venta.comisiones_santa_fe,
      retenciones: venta.retenciones,
      observacion: venta.observacion
    });
    this.displayDialog = true;
    this.formError = '';
  }

  save(): void {
    if (this.ventaForm.invalid) {
      this.formError = 'Por favor complete los campos requeridos';
      return;
    }

    this.formLoading = true;
    this.formError = '';

    const ventaData = {
      ...this.ventaForm.value,
      fecha_venta: this.formatDate(this.ventaForm.value.fecha_venta)
    };

    if (this.isEdit && this.ventaId) {
      this.ventaService.update(this.ventaId, ventaData).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Venta actualizada correctamente' });
            this.displayDialog = false;
            this.loadVentas();
          } else {
            this.formError = response.message || 'Error al actualizar venta';
          }
          this.formLoading = false;
        },
        error: (err) => {
          this.formError = 'Error al actualizar venta: ' + err.message;
          this.formLoading = false;
        }
      });
    } else {
      this.ventaService.create(ventaData).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Venta registrada correctamente' });
            this.displayDialog = false;
            this.loadVentas();
          } else {
            this.formError = response.message || 'Error al registrar venta';
          }
          this.formLoading = false;
        },
        error: (err) => {
          this.formError = 'Error al registrar venta: ' + err.message;
          this.formLoading = false;
        }
      });
    }
  }

  deleteVenta(venta: VentaInversion): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de eliminar la venta del ${venta.fecha_venta}?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        if (venta.id_venta_inversion) {
          this.ventaService.delete(venta.id_venta_inversion).subscribe({
            next: (response) => {
              if (response.success) {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Venta eliminada correctamente' });
                this.loadVentas();
              } else {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: response.message || 'Error al eliminar venta' });
              }
            },
            error: (err) => {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar venta: ' + err.message });
            }
          });
        }
      }
    });
  }

  formatDate(date: Date | string | null): string | null {
    if (!date) return null;
    if (typeof date === 'string') return date;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getUtilidadClass(utilidad: number | undefined): 'success' | 'danger' | 'info' | 'warning' | 'secondary' | 'contrast' {
    if (!utilidad) return 'info';
    return utilidad >= 0 ? 'success' : 'danger';
  }
}
