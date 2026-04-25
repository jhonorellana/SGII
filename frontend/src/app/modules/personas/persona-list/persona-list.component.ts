import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PersonaService, Persona, PersonaRequest } from '../../../core/persona.service';

@Component({
  selector: 'app-persona-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule, InputTextModule, ButtonModule, TagModule, DialogModule, ToastModule, ConfirmDialogModule],
  templateUrl: './persona-list.component.html',
  styleUrl: './persona-list.component.css',
  providers: [ConfirmationService, MessageService]
})
export class PersonaListComponent implements OnInit {
  personas: Persona[] = [];
  filteredPersonas: Persona[] = [];
  loading = false;
  error = '';
  @ViewChild('dt') table: any;
  activoFilter: string = '';

  // Modal properties
  displayDialog: boolean = false;
  isEdit: boolean = false;
  personaId: number | null = null;
  personaForm: FormGroup;
  formLoading: boolean = false;
  formError: string = '';

  constructor(
    private personaService: PersonaService,
    private fb: FormBuilder,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    this.personaForm = this.createForm();
  }

  ngOnInit(): void {
    console.log('[PersonaList] Component initialized');
    this.loadPersonas();
  }

  createForm(): FormGroup {
    return this.fb.group({
      nombres: ['', [Validators.required, Validators.maxLength(150)]],
      apellidos: ['', [Validators.required, Validators.maxLength(150)]],
      identificacion: ['', Validators.maxLength(50)],
      correo: ['', [Validators.email, Validators.maxLength(150)]],
      telefono: ['', Validators.maxLength(50)],
      activo: [true]
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.personaId = null;
    this.personaForm.reset({ activo: true });
    this.formError = '';
    this.displayDialog = true;
  }

  openEdit(persona: Persona): void {
    this.isEdit = true;
    this.personaId = persona.id_persona;
    this.personaForm.patchValue({
      nombres: persona.nombres,
      apellidos: persona.apellidos,
      identificacion: persona.identificacion || '',
      correo: persona.correo || '',
      telefono: persona.telefono || '',
      activo: persona.activo === 1 || persona.activo === true
    });
    this.formError = '';
    this.displayDialog = true;
  }

  hideDialog(): void {
    this.displayDialog = false;
    this.personaForm.reset();
    this.formError = '';
  }

  save(): void {
    if (this.personaForm.invalid) {
      this.markFormAsDirty();
      return;
    }

    this.formLoading = true;
    this.formError = '';

    const formData = this.personaForm.value;

    if (this.isEdit && this.personaId) {
      this.updatePersona(this.personaId, formData);
    } else {
      this.createPersona(formData);
    }
  }

  createPersona(data: PersonaRequest): void {
    this.personaService.create(data).subscribe({
      next: (response) => {
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Persona creada exitosamente'
          });
          this.hideDialog();
          this.loadPersonas();
        } else {
          this.formError = response.message || 'Error al crear la persona';
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

  updatePersona(id: number, data: PersonaRequest): void {
    this.personaService.update(id, data).subscribe({
      next: (response) => {
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Persona actualizada exitosamente'
          });
          this.hideDialog();
          this.loadPersonas();
        } else {
          this.formError = response.message || 'Error al actualizar la persona';
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
    Object.keys(this.personaForm.controls).forEach(key => {
      this.personaForm.get(key)?.markAsDirty();
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
    return this.personaForm.controls;
  }

  loadPersonas(): void {
    console.log('[PersonaList] Loading personas...');
    this.loading = true;
    this.error = '';

    this.personaService.getAll().subscribe({
      next: (response) => {
        console.log('[PersonaList] Response:', response);
        if (response.success) {
          this.personas = response.data || [];
          this.filteredPersonas = [...this.personas];
        } else {
          this.error = 'Error al cargar las personas';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('[PersonaList] Error:', err);
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
      this.filteredPersonas = [...this.personas];
    } else {
      const activoValue = Number(value);
      this.filteredPersonas = this.personas.filter(p => p.activo === activoValue || p.activo === (activoValue === 1));
    }
  }

  deletePersona(id: number): void {
    this.confirmationService.confirm({
      message: '¿Está seguro de desactivar esta persona?',
      header: 'Confirmar Desactivación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.personaService.delete(id).subscribe({
          next: (response) => {
            if (response.success) {
              this.messageService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Persona desactivada exitosamente'
              });
              this.loadPersonas();
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: response.message || 'Error al desactivar la persona'
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

  trackByPersonaId(index: number, persona: Persona): number {
    return persona.id_persona;
  }
}
