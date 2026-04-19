import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CatalogoService, Catalogo, CreateCatalogoRequest, UpdateCatalogoRequest } from '../../../core/catalogo.service';

@Component({
  selector: 'app-catalogo-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './catalogo-form.component.html',
  styleUrl: './catalogo-form.component.css'
})
export class CatalogoFormComponent implements OnInit, OnDestroy {
  catalogoForm: FormGroup;
  isEdit = false;
  catalogoId: number | null = null;
  loading = false;
  error = '';
  success = '';
  private routeSub: Subscription;

  constructor(
    private fb: FormBuilder,
    private catalogoService: CatalogoService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.catalogoForm = this.createForm();
    this.routeSub = new Subscription();
  }

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEdit = true;
        this.catalogoId = +params['id'];
        this.loadCatalogo();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  createForm(): FormGroup {
    return this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      codigo: ['', [Validators.required, Validators.maxLength(50)]],
      descripcion: ['', Validators.maxLength(255)],
      activo: [true]
    });
  }

  loadCatalogo(): void {
    if (!this.catalogoId) return;

    this.loading = true;
    this.error = '';

    this.catalogoService.getCatalogo(this.catalogoId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const catalogo = response.data;
          this.catalogoForm.patchValue({
            nombre: catalogo.nombre,
            codigo: catalogo.codigo,
            descripcion: catalogo.descripcion || '',
            activo: catalogo.activo
          });
        } else {
          this.error = 'Error al cargar el catálogo';
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Error de conexión al servidor';
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.catalogoForm.invalid) {
      this.markFormAsDirty();
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

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
          this.success = 'Catálogo creado exitosamente';
          setTimeout(() => {
            this.router.navigate(['/catalogos']);
          }, 1500);
        } else {
          this.error = response.message || 'Error al crear el catálogo';
        }
        this.loading = false;
      },
      error: (err) => {
        if (err.error && err.error.errors) {
          this.error = this.formatValidationErrors(err.error.errors);
        } else {
          this.error = 'Error de conexión al servidor';
        }
        this.loading = false;
      }
    });
  }

  updateCatalogo(id: number, data: UpdateCatalogoRequest): void {
    this.catalogoService.updateCatalogo(id, data).subscribe({
      next: (response) => {
        if (response.success) {
          this.success = 'Catálogo actualizado exitosamente';
          setTimeout(() => {
            this.router.navigate(['/catalogos']);
          }, 1500);
        } else {
          this.error = response.message || 'Error al actualizar el catálogo';
        }
        this.loading = false;
      },
      error: (err) => {
        if (err.error && err.error.errors) {
          this.error = this.formatValidationErrors(err.error.errors);
        } else {
          this.error = 'Error de conexión al servidor';
        }
        this.loading = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/catalogos']);
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

  // Getters para validación en template
  get f() {
    return this.catalogoForm.controls;
  }
}
