import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CatalogoService, Catalogo, CreateCatalogoRequest, UpdateCatalogoRequest } from '../../../core/catalogo.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-catalogo-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule, TableModule, InputTextModule, ButtonModule, TagModule, DialogModule, ToastModule, ConfirmDialogModule],
  templateUrl: './catalogo-list.component.html',
  styleUrl: './catalogo-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class CatalogoListComponent implements OnInit {
  catalogos: Catalogo[] = [];
  filteredCatalogos: Catalogo[] = [];
  loading = false;
  error = '';
  @ViewChild('dt') table: any;
  activoFilter: string = '';

  // Modal properties
  displayDialog: boolean = false;
  isEdit: boolean = false;
  catalogoId: number | null = null;
  catalogoForm: FormGroup;
  formLoading: boolean = false;
  formError: string = '';

  constructor(
    private catalogoService: CatalogoService,
    private fb: FormBuilder,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    this.catalogoForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadCatalogos();
  }

  createForm(): FormGroup {
    return this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      codigo: ['', [Validators.required, Validators.maxLength(50)]],
      descripcion: ['', Validators.maxLength(255)],
      activo: [true]
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.catalogoId = null;
    this.catalogoForm.reset({ activo: true });
    this.formError = '';
    this.displayDialog = true;
  }

  openEdit(catalogo: Catalogo): void {
    this.isEdit = true;
    this.catalogoId = catalogo.id_catalogo;
    this.catalogoForm.patchValue({
      nombre: catalogo.nombre,
      codigo: catalogo.codigo,
      descripcion: catalogo.descripcion || '',
      activo: catalogo.activo === 1
    });
    this.formError = '';
    this.displayDialog = true;
  }

  hideDialog(): void {
    this.displayDialog = false;
    this.catalogoForm.reset();
    this.formError = '';
  }

  save(): void {
    if (this.catalogoForm.invalid) {
      this.markFormAsDirty();
      return;
    }

    this.formLoading = true;
    this.formError = '';

    const formData = this.catalogoForm.value;

    if (this.isEdit && this.catalogoId) {
      this.updateCatalogo(this.catalogoId, formData);
    } else {
      this.createCatalogo(formData);
    }
  }

  createCatalogo(data: CreateCatalogoRequest): void {
    this.catalogoService.createCatalogo(data).subscribe({
      next: (response) => {
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Catálogo creado exitosamente'
          });
          this.hideDialog();
          this.loadCatalogos();
        } else {
          this.formError = response.message || 'Error al crear el catálogo';
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

  updateCatalogo(id: number, data: UpdateCatalogoRequest): void {
    this.catalogoService.updateCatalogo(id, data).subscribe({
      next: (response) => {
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Catálogo actualizado exitosamente'
          });
          this.hideDialog();
          this.loadCatalogos();
        } else {
          this.formError = response.message || 'Error al actualizar el catálogo';
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

  private markFormAsDirty(): void {
    Object.keys(this.catalogoForm.controls).forEach(key => {
      this.catalogoForm.get(key)?.markAsDirty();
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
    return this.catalogoForm.controls;
  }

  loadCatalogos(): void {
    this.loading = true;
    this.error = '';

    this.catalogoService.getCatalogos().subscribe({
      next: (response) => {
        if (response.success) {
          this.catalogos = response.data || [];
          this.filteredCatalogos = [...this.catalogos];
        } else {
          this.error = 'Error al cargar los catálogos';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('[CatalogoList] Error:', err);
        this.error = 'Error de conexión al servidor';
        this.loading = false;
      }
    });
  }

  onGlobalFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.table.filterGlobal(value, 'contains');
  }

  onActivoFilterChange(value: string): void {
    this.activoFilter = value;
    if (value === '') {
      this.filteredCatalogos = [...this.catalogos];
    } else {
      const activoValue = Number(value);
      this.filteredCatalogos = this.catalogos.filter(c => c.activo === activoValue);
    }
  }

  deleteCatalogo(id: number): void {
    this.confirmationService.confirm({
      message: '¿Está seguro de desactivar este catálogo?',
      header: 'Confirmar Desactivación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.catalogoService.deleteCatalogo(id).subscribe({
          next: (response) => {
            if (response.success) {
              this.messageService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Catálogo desactivado exitosamente'
              });
              this.loadCatalogos();
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: response.message || 'Error al desactivar el catálogo'
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

  trackByCatalogoId(index: number, catalogo: Catalogo): number {
    return catalogo.id_catalogo;
  }

  exportToExcel(): void {
    const dataToExport = this.table.filteredValue || this.catalogos;
    const exportData = dataToExport.map((catalogo: Catalogo) => ({
      ID: catalogo.id_catalogo,
      Código: catalogo.codigo,
      Nombre: catalogo.nombre,
      Descripción: catalogo.descripcion || '',
      Estado: catalogo.activo === 1 ? 'Activo' : 'Inactivo',
      'N° Valores': catalogo.valores?.length || 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Catálogos');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `catálogos_${new Date().toISOString().split('T')[0]}.xlsx`;

    saveAs(blob, fileName);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo Excel exportado correctamente'
    });
  }
}
