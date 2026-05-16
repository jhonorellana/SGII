import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { OtroValorService, OtroValor, CreateOtroValorRequest, UpdateOtroValorRequest } from '../../../core/otro-valor.service';
import { GrupoFamiliarService } from '../../../core/grupo-familiar.service';
import { PersonaService } from '../../../core/persona.service';
import { AuthService } from '../../../core/auth.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-otros-valores-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    InputTextModule,
    ButtonModule,
    TagModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    DropdownModule,
    CalendarModule,
    InputNumberModule,
    CheckboxModule,
    ProgressSpinnerModule,
    TooltipModule
  ],
  templateUrl: './otros-valores-list.component.html',
  styleUrl: './otros-valores-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class OtrosValoresListComponent implements OnInit, OnDestroy {
  valores: OtroValor[] = [];
  filteredValores: OtroValor[] = [];
  tipos: any[] = [];
  gruposFamiliares: any[] = [];
  personas: any[] = [];

  loading = false;
  error = '';

  // Filtros
  idGrupoFilter: number | null = null;
  idPropietarioFilter: number | null = null;
  idTipoFilter: number | null = null;
  soloVigentesFilter: boolean = false;

  @ViewChild('dt') table: any;
  private routeSub: Subscription;

  // Modal properties
  displayDialog: boolean = false;
  isEdit: boolean = false;
  valorId: number | null = null;
  valorForm: FormGroup;
  formLoading: boolean = false;
  formError: string = '';

  // Resumen
  totalActivos: number = 0;
  totalPasivos: number = 0;
  patrimonioNeto: number = 0;

  // Usuario actual
  currentUser: any = null;

  constructor(
    private fb: FormBuilder,
    private otroValorService: OtroValorService,
    private grupoFamiliarService: GrupoFamiliarService,
    private personaService: PersonaService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    this.routeSub = new Subscription();
    this.valorForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadInitialData();
    this.loadValores();
  }

  loadCurrentUser(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  createForm(): FormGroup {
    return this.fb.group({
      id_grupo_familiar: [null, [Validators.required]],
      id_propietario: [null],
      id_tipo_otro_valor: [null, [Validators.required]],
      descripcion: ['', [Validators.required, Validators.maxLength(255)]],
      valor: [0, [Validators.required]],
      fecha_desde: [null],
      fecha_hasta: [null],
      activo: [true]
    });
  }

  async loadInitialData(): Promise<void> {
    try {
      // Cargar tipos de valores
      this.otroValorService.getTipos().subscribe({
        next: (response) => {
          if (response.success) {
            this.tipos = response.data || [];
          }
        },
        error: (error) => {
          console.error('Error cargando tipos:', error);
        }
      });

      // Cargar grupos familiares desde la API
      this.grupoFamiliarService.getGruposFamiliares().subscribe({
        next: (response) => {
          if (response.success) {
            this.gruposFamiliares = response.data || [];
          }
        },
        error: (error) => {
          console.error('Error cargando grupos familiares:', error);
        }
      });

      // Cargar personas desde la API
      this.personaService.getAll().subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.personas = response.data.map(p => ({
              id: p.id_persona,
              nombre_completo: `${p.nombres} ${p.apellidos}`
            })) || [];
          }
        },
        error: (error) => {
          console.error('Error cargando personas:', error);
        }
      });

    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
    }
  }

  loadValores(): void {
    this.loading = true;
    this.error = '';

    const params: any = {};
    if (this.idGrupoFilter) params.id_grupo_familiar = this.idGrupoFilter;
    if (this.idPropietarioFilter) params.id_propietario = this.idPropietarioFilter;
    if (this.idTipoFilter) params.id_tipo_otro_valor = this.idTipoFilter;
    if (this.soloVigentesFilter) params.vigentes = true;

    this.otroValorService.getOtrosValores(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.valores = response.data || [];
          this.filteredValores = [...this.valores];
          this.calcularResumen();
        } else {
          this.error = response.message || 'Error al cargar los valores';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Error de conexión al servidor';
        this.loading = false;
      }
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.valorId = null;
    this.valorForm = this.createForm();

    // Establecer valores por defecto basados en el usuario actual
    const defaultValues: any = { activo: true };

    if (this.currentUser?.persona) {
      defaultValues.id_propietario = this.currentUser.persona.id_persona;
    }

    // Buscar el grupo familiar donde esta persona es patriarca
    if (this.currentUser?.persona) {
      const grupoFamiliarPatriarca = this.gruposFamiliares.find(gf => gf.id_patriarca === this.currentUser.persona.id_persona);
      if (grupoFamiliarPatriarca) {
        defaultValues.id_grupo_familiar = grupoFamiliarPatriarca.id_grupo_familiar;
      }
    }

    this.valorForm.patchValue(defaultValues);
    this.formError = '';
    this.displayDialog = true;
  }

  openEdit(valor: OtroValor): void {
    this.isEdit = true;
    this.valorId = valor.id_otro_valor;
    this.valorForm.patchValue({
      id_grupo_familiar: valor.id_grupo_familiar,
      id_propietario: valor.id_propietario,
      id_tipo_otro_valor: valor.id_tipo_otro_valor,
      descripcion: valor.descripcion,
      valor: valor.valor,
      fecha_desde: valor.fecha_desde ? new Date(valor.fecha_desde) : null,
      fecha_hasta: valor.fecha_hasta ? new Date(valor.fecha_hasta) : null,
      activo: valor.activo
    });
    this.formError = '';
    this.displayDialog = true;
  }

  hideDialog(): void {
    this.displayDialog = false;
    this.valorForm.reset();
    this.formError = '';
  }

  save(): void {
    if (this.valorForm.invalid) {
      this.markFormAsDirty();
      return;
    }

    this.formLoading = true;
    this.formError = '';

    const formData = this.valorForm.value;

    // Formatear fechas
    if (formData.fecha_desde) {
      formData.fecha_desde = formData.fecha_desde.toISOString().split('T')[0];
    }
    if (formData.fecha_hasta) {
      formData.fecha_hasta = formData.fecha_hasta.toISOString().split('T')[0];
    }

    if (this.isEdit && this.valorId) {
      this.updateValor(this.valorId, formData);
    } else {
      this.createValor(formData);
    }
  }

  createValor(data: CreateOtroValorRequest): void {
    this.otroValorService.createOtroValor(data).subscribe({
      next: (response) => {
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Valor creado exitosamente'
          });
          this.hideDialog();
          this.loadValores();
        } else {
          this.formError = response.message || 'Error al crear el valor';
        }
        this.formLoading = false;
      },
      error: (err) => {
        if (err.error && err.error.errors) {
          this.formError = this.formatValidationErrors(err.error.errors);
        } else {
          this.formError = 'Error de conexión al servidor';
        }
        this.formLoading = false;
      }
    });
  }

  updateValor(id: number, data: UpdateOtroValorRequest): void {
    this.otroValorService.updateOtroValor(id, data).subscribe({
      next: (response) => {
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Valor actualizado exitosamente'
          });
          this.hideDialog();
          this.loadValores();
        } else {
          this.formError = response.message || 'Error al actualizar el valor';
        }
        this.formLoading = false;
      },
      error: (err) => {
        if (err.error && err.error.errors) {
          this.formError = this.formatValidationErrors(err.error.errors);
        } else {
          this.formError = 'Error de conexión al servidor';
        }
        this.formLoading = false;
      }
    });
  }

  deleteValor(id: number): void {
    this.confirmationService.confirm({
      message: '¿Está seguro de eliminar este valor?',
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.otroValorService.deleteOtroValor(id).subscribe({
          next: (response) => {
            if (response.success) {
              this.messageService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Valor eliminado exitosamente'
              });
              this.loadValores();
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: response.message || 'Error al eliminar el valor'
              });
            }
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error de conexión al servidor'
            });
          }
        });
      }
    });
  }

  toggleActive(valor: OtroValor): void {
    const action = valor.activo ? 'desactivar' : 'activar';
    this.confirmationService.confirm({
      message: `¿Está seguro de ${action} este valor?`,
      header: `Confirmar ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.otroValorService.toggleActiveOtroValor(valor.id_otro_valor).subscribe({
          next: (response) => {
            if (response.success) {
              this.messageService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: `Valor ${action}do exitosamente`
              });
              this.loadValores();
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: response.message || `Error al ${action} el valor`
              });
            }
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error de conexión al servidor'
            });
          }
        });
      }
    });
  }

  calcularResumen(): void {
    this.totalActivos = this.otroValorService.calcularActivos(this.filteredValores);
    this.totalPasivos = this.otroValorService.calcularPasivos(this.filteredValores);
    this.patrimonioNeto = this.otroValorService.calcularPatrimonio(this.filteredValores);
  }

  private markFormAsDirty(): void {
    Object.keys(this.valorForm.controls).forEach(key => {
      this.valorForm.get(key)?.markAsDirty();
    });
  }

  private formatValidationErrors(errors: any): string {
    const errorMessages = [];
    for (const field in errors) {
      if (errors[field]) {
        errorMessages.push(errors[field].join(', '));
      }
    }
    return errorMessages.join('. ');
  }

  get f() {
    return this.valorForm.controls;
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  onGlobalFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.filteredValores = this.valores.filter(item =>
      item.descripcion?.toLowerCase().includes(value.toLowerCase()) ||
      item.grupoFamiliarNombre?.toLowerCase().includes(value.toLowerCase()) ||
      item.propietarioNombre?.toLowerCase().includes(value.toLowerCase()) ||
      item.tipoNombre?.toLowerCase().includes(value.toLowerCase())
    );
  }

  onActivoFilterChange(value: string): void {
    if (value === '') {
      this.applyFilters();
    } else {
      const activo = value === '1';
      this.filteredValores = this.valores.filter(item => item.activo === activo);
    }
  }

  applyFilters(): void {
    this.loadValores();
  }

  clearFilters(): void {
    this.idGrupoFilter = null;
    this.idPropietarioFilter = null;
    this.idTipoFilter = null;
    this.soloVigentesFilter = false;
    this.loadValores();
  }

  trackByValorId(index: number, valor: OtroValor): number {
    return valor.id_otro_valor;
  }

  getTipoClaseCss(valor: number): string {
    return this.otroValorService.getTipoClaseCss(valor);
  }

  formatValor(valor: number): string {
    return this.otroValorService.formatValor(valor);
  }

  formatDate(fecha: string | null): string {
    if (!fecha) return 'N/A';
    const date = new Date(fecha);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  exportToExcel(): void {
    const dataToExport = this.table.filteredValue || this.valores;
    const exportData = dataToExport.map((valor: OtroValor) => ({
      ID: valor.id_otro_valor,
      'Grupo Familiar': valor.grupoFamiliarNombre || 'N/A',
      Propietario: valor.propietarioNombre || 'N/A',
      Tipo: valor.tipoNombre || 'N/A',
      Descripción: valor.descripcion,
      Valor: valor.valor,
      'Fecha Desde': valor.fecha_desde || 'N/A',
      'Fecha Hasta': valor.fecha_hasta || 'N/A',
      Estado: valor.activo ? 'Activo' : 'Inactivo'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Otros Valores');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `otros_valores_${new Date().toISOString().split('T')[0]}.xlsx`;

    saveAs(blob, fileName);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo Excel exportado correctamente'
    });
  }

  exportToPDF(): void {
    const dataToExport = this.table.filteredValue || this.valores;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Reporte de Otros Valores', 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);

    doc.text(`Total Activos: ${this.formatValor(this.totalActivos)}`, 14, 40);
    doc.text(`Total Pasivos: ${this.formatValor(this.totalPasivos)}`, 14, 47);
    doc.text(`Patrimonio Neto: ${this.formatValor(this.patrimonioNeto)}`, 14, 54);

    const tableData = dataToExport.map((valor: OtroValor) => [
      valor.id_otro_valor,
      valor.grupoFamiliarNombre || 'N/A',
      valor.propietarioNombre || 'N/A',
      valor.tipoNombre || 'N/A',
      valor.descripcion,
      valor.valor.toString(),
      valor.fecha_desde || 'N/A',
      valor.fecha_hasta || 'N/A',
      valor.activo ? 'Activo' : 'Inactivo'
    ]);

    autoTable(doc, {
      head: [['ID', 'Grupo', 'Propietario', 'Tipo', 'Descripción', 'Valor', 'Desde', 'Hasta', 'Estado']],
      body: tableData,
      startY: 65,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [97, 178, 125] }
    });

    doc.save(`otros_valores_${new Date().toISOString().split('T')[0]}.pdf`);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo PDF exportado correctamente'
    });
  }
}
