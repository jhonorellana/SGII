import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface OtroValor {
  id_otro_valor: number;
  id_grupo_familiar: number;
  id_propietario: number | null;
  id_tipo_otro_valor: number;
  descripcion: string;
  valor: number;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  activo: boolean;
  eliminado: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;

  // Relaciones
  grupoFamiliar?: any;
  propietario?: any;
  tipoValor?: any;

  // Propiedades calculadas
  valorFormateado?: string;
  tipoNombre?: string;
  propietarioNombre?: string;
  grupoFamiliarNombre?: string;
}

export interface CreateOtroValorRequest {
  id_grupo_familiar: number;
  id_propietario?: number | null;
  id_tipo_otro_valor: number;
  descripcion: string;
  valor: number;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  activo?: boolean;
}

export interface UpdateOtroValorRequest {
  id_grupo_familiar?: number;
  id_propietario?: number | null;
  id_tipo_otro_valor?: number;
  descripcion?: string;
  valor?: number;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  activo?: boolean;
}

export interface ResumenGrupo {
  grupo_familiar: any;
  total_activos: number;
  total_pasivos: number;
  patrimonio_neto: number;
  cantidad_valores: number;
  valores: OtroValor[];
}

@Injectable({
  providedIn: 'root'
})
export class OtroValorService {
  private apiUrl = environment.apiUrl;
  private token: string | null = null;

  constructor(private http: HttpClient) {
    this.token = this.isBrowser() ? localStorage.getItem('token') : null;
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders();
    if (this.token) {
      headers = headers.set('Authorization', `Bearer ${this.token}`);
    }
    headers = headers.set('Content-Type', 'application/json');
    return headers;
  }

  // CRUD Básico
  getOtrosValores(params?: any): Observable<any> {
    const queryString = params ? this.buildQueryString(params) : '';
    return this.http.get<any>(`${this.apiUrl}/otros-valores${queryString}`, { headers: this.getHeaders() })
      .pipe(
        map((response: any) => {
          if (response.success && response.data) {
            response.data = response.data.map((item: any) => this.mapFromBackend(item));
          }
          return response;
        })
      );
  }

  getOtroValor(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/otros-valores/${id}`, { headers: this.getHeaders() })
      .pipe(
        map((response: any) => {
          if (response.success && response.data) {
            response.data = this.mapFromBackend(response.data);
          }
          return response;
        })
      );
  }

  createOtroValor(valor: CreateOtroValorRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/otros-valores`, valor, { headers: this.getHeaders() });
  }

  updateOtroValor(id: number, valor: UpdateOtroValorRequest): Observable<any> {
    return this.http.put(`${this.apiUrl}/otros-valores/${id}`, valor, { headers: this.getHeaders() });
  }

  deleteOtroValor(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/otros-valores/${id}`, { headers: this.getHeaders() });
  }

  // Métodos especializados
  toggleActiveOtroValor(id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/otros-valores/${id}/toggle-active`, {}, { headers: this.getHeaders() });
  }

  getResumenByGrupo(idGrupo: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/otros-valores/grupo/${idGrupo}/resumen`, { headers: this.getHeaders() });
  }

  getAll(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/otros-valores`, { headers: this.getHeaders() })
      .pipe(
        map((response: any) => {
          if (response.success && response.data) {
            response.data = response.data.map((item: any) => this.mapFromBackend(item));
          }
          return response;
        })
      );
  }

  private mapFromBackend(data: any): OtroValor {
    return {
      ...data,
      grupoFamiliar: data.grupo_familiar,
      propietario: data.propietario,
      tipoValor: data.tipo_valor,
      valor: typeof data.valor === 'string' ? parseFloat(data.valor) : data.valor,
      tipoNombre: data.tipo_valor?.nombre || 'N/A',
      propietarioNombre: data.propietario ? `${data.propietario.nombres} ${data.propietario.apellidos}`.trim() : 'N/A',
      grupoFamiliarNombre: data.grupo_familiar?.nombre || 'N/A'
    };
  }

  getTipos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/otros-valores/tipos`, { headers: this.getHeaders() });
  }

  // Métodos de utilidad
  private buildQueryString(params: any): string {
    const query = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    return query ? `?${query}` : '';
  }

  // Métodos de formato
  formatValor(valor: number): string {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(valor);
  }

  getTipoClaseCss(valor: number): string {
    if (valor > 0) {
      return 'text-green-600';
    } else if (valor < 0) {
      return 'text-red-600';
    }
    return 'text-gray-600';
  }

  esPositivo(valor: number): boolean {
    return valor > 0;
  }

  esNegativo(valor: number): boolean {
    return valor < 0;
  }

  esVigente(fechaDesde: string | null, fechaHasta: string | null): boolean {
    if (!fechaDesde && !fechaHasta) {
      return true;
    }

    const hoy = new Date();
    const desde = fechaDesde ? new Date(fechaDesde) : null;
    const hasta = fechaHasta ? new Date(fechaHasta) : null;

    const desdeValido = !desde || desde <= hoy;
    const hastaValido = !hasta || hasta >= hoy;

    return desdeValido && hastaValido;
  }

  // Métodos de cálculo
  calcularPatrimonio(valores: OtroValor[]): number {
    return valores.reduce((total, valor) => total + valor.valor, 0);
  }

  calcularActivos(valores: OtroValor[]): number {
    return valores
      .filter(v => v.valor > 0)
      .reduce((total, valor) => total + valor.valor, 0);
  }

  calcularPasivos(valores: OtroValor[]): number {
    return Math.abs(
      valores
        .filter(v => v.valor < 0)
        .reduce((total, valor) => total + valor.valor, 0)
    );
  }

  // Métodos de filtrado
  filtrarPorGrupo(valores: OtroValor[], idGrupo: number): OtroValor[] {
    return valores.filter(v => v.id_grupo_familiar === idGrupo);
  }

  filtrarPorPropietario(valores: OtroValor[], idPropietario: number): OtroValor[] {
    return valores.filter(v => v.id_propietario === idPropietario);
  }

  filtrarPorTipo(valores: OtroValor[], idTipo: number): OtroValor[] {
    return valores.filter(v => v.id_tipo_otro_valor === idTipo);
  }

  filtrarVigentes(valores: OtroValor[]): OtroValor[] {
    return valores.filter(v => this.esVigente(v.fecha_desde, v.fecha_hasta));
  }

  filtrarActivos(valores: OtroValor[]): OtroValor[] {
    return valores.filter(v => v.activo && !v.eliminado);
  }
}
