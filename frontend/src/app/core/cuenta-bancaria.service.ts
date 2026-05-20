import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface CuentaBancaria {
  id_cuenta_bancaria?: number;
  id_persona: number;
  id_banco: number;
  id_tipo_cuenta?: number;
  numero_cuenta?: string;
  activo: boolean | number;
  eliminado?: boolean | number;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  persona?: any;
  banco?: any;
  tipoCuenta?: any;
}

export interface CuentaBancariaRequest {
  id_persona: number;
  id_banco: number;
  id_tipo_cuenta?: number;
  numero_cuenta?: string;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CuentaBancariaService {
  private endpoint = 'cuentas-bancarias';

  constructor(private apiService: ApiService) {}

  getAll(): Observable<ApiResponse<CuentaBancaria[]>> {
    return this.apiService.get<CuentaBancaria[]>(this.endpoint);
  }

  getById(id: number): Observable<ApiResponse<CuentaBancaria>> {
    return this.apiService.get<CuentaBancaria>(`${this.endpoint}/${id}`);
  }

  create(data: CuentaBancariaRequest): Observable<ApiResponse<CuentaBancaria>> {
    return this.apiService.post<CuentaBancaria>(this.endpoint, data);
  }

  update(id: number, data: CuentaBancariaRequest): Observable<ApiResponse<CuentaBancaria>> {
    return this.apiService.put<CuentaBancaria>(`${this.endpoint}/${id}`, data);
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiService.delete<any>(`${this.endpoint}/${id}`);
  }
}
