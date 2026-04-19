import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CatalogoService, Catalogo } from '../../../core/catalogo.service';

@Component({
  selector: 'app-catalogo-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './catalogo-list.component.html',
  styleUrl: './catalogo-list.component.css'
})
export class CatalogoListComponent implements OnInit {
  catalogos: Catalogo[] = [];
  loading = false;
  error = '';

  constructor(private catalogoService: CatalogoService) {}

  ngOnInit(): void {
    this.loadCatalogos();
  }

  loadCatalogos(): void {
    this.loading = true;
    this.error = '';

    this.catalogoService.getCatalogos().subscribe({
      next: (response) => {
        if (response.success) {
          this.catalogos = response.data;
        } else {
          this.error = 'Error al cargar los catálogos';
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Error de conexión al servidor';
        this.loading = false;
      }
    });
  }

  deleteCatalogo(id: number): void {
    if (confirm('¿Está seguro de eliminar este catálogo?')) {
      this.catalogoService.deleteCatalogo(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadCatalogos();
          } else {
            alert(response.message || 'Error al eliminar el catálogo');
          }
        },
        error: () => {
          alert('Error de conexión al servidor');
        }
      });
    }
  }

  trackByCatalogoId(index: number, catalogo: Catalogo): number {
    return catalogo.id_catalogo;
  }
}
