import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AccionPosicion } from './models/accion-models';
import { ApiResponse } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class AccionPosicionService {
  private apiUrl = environment.apiUrl + '/acciones/posicion';

  constructor(private http: HttpClient) {}

  getPosiciones(filters?: { id_persona?: number; id_instrumento?: number }): Observable<ApiResponse<AccionPosicion[]>> {
    let params = new HttpParams();
    if (filters?.id_persona) {
      params = params.set('id_persona', filters.id_persona.toString());
    }
    if (filters?.id_instrumento) {
      params = params.set('id_instrumento', filters.id_instrumento.toString());
    }

    return this.http.get<ApiResponse<AccionPosicion[]>>(this.apiUrl, { params }).pipe(
      map(response => {
        if (response.success && response.data) {
          response.data = response.data.map(pos => ({
            ...pos,
            cantidad_actual: parseFloat(pos.cantidad_actual.toString()),
            precio_ultimo: pos.precio_ultimo ? parseFloat(pos.precio_ultimo.toString()) : undefined,
            valor_mercado: pos.valor_mercado ? parseFloat(pos.valor_mercado.toString()) : undefined,
            costo_promedio_unitario: pos.costo_promedio_unitario ? parseFloat(pos.costo_promedio_unitario.toString()) : undefined,
            capital_invertido: pos.capital_invertido ? parseFloat(pos.capital_invertido.toString()) : undefined,
            utilidad_perdida_no_realizada: pos.utilidad_perdida_no_realizada ? parseFloat(pos.utilidad_perdida_no_realizada.toString()) : undefined
          }));
        }
        return response;
      })
    );
  }

  getSocioPosicion(idPersona: number, idInstrumento: number): Observable<ApiResponse<AccionPosicion>> {
    const params = new HttpParams()
      .set('id_persona', idPersona.toString())
      .set('id_instrumento', idInstrumento.toString());

    return this.http.get<ApiResponse<AccionPosicion>>(`${this.apiUrl}/info`, { params }).pipe(
      map(response => {
        if (response.success && response.data) {
          response.data = {
            ...response.data,
            cantidad_actual: parseFloat(response.data.cantidad_actual.toString()),
            precio_ultimo: response.data.precio_ultimo ? parseFloat(response.data.precio_ultimo.toString()) : undefined,
            valor_mercado: response.data.valor_mercado ? parseFloat(response.data.valor_mercado.toString()) : undefined,
            costo_promedio_unitario: response.data.costo_promedio_unitario ? parseFloat(response.data.costo_promedio_unitario.toString()) : undefined,
            capital_invertido: response.data.capital_invertido ? parseFloat(response.data.capital_invertido.toString()) : undefined,
            utilidad_perdida_no_realizada: response.data.utilidad_perdida_no_realizada ? parseFloat(response.data.utilidad_perdida_no_realizada.toString()) : undefined
          };
        }
        return response;
      })
    );
  }
}
