import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface MovimientoCapital {
  id_movimiento_capital?: number;
  fecha_movimiento: string;
  id_tipo_movimiento: number;
  id_persona?: number;
  id_signo: number;
  monto?: number;
  id_inversion?: number;
  id_accion_operacion?: number;
  id_venta_inversion?: number;
  id_cuenta_bancaria?: number;
  descripcion?: string;
  conciliado?: boolean;
  fecha_conciliacion?: string;
  activo?: boolean;
  eliminado?: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  tipoMovimiento?: any;
  tipo_movimiento?: any;
  persona?: any;
  inversion?: any;
  accion_operacion?: any;
  accionOperacion?: any;
  ventaInversion?: any;
  cuentaBancaria?: any;
  signoCatalogo?: any;
  signo_catalogo?: any;
  saldo_acumulado?: number;
}

export interface SaldoEsperado {
  saldo_esperado: number;
  total_entradas: number;
  total_salidas: number;
}

export interface EstadoCuenta {
  id_movimiento_capital: number;
  fecha_movimiento: string;
  tipo_movimiento: string;
  descripcion: string;
  inversion?: number;
  liquidacion?: string;
  monto: number;
  signo: string;
  saldo_acumulado: number;
  conciliado: boolean;
  fecha_conciliacion?: string;
}

export interface Discrepancia {
  id_movimiento_capital: number;
  fecha_movimiento: string;
  tipo_movimiento: string;
  descripcion: string;
  monto: number;
  signo: string;
  conciliado: boolean;
  motivo: string;
}

export interface ReporteCuenta {
  id_cuenta_bancaria: number;
  nombre_cuenta: string;
  saldo_contable: number;
  total_movimientos: number;
  movimientos: EstadoCuenta[];
}

@Injectable({
  providedIn: 'root'
})
export class MovimientoCapitalService {
  private endpoint = 'movimientos-capital';

  constructor(private apiService: ApiService) {}

  getAll(filters?: {
    fecha_desde?: string;
    fecha_hasta?: string;
    id_tipo_movimiento?: number;
    id_persona?: number;
    id_inversion?: number;
    id_signo?: number;
    id_cuenta_bancaria?: number;
    conciliado?: boolean;
  }): Observable<ApiResponse<MovimientoCapital[]>> {
    let url = this.endpoint;
    const params: string[] = [];

    if (filters) {
      if (filters.fecha_desde) params.push(`fecha_desde=${filters.fecha_desde}`);
      if (filters.fecha_hasta) params.push(`fecha_hasta=${filters.fecha_hasta}`);
      if (filters.id_tipo_movimiento) params.push(`id_tipo_movimiento=${filters.id_tipo_movimiento}`);
      if (filters.id_persona) params.push(`id_persona=${filters.id_persona}`);
      if (filters.id_inversion) params.push(`id_inversion=${filters.id_inversion}`);
      if (filters.id_signo) params.push(`id_signo=${filters.id_signo}`);
      if (filters.id_cuenta_bancaria) params.push(`id_cuenta_bancaria=${filters.id_cuenta_bancaria}`);
      if (filters.conciliado !== undefined) params.push(`conciliado=${filters.conciliado}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return this.apiService.get<MovimientoCapital[]>(url);
  }

  getById(id: number): Observable<ApiResponse<MovimientoCapital>> {
    return this.apiService.get<MovimientoCapital>(`${this.endpoint}/${id}`);
  }

  create(movimiento: MovimientoCapital): Observable<ApiResponse<MovimientoCapital>> {
    return this.apiService.post<MovimientoCapital>(this.endpoint, movimiento);
  }

  update(id: number, movimiento: MovimientoCapital): Observable<ApiResponse<MovimientoCapital>> {
    return this.apiService.put<MovimientoCapital>(`${this.endpoint}/${id}`, movimiento);
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiService.delete<any>(`${this.endpoint}/${id}`);
  }

  conciliarLote(ids: number[]): Observable<ApiResponse<any>> {
    return this.apiService.post<any>(`${this.endpoint}/conciliar-lote`, { ids });
  }

  getSaldoEsperado(fecha_desde?: string, fecha_hasta?: string): Observable<ApiResponse<SaldoEsperado>> {
    let url = `${this.endpoint}/saldo-esperado`;
    const params: string[] = [];

    if (fecha_desde) params.push(`fecha_desde=${fecha_desde}`);
    if (fecha_hasta) params.push(`fecha_hasta=${fecha_hasta}`);

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return this.apiService.get<SaldoEsperado>(url);
  }

  getEstadoCuenta(fecha_desde?: string, fecha_hasta?: string): Observable<ApiResponse<EstadoCuenta[]>> {
    let url = `${this.endpoint}/estado-cuenta`;
    const params: string[] = [];

    if (fecha_desde) params.push(`fecha_desde=${fecha_desde}`);
    if (fecha_hasta) params.push(`fecha_hasta=${fecha_hasta}`);

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return this.apiService.get<EstadoCuenta[]>(url);
  }

  getDiscrepancias(fecha_desde?: string, fecha_hasta?: string): Observable<ApiResponse<Discrepancia[]>> {
    let url = `${this.endpoint}/discrepancias`;
    const params: string[] = [];

    if (fecha_desde) params.push(`fecha_desde=${fecha_desde}`);
    if (fecha_hasta) params.push(`fecha_hasta=${fecha_hasta}`);

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return this.apiService.get<Discrepancia[]>(url);
  }

  getReportePorCuenta(id_cuenta_bancaria: number, fecha_desde?: string, fecha_hasta?: string): Observable<ApiResponse<ReporteCuenta>> {
    let url = `${this.endpoint}/reporte-cuenta?id_cuenta_bancaria=${id_cuenta_bancaria}`;
    const params: string[] = [];

    if (fecha_desde) params.push(`fecha_desde=${fecha_desde}`);
    if (fecha_hasta) params.push(`fecha_hasta=${fecha_hasta}`);

    if (params.length > 0) {
      url += '&' + params.join('&');
    }

    return this.apiService.get<ReporteCuenta>(url);
  }
}
