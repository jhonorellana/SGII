import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { AmortizacionService, Amortizacion } from '../../../core/amortizacion.service';
import { InversionService } from '../../../core/inversion.service';
import { CatalogoService } from '../../../core/catalogo.service';
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
    { field: 'inversion.id_inversion', header: 'Inversión' },
    { field: 'inversion.propietario.nombres', header: 'Propietario' },
    { field: 'fecha_pago', header: 'Fecha Pago' },
    { field: 'interes', header: 'Interés' },
    { field: 'capital', header: 'Capital' },
    { field: 'descuento', header: 'Descuento' },
    { field: 'total', header: 'Total' },
    { field: 'estado_amortizacion', header: 'Estado' },
    { field: 'pagada', header: 'Pagada' },
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
}
