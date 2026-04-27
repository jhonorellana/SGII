import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { EmisorService } from '../../../core/emisor.service';
import { CatalogoService } from '../../../core/catalogo.service';
import { ModalActionsComponent } from '../../../core/modal-actions';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Emisor {
  id_emisor: number;
  nombre: string;
  sigla: string;
  identificacion: string;
  id_tipo_emisor: number | null;
  tipo_emisor?: any;
  activo: number | boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

interface EmisorRequest {
  nombre: string;
  sigla: string;
  identificacion: string;
  id_tipo_emisor?: number;
  activo?: boolean;
}

@Component({
  selector: 'app-emisor-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule, InputTextModule, DropdownModule, ButtonModule, TagModule, DialogModule, ToastModule, ConfirmDialogModule, ModalActionsComponent],
  templateUrl: './emisor-list.component.html',
  styleUrl: './emisor-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class EmisorListComponent implements OnInit {
  emisores: Emisor[] = [];
  filteredEmisores: Emisor[] = [];
  tiposEmisor: any[] = [];
  loading = false;
  error = '';
  @ViewChild('dt') table: any;
  activoFilter: string = '';

  // Modal properties
  displayDialog: boolean = false;
  isEdit: boolean = false;
  emisorId: number | null = null;
  emisorForm: FormGroup;
  formLoading: boolean = false;
  formError: string = '';

  constructor(
    private emisorService: EmisorService,
    private catalogoService: CatalogoService,
    private fb: FormBuilder,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    this.emisorForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadEmisores();
    this.loadTiposEmisor();
  }

  createForm(): FormGroup {
    return this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(255)]],
      sigla: ['', [Validators.required, Validators.maxLength(50)]],
      identificacion: ['', Validators.maxLength(50)],
      id_tipo_emisor: [null, Validators.required],
      activo: [true]
    });
  }

  loadEmisores(): void {
    this.loading = true;
    this.error = '';
    this.emisorService.getEmisores().subscribe({
      next: (response) => {
        if (response.success) {
          this.emisores = response.data;
          this.filteredEmisores = response.data;
        } else {
          this.error = response.message || 'Error al cargar emisores';
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Error de conexión al servidor';
        this.loading = false;
      }
    });
  }

  loadTiposEmisor(): void {
    this.catalogoService.getCatalogos().subscribe({
      next: (response: any) => {
        if (response.success) {
          const catalogo = response.data.find((c: any) => c.codigo === 'TIPO_EMISOR');
          if (catalogo) {
            this.catalogoService.getValoresByCatalogo(catalogo.id_catalogo).subscribe({
              next: (valoresResponse: any) => {
                if (valoresResponse.success) {
                  this.tiposEmisor = valoresResponse.data.map((v: any) => ({
                    id_catalogo_valor: v.id_catalogo_valor,
                    label: v.nombre,
                    codigo: v.codigo
                  }));
                }
              }
            });
          }
        }
      },
      error: () => {
        console.error('Error al cargar tipos de emisor');
      }
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.emisorId = null;
    this.emisorForm = this.createForm();
    this.displayDialog = true;
    this.formError = '';
  }

  openEdit(emisor: Emisor): void {
    this.isEdit = true;
    this.emisorId = emisor.id_emisor;
    this.emisorForm = this.fb.group({
      nombre: [emisor.nombre, [Validators.required, Validators.maxLength(255)]],
      sigla: [emisor.sigla, [Validators.required, Validators.maxLength(50)]],
      identificacion: [emisor.identificacion || '', Validators.maxLength(50)],
      id_tipo_emisor: [emisor.id_tipo_emisor, Validators.required],
      activo: [emisor.activo === 1]
    });
    this.displayDialog = true;
    this.formError = '';
  }

  save(): void {
    if (this.emisorForm.invalid) {
      this.emisorForm.markAllAsTouched();
      return;
    }

    this.formLoading = true;
    this.formError = '';

    const data: EmisorRequest = {
      nombre: this.emisorForm.value.nombre,
      sigla: this.emisorForm.value.sigla,
      identificacion: this.emisorForm.value.identificacion,
      id_tipo_emisor: this.emisorForm.value.id_tipo_emisor || undefined,
      activo: this.emisorForm.value.activo
    };

    if (this.isEdit && this.emisorId) {
      this.emisorService.updateEmisor(this.emisorId, data).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Emisor actualizado exitosamente'
            });
            this.displayDialog = false;
            this.loadEmisores();
          } else {
            this.formError = response.message || 'Error al actualizar el emisor';
          }
          this.formLoading = false;
        },
        error: () => {
          this.formError = 'Error de conexión al servidor';
          this.formLoading = false;
        }
      });
    } else {
      this.emisorService.createEmisor(data).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Emisor creado exitosamente'
            });
            this.displayDialog = false;
            this.loadEmisores();
          } else {
            this.formError = response.message || 'Error al crear el emisor';
          }
          this.formLoading = false;
        },
        error: () => {
          this.formError = 'Error de conexión al servidor';
          this.formLoading = false;
        }
      });
    }
  }

  delete(emisor: Emisor): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de desactivar el emisor "${emisor.nombre}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.emisorService.deleteEmisor(emisor.id_emisor).subscribe({
          next: (response) => {
            if (response.success) {
              this.messageService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Emisor desactivado exitosamente'
              });
              this.loadEmisores();
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: response.message || 'Error al desactivar el emisor'
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

  onGlobalFilter(event: any): void {
    const value = event.target.value;
    this.table.filterGlobal(value, 'contains');
  }

  onActivoFilterChange(value: string): void {
    this.activoFilter = value;
    if (value === '') {
      this.filteredEmisores = this.emisores;
    } else if (value === '1') {
      this.filteredEmisores = this.emisores.filter(e => e.activo === 1);
    } else if (value === '0') {
      this.filteredEmisores = this.emisores.filter(e => e.activo === 0);
    }
  }

  trackByEmisorId(index: number, emisor: Emisor): number {
    return emisor.id_emisor;
  }

  exportToExcel(): void {
    const dataToExport = this.table.filteredValue || this.emisores;
    const exportData = dataToExport.map((emisor: Emisor) => ({
      ID: emisor.id_emisor,
      Nombre: emisor.nombre,
      Sigla: emisor.sigla,
      Identificación: emisor.identificacion,
      'Tipo Emisor': emisor.tipo_emisor ? emisor.tipo_emisor.nombre : '',
      Estado: emisor.activo === 1 ? 'Activo' : 'Inactivo'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Emisores');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `emisores_${new Date().toISOString().split('T')[0]}.xlsx`;

    saveAs(blob, fileName);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo Excel exportado correctamente'
    });
  }

  exportToPDF(): void {
    const dataToExport = this.table.filteredValue || this.emisores;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Reporte de Emisores', 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = dataToExport.map((emisor: Emisor) => [
      emisor.id_emisor,
      emisor.nombre,
      emisor.sigla,
      emisor.identificacion,
      emisor.tipo_emisor ? emisor.tipo_emisor.nombre : '',
      emisor.activo === 1 ? 'Activo' : 'Inactivo'
    ]);

    autoTable(doc, {
      head: [['ID', 'Nombre', 'Sigla', 'Identificación', 'Tipo Emisor', 'Estado']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [97, 178, 125] }
    });

    doc.save(`emisores_${new Date().toISOString().split('T')[0]}.pdf`);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo PDF exportado correctamente'
    });
  }
}
