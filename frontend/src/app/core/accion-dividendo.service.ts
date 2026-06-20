import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AccionDividendo } from './models/accion-models';
import { ApiResponse } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class AccionDividendoService {
  private apiUrl = environment.apiUrl + '/acciones/dividendos';

  constructor(private http: HttpClient) {}

  getAll(filters?: {
    id_persona?: number;
    id_instrumento?: number;
    id_tipo_dividendo?: number;
    fecha_desde?: string | null;
    fecha_hasta?: string | null;
  }): Observable<ApiResponse<AccionDividendo[]>> {
    let params = new HttpParams();
    if (filters?.id_persona) {
      params = params.set('id_persona', filters.id_persona.toString());
    }
    if (filters?.id_instrumento) {
      params = params.set('id_instrumento', filters.id_instrumento.toString());
    }
    if (filters?.id_tipo_dividendo) {
      params = params.set('id_tipo_dividendo', filters.id_tipo_dividendo.toString());
    }
    if (filters?.fecha_desde) {
      params = params.set('fecha_desde', filters.fecha_desde);
    }
    if (filters?.fecha_hasta) {
      params = params.set('fecha_hasta', filters.fecha_hasta);
    }

    return this.http.get<ApiResponse<AccionDividendo[]>>(this.apiUrl, { params }).pipe(
      map(response => {
        if (response.success && response.data) {
          response.data = response.data.map(div => this.castNumericFields(div));
        }
        return response;
      })
    );
  }

  getById(id: number): Observable<ApiResponse<AccionDividendo>> {
    return this.http.get<ApiResponse<AccionDividendo>>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (response.success && response.data) {
          response.data = this.castNumericFields(response.data);
        }
        return response;
      })
    );
  }

  create(dividendo: AccionDividendo): Observable<ApiResponse<AccionDividendo>> {
    return this.http.post<ApiResponse<AccionDividendo>>(this.apiUrl, dividendo);
  }

  update(id: number, dividendo: AccionDividendo): Observable<ApiResponse<AccionDividendo>> {
    return this.http.put<ApiResponse<AccionDividendo>>(`${this.apiUrl}/${id}`, dividendo);
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/${id}`);
  }

  private castNumericFields(div: AccionDividendo): AccionDividendo {
    return {
      ...div,
      cantidad_acciones_base: parseFloat(div.cantidad_acciones_base.toString()),
      dividendo_por_accion: parseFloat(div.dividendo_por_accion.toString()),
      valor_bruto: parseFloat(div.valor_bruto.toString()),
      retencion: parseFloat(div.retencion.toString()),
      valor_neto: parseFloat(div.valor_neto.toString()),
      acciones_recibidas: div.acciones_recibidas ? parseFloat(div.acciones_recibidas.toString()) : undefined,
      factor_acciones: div.factor_acciones ? parseFloat(div.factor_acciones.toString()) : undefined,
      precio_referencial_accion: div.precio_referencial_accion ? parseFloat(div.precio_referencial_accion.toString()) : undefined,
      valor_referencial_acciones: div.valor_referencial_acciones ? parseFloat(div.valor_referencial_acciones.toString()) : undefined
    };
  }
}
