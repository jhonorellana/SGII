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
import { ConfirmationService, MessageService } from 'primeng/api';
import { CuentaBancariaService, CuentaBancaria, CuentaBancariaRequest } from '../../../core/cuenta-bancaria.service';
import { CatalogoService } from '../../../core/catalogo.service';
import { PersonaService } from '../../../core/persona.service';
import { ModalActionsComponent } from '../../../core/modal-actions';
import { PaginationService } from '../../../core/pagination.service';

interface CatalogoValor {
  id_catalogo_valor: number;
  nombre: string;
  codigo: string;
}

interface Persona {
  id_persona: number;
  nombres: string;
  apellidos: string;
}

@Component({
  selector: 'app-cuenta-bancaria-list',
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
    ModalActionsComponent
  ],
  templateUrl: './cuenta-bancaria-list.component.html',
  styleUrl: './cuenta-bancaria-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class CuentaBancariaListComponent implements OnInit {
  cuentasBancarias: CuentaBancaria[] = [];
  bancos: CatalogoValor[] = [];
  tiposCuenta: CatalogoValor[] = [];
  personas: Persona[] = [];
  loading = false;
  error = '';
  @ViewChild('dt') dt: Table | undefined;
  totalRecords: number = 0;

  // Modal properties
  displayDialog: boolean = false;
  isEdit: boolean = false;
  cuentaBancariaId: number | null = null;
  cuentaBancariaForm: FormGroup;
  formLoading: boolean = false;
  formError: string = '';
  rowsPerPage: number = 10;

  constructor(
    private cuentaBancariaService: CuentaBancariaService,
    private catalogoService: CatalogoService,
    private personaService: PersonaService,
    private fb: FormBuilder,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private paginationService: PaginationService
  ) {
    this.cuentaBancariaForm = this.createForm();
  }

  ngOnInit(): void {
    this.rowsPerPage = this.paginationService.getRowsPerPage('cuentasBancarias', 10);
    this.loadCuentasBancarias();
    this.loadBancos();
    this.loadTiposCuenta();
    this.loadPersonas();
  }

  createForm(): FormGroup {
    return this.fb.group({
      id_persona: [null, Validators.required],
      id_banco: [null, Validators.required],
      id_tipo_cuenta: [null],
      numero_cuenta: ['', Validators.maxLength(20)],
      activo: [true]
    });
  }

  loadCuentasBancarias(): void {
    this.loading = true;
    this.error = '';
    this.cuentaBancariaService.getAll().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.cuentasBancarias = response.data;
          this.totalRecords = response.data.length;
        } else {
          this.error = response.message || 'Error al cargar cuentas bancarias';
          console.error('Error response:', response);
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al conectar con el servidor';
        this.loading = false;
        console.error('Error loading cuentas bancarias:', err);
      }
    });
  }

  loadBancos(): void {
    this.catalogoService.getValoresByCodigo('BANCO').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.bancos = response.data;
        } else {
          console.error('Catálogo de bancos no encontrado:', response.message);
          this.messageService.add({
            severity: 'warn',
            summary: 'Advertencia',
            detail: 'Catálogo de bancos (código BANCO) no encontrado. Por favor cree el catálogo en Datos Maestros.'
          });
        }
      },
      error: (err) => {
        console.error('Error loading bancos:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar el catálogo de bancos. Verifique que el catálogo con código BANCO exista.'
        });
      }
    });
  }

  loadTiposCuenta(): void {
    this.catalogoService.getValoresByCodigo('TIPO_CUENTA').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.tiposCuenta = response.data;
        } else {
          console.error('Catálogo de tipos de cuenta no encontrado:', response.message);
          this.messageService.add({
            severity: 'warn',
            summary: 'Advertencia',
            detail: 'Catálogo de tipos de cuenta (código TIPO_CUENTA) no encontrado. Por favor cree el catálogo en Datos Maestros.'
          });
        }
      },
      error: (err) => {
        console.error('Error loading tipos cuenta:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar el catálogo de tipos de cuenta. Verifique que el catálogo con código TIPO_CUENTA exista.'
        });
      }
    });
  }

  loadPersonas(): void {
    this.personaService.getAll().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.personas = response.data;
        }
      },
      error: (err) => {
        console.error('Error loading personas:', err);
      }
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.cuentaBancariaId = null;
    this.cuentaBancariaForm = this.createForm();
    this.formError = '';
    this.displayDialog = true;
  }

  openEdit(cuentaBancaria: CuentaBancaria): void {
    this.isEdit = true;
    this.cuentaBancariaId = cuentaBancaria.id_cuenta_bancaria || null;
    this.cuentaBancariaForm = this.fb.group({
      id_persona: [cuentaBancaria.id_persona, Validators.required],
      id_banco: [cuentaBancaria.id_banco, Validators.required],
      id_tipo_cuenta: [cuentaBancaria.id_tipo_cuenta],
      numero_cuenta: [cuentaBancaria.numero_cuenta || '', Validators.maxLength(20)],
      activo: [cuentaBancaria.activo]
    });
    this.formError = '';
    this.displayDialog = true;
  }

  delete(cuentaBancaria: CuentaBancaria): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de eliminar la cuenta bancaria de ${cuentaBancaria.persona?.nombres || 'N/A'}?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        if (cuentaBancaria.id_cuenta_bancaria) {
          this.cuentaBancariaService.delete(cuentaBancaria.id_cuenta_bancaria).subscribe({
            next: (response) => {
              if (response.success) {
                this.messageService.add({
                  severity: 'success',
                  summary: 'Éxito',
                  detail: 'Cuenta bancaria eliminada correctamente'
                });
                this.loadCuentasBancarias();
              } else {
                this.messageService.add({
                  severity: 'error',
                  summary: 'Error',
                  detail: response.message || 'No se pudo eliminar la cuenta bancaria'
                });
              }
            },
            error: (err) => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al conectar con el servidor'
              });
              console.error('Error deleting cuenta bancaria:', err);
            }
          });
        }
      }
    });
  }

  save(): void {
    if (this.cuentaBancariaForm.invalid) {
      this.formError = 'Por favor complete todos los campos requeridos';
      return;
    }

    this.formLoading = true;
    this.formError = '';

    const data: CuentaBancariaRequest = this.cuentaBancariaForm.value;

    if (this.isEdit && this.cuentaBancariaId) {
      this.cuentaBancariaService.update(this.cuentaBancariaId, data).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Cuenta bancaria actualizada correctamente'
            });
            this.displayDialog = false;
            this.loadCuentasBancarias();
          } else {
            this.formError = response.message || 'No se pudo actualizar la cuenta bancaria';
          }
          this.formLoading = false;
        },
        error: (err) => {
          this.formError = 'Error al conectar con el servidor';
          this.formLoading = false;
          console.error('Error updating cuenta bancaria:', err);
        }
      });
    } else {
      this.cuentaBancariaService.create(data).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Cuenta bancaria creada correctamente'
            });
            this.displayDialog = false;
            this.loadCuentasBancarias();
          } else {
            this.formError = response.message || 'No se pudo crear la cuenta bancaria';
          }
          this.formLoading = false;
        },
        error: (err) => {
          this.formError = 'Error al conectar con el servidor';
          this.formLoading = false;
          console.error('Error creating cuenta bancaria:', err);
        }
      });
    }
  }

  getNombreCompleto(persona: Persona): string {
    return `${persona.nombres} ${persona.apellidos}`;
  }

  filterGlobal(event: Event): void {
    if (this.dt) {
      this.dt.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }
  }

  onPageChange(event: any): void {
    this.rowsPerPage = event.rows;
    this.paginationService.setRowsPerPage('cuentasBancarias', this.rowsPerPage);
  }
}
