import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule, Table } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { InstrumentoService, Instrumento } from '../../../core/instrumento.service';
import { CatalogoService } from '../../../core/catalogo.service';
import { EmisorService } from '../../../core/emisor.service';
import { ModalActionsComponent } from '../../../core/modal-actions';

@Component({
  selector: 'app-instrumento-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    CalendarModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    FormsModule,
    ModalActionsComponent
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './instrumento-list.component.html',
  styleUrls: ['./instrumento-list.component.css']
})
export class InstrumentoListComponent implements OnInit, AfterViewInit {
  instrumentos: Instrumento[] = [];
  emisores: any[] = [];
  tiposInversion: any[] = [];

  displayDialog: boolean = false;
  isEdit: boolean = false;

  instrumento: Instrumento = {
    id_emisor: 0,
    id_tipo_inversion: 0,
    codigo_titulo: '',
    nombre: '',
    fecha_emision: '',
    fecha_vencimiento: '',
    calificacion_riesgo: '',
    activo: true
  };

  selectedInstrumentos: Instrumento[] = [];

  @ViewChild('dt') table!: Table;

  cols: any[] = [
    { field: 'id_instrumento', header: 'ID' },
    { field: 'nombre', header: 'Nombre' },
    { field: 'emisor.nombre', header: 'Emisor' },
    { field: 'tipoInversion.nombre', header: 'Tipo Inversión' },
    { field: 'tasa_referencial', header: 'Tasa Referencial' },
    { field: 'calificacion_riesgo', header: 'Calificación Riesgo' },
    { field: 'fecha_emision', header: 'Fecha Emisión' },
    { field: 'fecha_vencimiento', header: 'Fecha Vencimiento' },
    { field: 'activo', header: 'Estado' }
  ];

  constructor(
    private instrumentoService: InstrumentoService,
    private emisorService: EmisorService,
    private catalogoService: CatalogoService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadInstrumentos();
    this.loadEmisores();
    this.loadTiposInversion();
  }

  ngAfterViewInit(): void {
    // Filtrar por activos por defecto después de que la tabla se inicialice
    setTimeout(() => {
      if (this.table) {
        this.table.filter(true, 'activo', 'equals');
      }
    }, 100);
  }

  loadInstrumentos(): void {
    this.instrumentoService.getAll().subscribe({
      next: (data) => {
        this.instrumentos = Array.isArray(data) ? data : (data as any).data || [];
      },
      error: (error) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar instrumentos' });
      }
    });
  }

  loadEmisores(): void {
    this.emisorService.getEmisores().subscribe({
      next: (data: any) => {
        const emisoresArray = Array.isArray(data) ? data : (data as any).data || [];
        this.emisores = emisoresArray.filter((e: any) => e.activo === true || e.activo === 1);
      },
      error: (error: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar emisores' });
      }
    });
  }

  loadTiposInversion(): void {
    this.catalogoService.getValoresByCatalogo(1).subscribe({
      next: (data: any) => {
        const tiposArray = Array.isArray(data) ? data : (data as any).data || [];
        this.tiposInversion = tiposArray.filter((t: any) => t.activo === true || t.activo === 1);
      },
      error: (error: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar tipos de inversión' });
      }
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.instrumento = {
      id_emisor: 0,
      id_tipo_inversion: 0,
      codigo_titulo: '',
      nombre: '',
      fecha_emision: '',
      fecha_vencimiento: '',
      calificacion_riesgo: '',
      activo: true
    };
    this.displayDialog = true;
  }

  openEdit(instrumento: Instrumento): void {
    this.isEdit = true;
    this.instrumento = { ...instrumento };
    // Formatear fechas a YYYY-MM-DD
    if (this.instrumento.fecha_emision) {
      this.instrumento.fecha_emision = this.formatDate(this.instrumento.fecha_emision);
    }
    if (this.instrumento.fecha_vencimiento) {
      this.instrumento.fecha_vencimiento = this.formatDate(this.instrumento.fecha_vencimiento);
    }
    this.displayDialog = true;
  }

  onDateFilter(event: any, field: string): void {
    const value = (event.target as any).value as string;
    if (value) {
      this.table.filter(value, field, 'contains');
    } else {
      this.table.filter('', field, 'contains');
    }
  }

  onActivoFilterChange(value: string): void {
    if (value === '') {
      this.table.filter('', 'activo', 'equals');
    } else if (value === 'true') {
      this.table.filter(true, 'activo', 'equals');
    } else {
      this.table.filter(false, 'activo', 'equals');
    }
  }

  save(): void {
    if (this.isEdit && this.instrumento.id_instrumento) {
      this.instrumentoService.update(this.instrumento.id_instrumento, this.instrumento).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Instrumento actualizado' });
          this.displayDialog = false;
          this.loadInstrumentos();
        },
        error: (error) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar instrumento' });
        }
      });
    } else {
      this.instrumentoService.create(this.instrumento).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Instrumento creado' });
          this.displayDialog = false;
          this.loadInstrumentos();
        },
        error: (error) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al crear instrumento' });
        }
      });
    }
  }

  delete(instrumento: Instrumento): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de desactivar el instrumento ${instrumento.nombre}?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        if (instrumento.id_instrumento) {
          this.instrumentoService.delete(instrumento.id_instrumento).subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Instrumento desactivado' });
              this.loadInstrumentos();
            },
            error: (error) => {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al desactivar instrumento' });
            }
          });
        }
      }
    });
  }

  formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  exportToExcel(): void {
    const data = this.instrumentos.map(i => ({
      'ID': i.id_instrumento,
      'Nombre': i.nombre,
      'Emisor': i.emisor?.nombre || '',
      'Tipo Inversión': i.tipoInversion?.nombre || '',
      'Tasa Referencial': i.tasa_referencial ? i.tasa_referencial + '%' : '',
      'Calificación Riesgo': i.calificacion_riesgo || '',
      'Fecha Emisión': this.formatDate(i.fecha_emision),
      'Fecha Vencimiento': this.formatDate(i.fecha_vencimiento),
      'Estado': i.activo ? 'Activo' : 'Inactivo'
    }));

    const csv = this.convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'instrumentos.csv';
    link.click();
  }

  exportToPDF(): void {
    const data = this.instrumentos.map(i => ({
      'ID': i.id_instrumento,
      'Nombre': i.nombre,
      'Emisor': i.emisor?.nombre || '',
      'Tipo Inversión': i.tipoInversion?.nombre || '',
      'Tasa Referencial': i.tasa_referencial ? i.tasa_referencial + '%' : '',
      'Calificación Riesgo': i.calificacion_riesgo || '',
      'Fecha Emisión': this.formatDate(i.fecha_emision),
      'Fecha Vencimiento': this.formatDate(i.fecha_vencimiento),
      'Estado': i.activo ? 'Activo' : 'Inactivo'
    }));

    let content = '<table style="width:100%; border-collapse: collapse;">';
    content += '<thead><tr style="background-color: #4a8c62; color: white;">';
    Object.keys(data[0] || {}).forEach(key => {
      content += `<th style="border: 1px solid #ddd; padding: 8px;">${key}</th>`;
    });
    content += '</tr></thead><tbody>';

    data.forEach(row => {
      content += '<tr>';
      Object.values(row).forEach(value => {
        content += `<td style="border: 1px solid #ddd; padding: 8px;">${value}</td>`;
      });
      content += '</tr>';
    });
    content += '</tbody></table>';

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head><title>Instrumentos</title></head>
        <body>${content}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }

  convertToCSV(data: any[]): string {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');
    return csvContent;
  }
}
