import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { CatalogoService, Catalogo } from '../../../core/catalogo.service';

@Component({
  selector: 'app-catalogo-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TableModule, InputTextModule, ButtonModule, TagModule],
  templateUrl: './catalogo-list.component.html',
  styleUrl: './catalogo-list.component.css'
})
export class CatalogoListComponent implements OnInit {
  catalogos: Catalogo[] = [];
  filteredCatalogos: Catalogo[] = [];
  loading = false;
  error = '';
  @ViewChild('dt') table: any;
  activoFilter: string = '';

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
          this.catalogos = response.data || [];
          this.filteredCatalogos = [...this.catalogos];
        } else {
          this.error = 'Error al cargar los catálogos';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('[CatalogoList] Error:', err);
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
      this.filteredCatalogos = [...this.catalogos];
    } else {
      const activoValue = Number(value);
      this.filteredCatalogos = this.catalogos.filter(c => c.activo === activoValue);
    }
  }

  deleteCatalogo(id: number): void {
    if (confirm('¿Está seguro de desactivar este catálogo?')) {
      this.catalogoService.deleteCatalogo(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadCatalogos();
          } else {
            alert(response.message || 'Error al desactivar el catálogo');
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
