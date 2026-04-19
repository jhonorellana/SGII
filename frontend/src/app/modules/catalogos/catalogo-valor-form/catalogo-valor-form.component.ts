import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CatalogoService, Catalogo, CatalogoValor } from '../../../core/catalogo.service';

@Component({
  selector: 'app-catalogo-valor-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './catalogo-valor-form.component.html',
  styleUrl: './catalogo-valor-form.component.css'
})
export class CatalogoValorFormComponent implements OnInit {
  valorForm: FormGroup;
  catalogo: Catalogo | null = null;
  catalogoId: number | null = null;
  valorId: number | null = null;
  isEditMode = false;
  loading = false;
  error = '';
  success = '';
  private routeSub: Subscription;

  constructor(
    private fb: FormBuilder,
    private catalogoService: CatalogoService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.routeSub = new Subscription();
    this.valorForm = this.createForm();
  }

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe(params => {
      this.catalogoId = +params['id'];
      this.valorId = params['valorId'] ? +params['valorId'] : null;
      this.isEditMode = !!this.valorId;

      if (this.catalogoId) {
        this.loadCatalogo();
        if (this.isEditMode && this.valorId) {
          this.loadValor();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
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

  loadCatalogo(): void {
    if (!this.catalogoId) return;

    this.catalogoService.getCatalogo(this.catalogoId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.catalogo = response.data;
        }
      },
      error: () => {
        this.error = 'Error al cargar el catálogo';
      }
    });
  }

  loadValor(): void {
    if (!this.valorId) return;

    this.loading = true;
    this.catalogoService.getCatalogoValorById(this.valorId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const valor = response.data;
          this.valorForm.patchValue({
            codigo: valor.codigo,
            nombre: valor.nombre,
            descripcion: valor.descripcion || '',
            orden_visual: valor.orden_visual,
            activo: valor.activo
          });
        } else {
          this.error = 'Error al cargar el valor del catálogo';
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
    if (this.valorForm.invalid) {
      this.markFormGroupTouched(this.valorForm);
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    const formData = this.valorForm.value;

    if (this.isEditMode && this.valorId) {
      this.updateValor(this.valorId, formData);
    } else {
      this.createValor(formData);
    }
  }

  createValor(data: any): void {
    if (!this.catalogoId) return;

    const valorData = {
      ...data,
      id_catalogo: this.catalogoId
    };

    this.catalogoService.createCatalogoValorById(valorData).subscribe({
      next: (response) => {
        if (response.success) {
          this.success = 'Valor del catálogo creado exitosamente';
          setTimeout(() => {
            this.router.navigate(['/catalogos', this.catalogoId, 'valores']);
          }, 1500);
        } else {
          this.error = response.message || 'Error al crear el valor del catálogo';
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Error de conexión al servidor';
        this.loading = false;
      }
    });
  }

  updateValor(id: number, data: any): void {
    const valorData = {
      ...data,
      id_catalogo: this.catalogoId
    };
    this.catalogoService.updateCatalogoValorById(id, valorData).subscribe({
      next: (response) => {
        if (response.success) {
          this.success = 'Valor del catálogo actualizado exitosamente';
          setTimeout(() => {
            this.router.navigate(['/catalogos', this.catalogoId, 'valores']);
          }, 1500);
        } else {
          this.error = response.message || 'Error al actualizar el valor del catálogo';
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Error de conexión al servidor';
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/catalogos', this.catalogoId, 'valores']);
  }

  get f() {
    return this.valorForm.controls;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
    });
  }
}
