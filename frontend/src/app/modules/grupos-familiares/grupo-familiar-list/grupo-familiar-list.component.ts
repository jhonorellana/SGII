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
import { GrupoFamiliarService } from '../../../core/grupo-familiar.service';
import { PersonaService } from '../../../core/persona.service';
import { ModalActionsComponent } from '../../../core/modal-actions';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface GrupoFamiliar {
  id_grupo_familiar: number;
  nombre: string;
  descripcion: string | null;
  id_patriarca: number | null;
  patriarca?: any;
  activo: number | boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

interface GrupoFamiliarRequest {
  nombre: string;
  descripcion?: string;
  id_patriarca?: number;
  activo?: boolean;
}

@Component({
  selector: 'app-grupo-familiar-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule, InputTextModule, DropdownModule, ButtonModule, TagModule, DialogModule, ToastModule, ConfirmDialogModule, ModalActionsComponent],
  templateUrl: './grupo-familiar-list.component.html',
  styleUrl: './grupo-familiar-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class GrupoFamiliarListComponent implements OnInit {
  gruposFamiliares: GrupoFamiliar[] = [];
  filteredGruposFamiliares: GrupoFamiliar[] = [];
  personas: any[] = [];
  loading = false;
  error = '';
  @ViewChild('dt') table: any;
  activoFilter: string = '';

  // Modal properties
  displayDialog: boolean = false;
  isEdit: boolean = false;
  grupoFamiliarId: number | null = null;
  grupoFamiliarForm: FormGroup;
  formLoading: boolean = false;
  formError: string = '';

  constructor(
    private grupoFamiliarService: GrupoFamiliarService,
    private personaService: PersonaService,
    private fb: FormBuilder,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    this.grupoFamiliarForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadGruposFamiliares();
    this.loadPersonas();
  }

  loadPersonas(): void {
    this.personaService.getAll().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.personas = response.data.map((p: any) => ({
            id_persona: p.id_persona,
            label: `${p.apellidos} ${p.nombres}`,
            apellidos: p.apellidos,
            nombres: p.nombres
          }));
        }
      },
      error: () => {
        console.error('Error al cargar personas');
      }
    });
  }

  createForm(): FormGroup {
    return this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(255)]],
      descripcion: [''],
      id_patriarca: [null],
      activo: [true]
    });
  }

  loadGruposFamiliares(): void {
    this.loading = true;
    this.error = '';
    this.grupoFamiliarService.getGruposFamiliares().subscribe({
      next: (response) => {
        if (response.success) {
          this.gruposFamiliares = response.data;
          this.filteredGruposFamiliares = response.data;
        } else {
          this.error = response.message || 'Error al cargar grupos familiares';
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Error de conexión al servidor';
        this.loading = false;
      }
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.grupoFamiliarId = null;
    this.grupoFamiliarForm = this.createForm();
    this.displayDialog = true;
    this.formError = '';
  }

  openEdit(grupo: GrupoFamiliar): void {
    this.isEdit = true;
    this.grupoFamiliarId = grupo.id_grupo_familiar;
    this.grupoFamiliarForm = this.fb.group({
      nombre: [grupo.nombre, [Validators.required, Validators.maxLength(255)]],
      descripcion: [grupo.descripcion || ''],
      id_patriarca: [grupo.id_patriarca],
      activo: [grupo.activo === 1]
    });
    this.displayDialog = true;
    this.formError = '';
  }

  save(): void {
    if (this.grupoFamiliarForm.invalid) {
      this.grupoFamiliarForm.markAllAsTouched();
      return;
    }

    this.formLoading = true;
    this.formError = '';

    const data: GrupoFamiliarRequest = {
      nombre: this.grupoFamiliarForm.value.nombre,
      descripcion: this.grupoFamiliarForm.value.descripcion || undefined,
      id_patriarca: this.grupoFamiliarForm.value.id_patriarca || undefined,
      activo: this.grupoFamiliarForm.value.activo
    };

    if (this.isEdit && this.grupoFamiliarId) {
      this.grupoFamiliarService.updateGrupoFamiliar(this.grupoFamiliarId, data).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Grupo familiar actualizado exitosamente'
            });
            this.displayDialog = false;
            this.loadGruposFamiliares();
          } else {
            this.formError = response.message || 'Error al actualizar el grupo familiar';
          }
          this.formLoading = false;
        },
        error: () => {
          this.formError = 'Error de conexión al servidor';
          this.formLoading = false;
        }
      });
    } else {
      this.grupoFamiliarService.createGrupoFamiliar(data).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Grupo familiar creado exitosamente'
            });
            this.displayDialog = false;
            this.loadGruposFamiliares();
          } else {
            this.formError = response.message || 'Error al crear el grupo familiar';
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

  delete(grupo: GrupoFamiliar): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de desactivar el grupo familiar "${grupo.nombre}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.grupoFamiliarService.deleteGrupoFamiliar(grupo.id_grupo_familiar).subscribe({
          next: (response) => {
            if (response.success) {
              this.messageService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Grupo familiar desactivado exitosamente'
              });
              this.loadGruposFamiliares();
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: response.message || 'Error al desactivar el grupo familiar'
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
      this.filteredGruposFamiliares = this.gruposFamiliares;
    } else if (value === '1') {
      this.filteredGruposFamiliares = this.gruposFamiliares.filter(g => g.activo === 1);
    } else if (value === '0') {
      this.filteredGruposFamiliares = this.gruposFamiliares.filter(g => g.activo === 0);
    }
  }

  trackByGrupoFamiliarId(index: number, grupo: GrupoFamiliar): number {
    return grupo.id_grupo_familiar;
  }

  exportToExcel(): void {
    const dataToExport = this.table.filteredValue || this.gruposFamiliares;
    const exportData = dataToExport.map((grupo: GrupoFamiliar) => ({
      ID: grupo.id_grupo_familiar,
      Nombre: grupo.nombre,
      Descripción: grupo.descripcion || '',
      Patriarca: grupo.patriarca ? `${grupo.patriarca.apellidos} ${grupo.patriarca.nombres}` : '',
      Estado: grupo.activo === 1 ? 'Activo' : 'Inactivo'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Grupos Familiares');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `grupos_familiares_${new Date().toISOString().split('T')[0]}.xlsx`;

    saveAs(blob, fileName);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo Excel exportado correctamente'
    });
  }

  exportToPDF(): void {
    const dataToExport = this.table.filteredValue || this.gruposFamiliares;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Reporte de Grupos Familiares', 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = dataToExport.map((grupo: GrupoFamiliar) => [
      grupo.id_grupo_familiar,
      grupo.nombre,
      grupo.descripcion || '',
      grupo.patriarca ? `${grupo.patriarca.apellidos} ${grupo.patriarca.nombres}` : '',
      grupo.activo === 1 ? 'Activo' : 'Inactivo'
    ]);

    autoTable(doc, {
      head: [['ID', 'Nombre', 'Descripción', 'Patriarca', 'Estado']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [97, 178, 125] }
    });

    doc.save(`grupos_familiares_${new Date().toISOString().split('T')[0]}.pdf`);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo PDF exportado correctamente'
    });
  }
}
