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
  utilidad_con_comision?: number;
  ganancia_perdida?: number;
  rendimiento_total?: number;
  dias_transcurridos?: number;
  roi?: number;
  ganancia_anual?: number;
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
  precio?: number;
  precio_neto?: number;
  valor_total_recibido?: number;
  valor_efectivo?: number;
  utilidad_sin_comision?: number;
  utilidad_con_comision?: number;
  ganancia_perdida?: number;
  rendimiento_total?: number;
  dias_transcurridos?: number;
  roi?: number;
  ganancia_anual?: number;
  fecha_venta: string;
  liquidacion_venta?: string;
  comision_operador?: number;
  comision_bolsa?: number;
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
      propietario_nombre: string;
      valor_nominal: number;
      valor_compra: number;
      porcentaje_compra: number;
      valor_venta_asignado: number;
      porcentaje_venta: number;
      utilidad: number;
      rendimiento: number;
      proporcion: number;
      requiere_reasignacion: boolean;
      id_propietario_anterior?: number;
      id_propietario_nuevo?: number;
    }>;
    inversiones_reasignar: Array<{
      id_inversion: number;
      propietario_nombre: string;
      id_propietario_anterior: number;
      id_propietario_nuevo: number;
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

// Interfaces para venta de inversiones de renta fija
export interface Instrumento {
  id_instrumento: number;
  nombre: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  emisor?: { nombre?: string };
  tipoInversion?: any;
}

export interface InversionInfo {
  id_inversion: number;
  valor_nominal: number;
  capital_invertido: number;
  rendimiento_efectivo: number;
  fecha_compra: string;
  propietario?: { nombre?: string };
  amortizaciones?: any[];
}

export interface InfoInstrumentoResponse {
  success: boolean;
  data?: {
    instrumento?: Instrumento;
    inversiones?: InversionInfo[];
    resumen?: {
      valor_nominal_acumulado?: number;
      capital_invertido_acumulado?: number;
      rendimiento_promedio?: number;
      cantidad_inversiones?: number;
    };
  };
  message?: string;
}

export interface RegistrarVentaRequest {
  id_instrumento: number;
  tipo_venta: 'TOTAL' | 'PARCIAL';
  fecha_venta: string;
  liquidacion_venta?: string;
  precio_venta?: number;
  precio_neto_venta?: number;
  interes_previo?: number;
  comision_operador?: number;
  comision_bolsa?: number;
  retenciones?: number;
  observacion?: string;
  porcentaje_vender?: number;
  valor_nominal_vender?: number;
  // Campos calculados (se llenan en el backend)
  id_tipo_venta?: number;
  valor_venta_sin_comision?: number;
  valor_venta_con_comision?: number;
  utilidad_sin_comision?: number;
  utilidad_con_comision?: number;
  ganancia_perdida?: number;
  rendimiento_total?: number;
  dias_transcurridos?: number;
  roi?: number;
  ganancia_anual?: number;
}

export interface RegistrarVentaResponse {
  success: boolean;
  message?: string;
  data?: {
    ventas?: VentaInversion[];
    venta?: VentaInversion;
    inversion_vendida?: any;
    inversion_remanente?: any;
  };
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
    id_persona?: number;
    precio?: number;
    valor_total_recibido?: number;
    comision_operador?: number;
    comision_bolsa?: number;
  }): Observable<ApiResponse<PrevisualizarVentaResponse>> {
    return this.apiService.post<PrevisualizarVentaResponse>(`${this.endpoint}/previsualizar-venta-agrupada`, request);
  }

  crearVentaAgrupada(request: VentaAgrupadaRequest): Observable<ApiResponse<VentaAgrupadaResponse>> {
    return this.apiService.post<VentaAgrupadaResponse>(`${this.endpoint}/venta-agrupada`, request);
  }

  // Métodos para venta de inversiones de renta fija
  getPosicionesVendibles(): Observable<ApiResponse<any[]>> {
    return this.apiService.get<any[]>(`${this.endpoint}/posiciones-vendibles`);
  }

  getInfoPosicion(idInstrumento: number, idPropietario: number): Observable<ApiResponse<InfoInstrumentoResponse>> {
    return this.apiService.get<InfoInstrumentoResponse>(`${this.endpoint}/posicion/${idInstrumento}/${idPropietario}/info`);
  }

  getInstrumentosActivos(): Observable<ApiResponse<Instrumento[]>> {
    return this.apiService.get<Instrumento[]>(`${this.endpoint}/instrumentos-activos`);
  }

  getInfoInstrumento(idInstrumento: number): Observable<ApiResponse<InfoInstrumentoResponse>> {
    return this.apiService.get<InfoInstrumentoResponse>(`${this.endpoint}/instrumento/${idInstrumento}/info`);
  }

  registrarVenta(request: RegistrarVentaRequest): Observable<ApiResponse<RegistrarVentaResponse>> {
    return this.apiService.post<RegistrarVentaResponse>(`${this.endpoint}/registrar-venta`, request);
  }
}
