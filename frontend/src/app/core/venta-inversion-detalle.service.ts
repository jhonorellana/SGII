import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface VentaInversionDetalle {
  id_venta_inversion_detalle?: number;
  id_venta_inversion: number;
  id_inversion: number;
  valor_nominal: number;
  valor_compra: number;
  porcentaje_compra?: number;
  valor_venta_asignado: number;
  porcentaje_venta?: number;
  utilidad: number;
  rendimiento: number;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  inversion?: any;
  ventaInversion?: any;
}

@Injectable({
  providedIn: 'root'
})
export class VentaInversionDetalleService {
  private endpoint = 'ventas-inversion-detalles';

  constructor(private apiService: ApiService) {}

  getAll(filters?: {
    id_venta_inversion?: number;
    id_inversion?: number;
  }): Observable<ApiResponse<VentaInversionDetalle[]>> {
    let url = this.endpoint;
    const params: string[] = [];

    if (filters) {
      if (filters.id_venta_inversion) params.push(`id_venta_inversion=${filters.id_venta_inversion}`);
      if (filters.id_inversion) params.push(`id_inversion=${filters.id_inversion}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return this.apiService.get<VentaInversionDetalle[]>(url);
  }

  getById(id: number): Observable<ApiResponse<VentaInversionDetalle>> {
    return this.apiService.get<VentaInversionDetalle>(`${this.endpoint}/${id}`);
  }

  create(detalle: VentaInversionDetalle): Observable<ApiResponse<VentaInversionDetalle>> {
    return this.apiService.post<VentaInversionDetalle>(this.endpoint, detalle);
  }

  update(id: number, detalle: VentaInversionDetalle): Observable<ApiResponse<VentaInversionDetalle>> {
    return this.apiService.put<VentaInversionDetalle>(`${this.endpoint}/${id}`, detalle);
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiService.delete<any>(`${this.endpoint}/${id}`);
  }

  getByVenta(id_venta_inversion: number): Observable<ApiResponse<VentaInversionDetalle[]>> {
    return this.apiService.get<VentaInversionDetalle[]>(`${this.endpoint}/venta/${id_venta_inversion}`);
  }
}
