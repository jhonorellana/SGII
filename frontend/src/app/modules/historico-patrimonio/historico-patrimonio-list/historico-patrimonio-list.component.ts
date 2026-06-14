import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { HistoricoPatrimonioService } from '../../../core/historico-patrimonio.service';
import { ModalActionsComponent } from '../../../core/modal-actions';
import { PaginationService } from '../../../core/pagination.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface HistoricoPatrimonioRecord {
  id_historico_patrimonio: number;
  fecha: string;
  capital_jaime: number;
  capital_argentina: number;
  capital_cristian: number;
  capital_total: number;
  capital_propio: number;
  capital_importacion: number;
  capital_total_propio: number;
}

@Component({
  selector: 'app-historico-patrimonio-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    InputTextModule,
    ButtonModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    ModalActionsComponent
  ],
  templateUrl: './historico-patrimonio-list.component.html',
  styleUrl: './historico-patrimonio-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class HistoricoPatrimonioListComponent implements OnInit {
  records: HistoricoPatrimonioRecord[] = [];
  filteredRecords: HistoricoPatrimonioRecord[] = [];
  loading = false;
  error = '';
  @ViewChild('dt') table: any;
  totalRecords = 0;

  // Modal properties
  displayDialog = false;
  isEdit = false;
  recordId: number | null = null;
  patrimonioForm: FormGroup;
  formLoading = false;
  formError = '';
  rowsPerPage = 10;

  // Calculated values in template
  calculatedPropio = 0;
  calculatedTotalPropio = 0;

  constructor(
    private service: HistoricoPatrimonioService,
    private fb: FormBuilder,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private paginationService: PaginationService
  ) {
    this.patrimonioForm = this.createForm();
    this.setupCalculations();
  }

  ngOnInit(): void {
    this.rowsPerPage = this.paginationService.getRowsPerPage('historico_patrimonio', 10);
    this.loadRecords();
  }

  createForm(): FormGroup {
    return this.fb.group({
      fecha: ['', Validators.required],
      capital_jaime: [0, [Validators.required, Validators.min(0)]],
      capital_argentina: [0, [Validators.required, Validators.min(0)]],
      capital_cristian: [0, [Validators.required, Validators.min(0)]],
      capital_total: [0, [Validators.required, Validators.min(0)]],
      capital_importacion: [0, [Validators.required, Validators.min(0)]]
    });
  }

  setupCalculations(): void {
    this.patrimonioForm.valueChanges.subscribe(val => {
      const jaime = Number(val.capital_jaime || 0);
      const argentina = Number(val.capital_argentina || 0);
      const cristian = Number(val.capital_cristian || 0);
      const total = Number(val.capital_total || 0);
      const importacion = Number(val.capital_importacion || 0);

      this.calculatedPropio = total - (jaime + argentina + cristian);
      this.calculatedTotalPropio = this.calculatedPropio + importacion;
    });
  }

  loadRecords(): void {
    this.loading = true;
    this.error = '';
    this.service.getHistoricoPatrimonio().subscribe({
      next: (response) => {
        if (response.success) {
          // Asegurarse de formatear fechas limpiamente
          this.records = response.data.map((r: any) => ({
            ...r,
            fecha: r.fecha.split(' ')[0]
          }));
          this.filteredRecords = this.records;
          this.totalRecords = this.records.length;
        } else {
          this.error = response.message || 'Error al cargar registros históricos';
          this.totalRecords = 0;
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Error de conexión al servidor';
        this.records = [];
        this.filteredRecords = [];
        this.totalRecords = 0;
        this.loading = false;
      }
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.recordId = null;
    
    const latest = this.records.length > 0 ? this.records[0] : null;
    const today = new Date().toISOString().split('T')[0];

    this.patrimonioForm = this.fb.group({
      fecha: [today, Validators.required],
      capital_jaime: [latest ? Number(latest.capital_jaime) : 0, [Validators.required, Validators.min(0)]],
      capital_argentina: [latest ? Number(latest.capital_argentina) : 0, [Validators.required, Validators.min(0)]],
      capital_cristian: [latest ? Number(latest.capital_cristian) : 0, [Validators.required, Validators.min(0)]],
      capital_total: [0, [Validators.required, Validators.min(0)]],
      capital_importacion: [latest ? Number(latest.capital_importacion) : 0, [Validators.required, Validators.min(0)]]
    });

    this.setupCalculations();
    
    // Initial calculation based on prefilled values
    const jaime = latest ? Number(latest.capital_jaime) : 0;
    const argentina = latest ? Number(latest.capital_argentina) : 0;
    const cristian = latest ? Number(latest.capital_cristian) : 0;
    const total = 0;
    const importacion = latest ? Number(latest.capital_importacion) : 0;
    
    this.calculatedPropio = total - (jaime + argentina + cristian);
    this.calculatedTotalPropio = this.calculatedPropio + importacion;

    this.displayDialog = true;
    this.formError = '';
  }

  openEdit(record: HistoricoPatrimonioRecord): void {
    this.isEdit = true;
    this.recordId = record.id_historico_patrimonio;
    
    // Formatear fecha para el input HTML tipo 'date' (YYYY-MM-DD)
    const fechaF = record.fecha.split(' ')[0];

    this.patrimonioForm = this.fb.group({
      fecha: [fechaF, Validators.required],
      capital_jaime: [record.capital_jaime, [Validators.required, Validators.min(0)]],
      capital_argentina: [record.capital_argentina, [Validators.required, Validators.min(0)]],
      capital_cristian: [record.capital_cristian, [Validators.required, Validators.min(0)]],
      capital_total: [record.capital_total, [Validators.required, Validators.min(0)]],
      capital_importacion: [record.capital_importacion, [Validators.required, Validators.min(0)]]
    });

    this.setupCalculations();
    
    this.calculatedPropio = Number(record.capital_total) - (Number(record.capital_jaime) + Number(record.capital_argentina) + Number(record.capital_cristian));
    this.calculatedTotalPropio = this.calculatedPropio + Number(record.capital_importacion);

    this.displayDialog = true;
    this.formError = '';
  }

  save(): void {
    if (this.patrimonioForm.invalid) {
      this.patrimonioForm.markAllAsTouched();
      return;
    }

    this.formLoading = true;
    this.formError = '';

    const data = {
      fecha: this.patrimonioForm.value.fecha,
      capital_jaime: this.patrimonioForm.value.capital_jaime,
      capital_argentina: this.patrimonioForm.value.capital_argentina,
      capital_cristian: this.patrimonioForm.value.capital_cristian,
      capital_total: this.patrimonioForm.value.capital_total,
      capital_importacion: this.patrimonioForm.value.capital_importacion
    };

    if (this.isEdit && this.recordId) {
      this.service.updateRecord(this.recordId, data).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Registro histórico actualizado exitosamente'
            });
            this.displayDialog = false;
            this.loadRecords();
          } else {
            this.formError = response.message || 'Error al actualizar el registro';
          }
          this.formLoading = false;
        },
        error: () => {
          this.formError = 'Error de conexión al servidor';
          this.formLoading = false;
        }
      });
    } else {
      this.service.createRecord(data).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Registro histórico creado exitosamente'
            });
            this.displayDialog = false;
            this.loadRecords();
          } else {
            this.formError = response.message || 'Error al crear el registro';
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

  delete(record: HistoricoPatrimonioRecord): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de eliminar de forma permanente el registro histórico del ${record.fecha}?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.service.deleteRecord(record.id_historico_patrimonio).subscribe({
          next: (response) => {
            if (response.success) {
              this.messageService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Registro histórico eliminado exitosamente'
              });
              this.loadRecords();
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: response.message || 'Error al eliminar el registro'
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

  onGlobalFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.table.filterGlobal(value, 'contains');
  }

  onFilter(event: any): void {
    if (event.filteredValue) {
      this.totalRecords = event.filteredValue.length;
    } else {
      this.totalRecords = this.records.length;
    }
  }

  onPageChange(event: any): void {
    this.rowsPerPage = event.rows;
    this.paginationService.setRowsPerPage('historico_patrimonio', this.rowsPerPage);
  }

  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
  }

  exportToExcel(): void {
    const dataToExport = this.table.filteredValue || this.records;
    const exportData = dataToExport.map((rec: HistoricoPatrimonioRecord) => ({
      Fecha: rec.fecha,
      'Capital Jaime ($)': rec.capital_jaime,
      'Capital Argentina ($)': rec.capital_argentina,
      'Capital Cristian ($)': rec.capital_cristian,
      'Capital Propio ($)': rec.capital_propio,
      'Capital Importación ($)': rec.capital_importacion,
      'Capital Total Propio ($)': rec.capital_total_propio,
      'Capital Total Consolidado ($)': rec.capital_total
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Histórico Patrimonio');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `historico_patrimonio_${new Date().toISOString().split('T')[0]}.xlsx`;

    saveAs(blob, fileName);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo Excel exportado correctamente'
    });
  }

  exportToPDF(): void {
    const dataToExport = this.table.filteredValue || this.records;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFontSize(16);
    doc.text('Histórico de Crecimiento de Patrimonio', 14, 15);
    doc.setFontSize(10);
    doc.text(`Fecha Reporte: ${new Date().toLocaleDateString()}`, 14, 21);

    const tableData = dataToExport.map((rec: HistoricoPatrimonioRecord) => [
      rec.fecha,
      this.formatearMoneda(rec.capital_jaime),
      this.formatearMoneda(rec.capital_argentina),
      this.formatearMoneda(rec.capital_cristian),
      this.formatearMoneda(rec.capital_propio),
      this.formatearMoneda(rec.capital_importacion),
      this.formatearMoneda(rec.capital_total_propio),
      this.formatearMoneda(rec.capital_total)
    ]);

    autoTable(doc, {
      head: [['Fecha', 'Cap. Jaime', 'Cap. Argentina', 'Cap. Cristian', 'Cap. Propio', 'Cap. Importación', 'Total Propio', 'Total Consolidado']],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`historico_patrimonio_${new Date().toISOString().split('T')[0]}.pdf`);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo PDF exportado correctamente'
    });
  }
}
