import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AmortizacionService, Amortizacion } from '../../../core/amortizacion.service';
import { InversionService } from '../../../core/inversion.service';
import { CatalogoService } from '../../../core/catalogo.service';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ModalActionsComponent } from '../../../core/modal-actions';

@Component({
  selector: 'app-amortizacion-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    FormsModule,
    ModalActionsComponent
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './amortizacion-list.component.html',
  styleUrls: ['./amortizacion-list.component.css']
})
export class AmortizacionListComponent implements OnInit {
  @ViewChild('table') table!: any;
  amortizaciones: Amortizacion[] = [];
  inversiones: any[] = [];
  estadosAmortizacion: any[] = [];

  displayDialog: boolean = false;
  isEdit: boolean = false;

  amortizacion: Amortizacion = {
    id_inversion: 0,
    fecha_pago: '',
    id_estado_amortizacion: 0,
    pagada: false,
    activo: true
  };

  selectedAmortizaciones: Amortizacion[] = [];

  cols: any[] = [
    { field: 'id_amortizacion', header: 'ID' },
    { field: 'inversion', header: 'Inversión' },
    { field: 'inversion.propietario.nombres', header: 'Propietario' },
    { field: 'fecha_pago', header: 'Fecha Pago' },
    { field: 'interes', header: 'Interés' },
    { field: 'capital', header: 'Capital' },
    { field: 'descuento', header: 'Descuento' },
    { field: 'total', header: 'Total' },
    { field: 'estado_amortizacion', header: 'Estado' },
    { field: 'activo', header: 'Activo' },
    { field: 'acciones', header: 'Acciones' }
  ];

  constructor(
    private amortizacionService: AmortizacionService,
    private inversionService: InversionService,
    private catalogoService: CatalogoService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadAmortizaciones();
    this.loadInversiones();
    this.loadEstadosAmortizacion();
  }

  loadAmortizaciones(): void {
    this.amortizacionService.getAll().subscribe({
      next: (data) => {
        this.amortizaciones = data;
      },
      error: (error) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar amortizaciones' });
      }
    });
  }

  loadInversiones(): void {
    this.inversionService.getAll().subscribe({
      next: (data) => {
        this.inversiones = data;
      },
      error: (error) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar inversiones' });
      }
    });
  }

  loadEstadosAmortizacion(): void {
    this.catalogoService.getValoresByCatalogo(5).subscribe({
      next: (data: any) => {
        this.estadosAmortizacion = data;
      },
      error: (error: any) => {
        this.estadosAmortizacion = [];
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar estados de amortización' });
      }
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.amortizacion = {
      id_inversion: 0,
      fecha_pago: '',
      id_estado_amortizacion: this.estadosAmortizacion.length > 0 ? this.estadosAmortizacion[0].id_catalogo_valor : 134,
      pagada: false,
      activo: true
    };
    this.displayDialog = true;
  }

  edit(amortizacion: Amortizacion): void {
    this.isEdit = true;
    this.amortizacion = { ...amortizacion };
    this.displayDialog = true;
  }

  save(): void {
    if (this.isEdit && this.amortizacion.id_amortizacion) {
      this.amortizacionService.update(this.amortizacion.id_amortizacion, this.amortizacion).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Amortización actualizada' });
          this.displayDialog = false;
          this.loadAmortizaciones();
        },
        error: (error) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar amortización' });
        }
      });
    } else {
      this.amortizacionService.create(this.amortizacion).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Amortización creada' });
          this.displayDialog = false;
          this.loadAmortizaciones();
        },
        error: (error) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al crear amortización' });
        }
      });
    }
  }

  delete(amortizacion: Amortizacion): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de desactivar la amortización ${amortizacion.id_amortizacion}?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        if (amortizacion.id_amortizacion) {
          this.amortizacionService.delete(amortizacion.id_amortizacion).subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Amortización desactivada' });
              this.loadAmortizaciones();
            },
            error: (error) => {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al desactivar amortización' });
            }
          });
        }
      }
    });
  }

  formatCurrency(value: number): string {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  formatInversion(inversion: any): string {
    if (!inversion) return '-';
    const codigo = inversion.id_inversion || '';
    const liquidacion = inversion.liquidacion || '';
    return liquidacion ? `${codigo} - ${liquidacion}` : codigo.toString();
  }

  onInversionFilterChange(event: any): void {
    const value = event.target.value;
    if (!value) {
      this.table.filteredValue = this.amortizaciones;
      return;
    }

    const filtered = this.amortizaciones.filter(amortizacion => {
      if (!amortizacion.inversion) return false;

      const codigo = amortizacion.inversion.id_inversion?.toString() || '';
      const liquidacion = amortizacion.inversion.liquidacion?.toString() || '';
      const formattedText = this.formatInversion(amortizacion.inversion);

      return codigo.includes(value) ||
             liquidacion.toLowerCase().includes(value.toLowerCase()) ||
             formattedText.toLowerCase().includes(value.toLowerCase());
    });

    this.table.filteredValue = filtered;
  }

  formatDate(date: string): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  getSeverity(estado: string): 'success' | 'secondary' | 'info' | 'warning' | 'danger' | 'contrast' | undefined {
    switch (estado) {
      case 'Pagada':
        return 'success';
      case 'Pendiente':
        return 'warning';
      case 'Morosa':
        return 'danger';
      case 'Anulada':
        return 'info';
      default:
        return 'info';
    }
  }

  exportToExcel(): void {
    const dataToExport = this.table.filteredValue || this.amortizaciones;
    const exportData = dataToExport.map((amortizacion: Amortizacion) => ({
      ID: amortizacion.id_amortizacion,
      'Inversión': this.formatInversion(amortizacion.inversion),
      Propietario: amortizacion.inversion?.propietario?.nombres || '',
      'Fecha Pago': this.formatDate(amortizacion.fecha_pago),
      Interés: amortizacion.interes,
      Capital: amortizacion.capital,
      Descuento: amortizacion.descuento,
      Total: amortizacion.total,
      Estado: amortizacion.estado_amortizacion?.nombre || '',
      Activo: amortizacion.activo ? 'Sí' : 'No'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Amortizaciones');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `amortizaciones_${new Date().toISOString().split('T')[0]}.xlsx`;

    saveAs(blob, fileName);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo Excel exportado correctamente'
    });
  }

  exportToPDF(): void {
    const dataToExport = this.table.filteredValue || this.amortizaciones;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Reporte de Amortizaciones', 14, 22);
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = dataToExport.map((amortizacion: Amortizacion) => [
      amortizacion.id_amortizacion,
      this.formatInversion(amortizacion.inversion),
      amortizacion.inversion?.propietario?.nombres || '',
      this.formatDate(amortizacion.fecha_pago),
      amortizacion.interes,
      amortizacion.capital,
      amortizacion.descuento,
      amortizacion.total,
      amortizacion.estado_amortizacion?.nombre || '',
      amortizacion.activo ? 'Sí' : 'No'
    ]);

    autoTable(doc, {
      head: [['ID', 'Inversión', 'Propietario', 'Fecha Pago', 'Interés', 'Capital', 'Descuento', 'Total', 'Estado', 'Activo']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [97, 178, 125] }
    });

    doc.save(`amortizaciones_${new Date().toISOString().split('T')[0]}.pdf`);

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo PDF exportado correctamente'
    });
  }
}
