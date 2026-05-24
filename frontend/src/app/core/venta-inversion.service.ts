import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface VentaInversion {
  id_venta_inversion?: number;
  id_inversion: number | null; // null para ventas agrupadas
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
  detalles?: VentaInversionDetalle[];
}

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

export interface VentaAgrupadaRequest {
  inversiones: number[];
  id_persona: number;
  porcentaje_venta?: number;
  valor_total_recibido?: number;
  fecha_venta: string;
  liquidacion_venta?: string;
  comision_operador?: number;
  comision_bolsa?: number;
  id_cuenta_bancaria?: number;
  observacion?: string;
}

export interface ResumenCompraResponse {
  success: boolean;
  data?: {
    inversiones_count: number;
    valor_nominal_total: number;
    valor_compra_total: number;
    porcentaje_compra_promedio: number;
    detalles: Array<{
      id_inversion: number;
      valor_nominal: number;
      valor_compra: number;
      porcentaje_compra: number;
      fecha_compra: string;
      instrumento: string;
    }>;
  };
  message?: string;
}

export interface PrevisualizarVentaResponse {
  success: boolean;
  data?: {
    resumen_compra: any;
    valor_venta_total: number;
    comision_operador: number;
    comision_bolsa: number;
    total_comisiones: number;
    valor_neto_recibido: number;
    utilidad_total: number;
    roi_total: number;
    detalles_distribucion: Array<{
      id_inversion: number;
      valor_nominal: number;
      valor_compra: number;
      porcentaje_compra: number;
      valor_venta_asignado: number;
      porcentaje_venta: number;
      utilidad: number;
      rendimiento: number;
      proporcion: number;
    }>;
  };
  message?: string;
}

export interface VentaAgrupadaResponse {
  success: boolean;
  data?: {
    venta: VentaInversion;
    movimiento_capital: any;
    resumen: {
      inversiones_count: number;
      valor_nominal_total: number;
      valor_compra_total: number;
      valor_venta_total: number;
      valor_neto_recibido: number;
      utilidad_total: number;
      comisiones_total: number;
      roi_total: number;
    };
  };
  message?: string;
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

  calcularResumenCompra(inversiones: number[]): Observable<ApiResponse<ResumenCompraResponse>> {
    return this.apiService.post<ResumenCompraResponse>(`${this.endpoint}/calcular-resumen-compra`, { inversiones });
  }

  previsualizarVentaAgrupada(request: {
    inversiones: number[];
    porcentaje_venta?: number;
    valor_total_recibido?: number;
    comision_operador?: number;
    comision_bolsa?: number;
  }): Observable<ApiResponse<PrevisualizarVentaResponse>> {
    return this.apiService.post<PrevisualizarVentaResponse>(`${this.endpoint}/previsualizar-venta-agrupada`, request);
  }

  crearVentaAgrupada(request: VentaAgrupadaRequest): Observable<ApiResponse<VentaAgrupadaResponse>> {
    return this.apiService.post<VentaAgrupadaResponse>(`${this.endpoint}/venta-agrupada`, request);
  }
}
