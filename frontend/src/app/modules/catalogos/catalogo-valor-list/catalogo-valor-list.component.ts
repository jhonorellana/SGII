import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CatalogoService, Catalogo, CatalogoValor } from '../../../core/catalogo.service';

@Component({
  selector: 'app-catalogo-valor-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './catalogo-valor-list.component.html',
  styleUrl: './catalogo-valor-list.component.css'
})
export class CatalogoValorListComponent implements OnInit, OnDestroy {
  valores: CatalogoValor[] = [];
  catalogo: Catalogo | null = null;
  catalogoId: number | null = null;
  loading = false;
  error = '';
  private routeSub: Subscription;

  constructor(
    private catalogoService: CatalogoService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.routeSub = new Subscription();
  }

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe(params => {
      if (params['id']) {
        this.catalogoId = +params['id'];
        this.loadCatalogo();
        this.loadValores();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
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
        console.error('Error al cargar el catálogo');
      }
    });
  }

  loadValores(): void {
    if (!this.catalogoId) return;

    this.loading = true;
    this.error = '';

    this.catalogoService.getValoresByCatalogo(this.catalogoId).subscribe({
      next: (response) => {
        if (response.success) {
          this.valores = response.data;
        } else {
          this.error = 'Error al cargar los valores del catálogo';
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Error de conexión al servidor';
        this.loading = false;
      }
    });
  }

  deleteValor(id: number): void {
    if (confirm('¿Está seguro de eliminar este valor del catálogo?')) {
      this.catalogoService.deleteCatalogoValor(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadValores();
          } else {
            alert(response.message || 'Error al eliminar el valor');
          }
        },
        error: () => {
          alert('Error de conexión al servidor');
        }
      });
    }
  }

  toggleActive(valor: CatalogoValor): void {
    const action = valor.activo ? 'desactivar' : 'activar';
    if (confirm(`¿Está seguro de ${action} este valor del catálogo?`)) {
      this.catalogoService.toggleActiveCatalogoValor(valor.id_catalogo_valor).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadValores();
          } else {
            alert(response.message || 'Error al cambiar estado del valor');
          }
        },
        error: () => {
          alert('Error de conexión al servidor');
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/catalogos']);
  }

  trackByValorId(index: number, valor: CatalogoValor): number {
    return valor.id_catalogo_valor;
  }

  get activosCount(): number {
    return this.valores.filter(v => v.activo).length;
  }

  get inactivosCount(): number {
    return this.valores.filter(v => !v.activo).length;
  }
}
