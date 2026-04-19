import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Catalogo {
  id_catalogo: number;
  nombre: string;
  descripcion?: string;
  codigo: string;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
  valores?: CatalogoValor[];
}

export interface CatalogoValor {
  id_catalogo_valor: number;
  id_catalogo: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  orden_visual: number;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
  catalogo?: Catalogo;
}

export interface CreateCatalogoRequest {
  nombre: string;
  descripcion?: string;
  codigo: string;
}

export interface UpdateCatalogoRequest extends CreateCatalogoRequest {
  activo?: boolean;
}

export interface CreateCatalogoValorRequest {
  id_catalogo: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  orden_visual: number;
}

export interface UpdateCatalogoValorRequest extends CreateCatalogoValorRequest {
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CatalogoService {
  constructor(private apiService: ApiService) {}

  // Catálogos
  getCatalogos(): Observable<any> {
    return this.apiService.get<Catalogo[]>('catalogos');
  }

  getCatalogo(id: number): Observable<any> {
    return this.apiService.get<Catalogo>(`catalogos/${id}`);
  }

  createCatalogo(catalogo: CreateCatalogoRequest): Observable<any> {
    return this.apiService.post<Catalogo>('catalogos', catalogo);
  }

  updateCatalogo(id: number, catalogo: UpdateCatalogoRequest): Observable<any> {
    return this.apiService.put<Catalogo>(`catalogos/${id}`, catalogo);
  }

  deleteCatalogo(id: number): Observable<any> {
    return this.apiService.delete(`catalogos/${id}`);
  }

  getValoresByCodigo(codigo: string): Observable<any> {
    return this.apiService.get<CatalogoValor[]>(`catalogos/${codigo}/valores`);
  }

  // Valores de Catálogo
  getCatalogoValores(): Observable<any> {
    return this.apiService.get<CatalogoValor[]>('catalogo-valores');
  }

  getCatalogoValor(id: number): Observable<any> {
    return this.apiService.get<CatalogoValor>(`catalogo-valores/${id}`);
  }

  getValoresByCatalogo(idCatalogo: number): Observable<any> {
    return this.apiService.get<CatalogoValor[]>(`catalogo-valores/catalogo/${idCatalogo}`);
  }

  createCatalogoValor(valor: CreateCatalogoValorRequest): Observable<any> {
    return this.apiService.post<CatalogoValor>('catalogo-valores', valor);
  }

  updateCatalogoValor(id: number, valor: UpdateCatalogoValorRequest): Observable<any> {
    return this.apiService.put<CatalogoValor>(`catalogo-valores/${id}`, valor);
  }

  deleteCatalogoValor(id: number): Observable<any> {
    return this.apiService.delete(`catalogo-valores/${id}`);
  }

  toggleActiveCatalogoValor(id: number): Observable<any> {
    return this.apiService.patch(`catalogo-valores/${id}/toggle-active`, {});
  }

  getCatalogoValorById(id: number): Observable<any> {
    return this.apiService.get(`catalogo-valores/${id}`);
  }

  createCatalogoValorById(data: any): Observable<any> {
    return this.apiService.post('catalogo-valores', data);
  }

  updateCatalogoValorById(id: number, data: any): Observable<any> {
    return this.apiService.put(`catalogo-valores/${id}`, data);
  }
}
