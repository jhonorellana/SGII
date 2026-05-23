import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface VentaInversion {
  id_venta_inversion?: number;
  id_inversion: number;
  id_instrumento?: number;
  id_tipo_venta?: number;
  porcentaje_vendido?: number;
  fecha_venta: string;
  liquidacion_venta?: string;
  precio_venta?: number;
  precio_neto_venta?: number;
  interes_previo_venta?: number;
  valor_venta_sin_comision?: number;
  comision_operador?: number;
  comision_bolsa?: number;
  valor_venta_con_comision?: number;
  utilidad_sin_comision?: number;
  utilidad_con_comision?: number;
  ganancia_perdida?: number;
  rendimiento_total?: number;
  dias_transcurridos?: number;
  roi?: number;
  ganancia_anual?: number;
  comisiones_santa_fe?: number;
  retenciones?: number;
  observacion?: string;
  activo?: boolean;
  eliminado?: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  inversion?: any;
  instrumento?: any;
  tipoVenta?: any;
}

export interface CalculoUtilidadRequest {
  id_inversion: number;
  precio_venta: number;
  porcentaje_vendido?: number;
  comision_operador?: number;
  comision_bolsa?: number;
}

export interface CalculoUtilidadResponse {
  utilidad_sin_comision: number;
  utilidad_con_comision: number;
  ganancia_perdida: number;
  rendimiento_total: number;
  dias_transcurridos: number;
  roi: number;
  ganancia_anual: number;
}

@Injectable({
  providedIn: 'root'
})
export class VentaInversionService {
  private endpoint = 'ventas-inversion';

  constructor(private apiService: ApiService) {}

  getAll(filters?: {
    id_inversion?: number;
    id_instrumento?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
  }): Observable<ApiResponse<VentaInversion[]>> {
    let url = this.endpoint;
    const params: string[] = [];

    if (filters) {
      if (filters.id_inversion) params.push(`id_inversion=${filters.id_inversion}`);
      if (filters.id_instrumento) params.push(`id_instrumento=${filters.id_instrumento}`);
      if (filters.fecha_desde) params.push(`fecha_desde=${filters.fecha_desde}`);
      if (filters.fecha_hasta) params.push(`fecha_hasta=${filters.fecha_hasta}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return this.apiService.get<VentaInversion[]>(url);
  }

  getById(id: number): Observable<ApiResponse<VentaInversion>> {
    return this.apiService.get<VentaInversion>(`${this.endpoint}/${id}`);
  }

  create(venta: VentaInversion): Observable<ApiResponse<VentaInversion>> {
    return this.apiService.post<VentaInversion>(this.endpoint, venta);
  }

  update(id: number, venta: VentaInversion): Observable<ApiResponse<VentaInversion>> {
    return this.apiService.put<VentaInversion>(`${this.endpoint}/${id}`, venta);
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiService.delete<any>(`${this.endpoint}/${id}`);
  }

  calcularUtilidad(request: CalculoUtilidadRequest): Observable<ApiResponse<CalculoUtilidadResponse>> {
    return this.apiService.post<CalculoUtilidadResponse>(`${this.endpoint}/calcular-utilidad`, request);
  }
}
