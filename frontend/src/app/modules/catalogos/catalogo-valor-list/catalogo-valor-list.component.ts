import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CatalogoService, Catalogo, CatalogoValor } from '../../../core/catalogo.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-catalogo-valor-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule, TableModule, InputTextModule, ButtonModule, TagModule, DialogModule, ToastModule, ConfirmDialogModule],
  templateUrl: './catalogo-valor-list.component.html',
  styleUrl: './catalogo-valor-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class CatalogoValorListComponent implements OnInit, OnDestroy {
  valores: CatalogoValor[] = [];
  filteredValores: CatalogoValor[] = [];
  catalogo: Catalogo | null = null;
  catalogoId: number | null = null;
  loading = false;
  error = '';
  activoFilter: string = '';
  @ViewChild('dt') table: any;
  private routeSub: Subscription;

  // Modal properties
  displayDialog: boolean = false;
  isEdit: boolean = false;
  valorId: number | null = null;
  valorForm: FormGroup;
  formLoading: boolean = false;
  formError: string = '';

  constructor(
    private catalogoService: CatalogoService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    this.routeSub = new Subscription();
    this.valorForm = this.createForm();
  }

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe(params => {
      if (params['id']) {
        this.catalogoId = +params['id'];
        this.loadCatalogo();
        this.loadValores();
      }
    });
  }

  createForm(): FormGroup {
    return this.fb.group({
      codigo: ['', [Validators.required, Validators.maxLength(20)]],
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      descripcion: ['', Validators.maxLength(255)],
      orden_visual: [1, [Validators.required, Validators.min(1)]],
      activo: [true]
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.valorId = null;
    this.valorForm.reset({ activo: true, orden_visual: 1 });
    this.formError = '';
    this.displayDialog = true;
  }

  openEdit(valor: CatalogoValor): void {
    this.isEdit = true;
    this.valorId = valor.id_catalogo_valor;
    this.valorForm.patchValue({
      codigo: valor.codigo,
      nombre: valor.nombre,
      descripcion: valor.descripcion || '',
      orden_visual: valor.orden_visual,
      activo: valor.activo === 1
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
    const valorData = {
      ...formData,
      id_catalogo: this.catalogoId
    };

    if (this.isEdit && this.valorId) {
      this.updateValor(this.valorId, valorData);
    } else {
      this.createValor(valorData);
    }
  }

  createValor(data: any): void {
    this.catalogoService.createCatalogoValorById(data).subscribe({
      next: (response) => {
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Valor de catálogo creado exitosamente'
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

  updateValor(id: number, data: any): void {
    this.catalogoService.updateCatalogoValorById(id, data).subscribe({
      next: (response) => {
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Valor de catálogo actualizado exitosamente'
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

  loadCatalogo(): void {
    if (!this.catalogoId) return;

    this.catalogoService.getCatalogo(this.catalogoId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.catalogo = response.data;
        }
      },
      error: () => {
        console.error('Error al cargar el catálogo');
      }
    });
  }

  loadValores(): void {
    if (!this.catalogoId) return;

    this.loading = true;
    this.error = '';

    this.catalogoService.getValoresByCatalogo(this.catalogoId).subscribe({
      next: (response) => {
        if (response.success) {
          this.valores = response.data || [];
          this.filteredValores = [...this.valores];
        } else {
          this.error = 'Error al cargar los valores del catálogo';
        }
        this.loading = false;
      },
      error: () => {
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
      this.filteredValores = [...this.valores];
    } else {
      const activoValue = Number(value);
      this.filteredValores = this.valores.filter(v => v.activo === activoValue);
    }
  }

  deleteValor(id: number): void {
    this.confirmationService.confirm({
      message: '¿Está seguro de desactivar este valor del catálogo?',
      header: 'Confirmar Desactivación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.catalogoService.deleteCatalogoValor(id).subscribe({
          next: (response) => {
            if (response.success) {
              this.messageService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Valor desactivado exitosamente'
              });
              this.loadValores();
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: response.message || 'Error al desactivar el valor'
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

  toggleActive(valor: CatalogoValor): void {
    const action = valor.activo === 1 ? 'desactivar' : 'activar';
    if (confirm(`¿Está seguro de ${action} este valor del catálogo?`)) {
      this.catalogoService.toggleActiveCatalogoValor(valor.id_catalogo_valor).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadValores();
          } else {
            alert(response.message || 'Error al cambiar estado del valor');
          }
        },
        error: () => {
          alert('Error de conexión al servidor');
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/catalogos']);
  }

  trackByValorId(index: number, valor: CatalogoValor): number {
    return valor.id_catalogo_valor;
  }

  get activosCount(): number {
    return this.filteredValores.filter(v => v.activo === 1).length;
  }

  get inactivosCount(): number {
    return this.filteredValores.filter(v => v.activo === 0).length;
  }

  exportToExcel(): void {
    const dataToExport = this.table.filteredValue || this.valores;
    const exportData = dataToExport.map((valor: CatalogoValor) => ({
      ID: valor.id_catalogo_valor,
      Código: valor.codigo,
      Nombre: valor.nombre,
      Descripción: valor.descripcion || '',
      Estado: valor.activo === 1 ? 'Activo' : 'Inactivo'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Valores del Catálogo');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `valores_catálogo_${new Date().toISOString().split('T')[0]}.xlsx`;

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
    doc.text('Reporte de Valores del Catálogo', 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = dataToExport.map((valor: CatalogoValor) => [
      valor.id_catalogo_valor,
      valor.codigo,
      valor.nombre,
      valor.descripcion || '',
      valor.activo === 1 ? 'Activo' : 'Inactivo'
    ]);

    autoTable(doc, {
      head: [['ID', 'Código', 'Nombre', 'Descripción', 'Estado']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [97, 178, 125] }
    });

    doc.save(`valores_catálogo_${new Date().toISOString().split('T')[0]}.pdf`);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo PDF exportado correctamente'
    });
  }
}
