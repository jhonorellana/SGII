import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AccionOperacion } from './models/accion-models';
import { ApiResponse } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class AccionOperacionService {
  private apiUrl = environment.apiUrl + '/acciones/operaciones';

  constructor(private http: HttpClient) {}

  getAll(filters?: {
    id_persona?: number;
    id_instrumento?: number;
    id_tipo_operacion?: number;
    fecha_desde?: string | null;
    fecha_hasta?: string | null;
  }): Observable<ApiResponse<AccionOperacion[]>> {
    let params = new HttpParams();
    if (filters?.id_persona) {
      params = params.set('id_persona', filters.id_persona.toString());
    }
    if (filters?.id_instrumento) {
      params = params.set('id_instrumento', filters.id_instrumento.toString());
    }
    if (filters?.id_tipo_operacion) {
      params = params.set('id_tipo_operacion', filters.id_tipo_operacion.toString());
    }
    if (filters?.fecha_desde) {
      params = params.set('fecha_desde', filters.fecha_desde);
    }
    if (filters?.fecha_hasta) {
      params = params.set('fecha_hasta', filters.fecha_hasta);
    }

    return this.http.get<ApiResponse<AccionOperacion[]>>(this.apiUrl, { params }).pipe(
      map(response => {
        if (response.success && response.data) {
          response.data = response.data.map(op => this.castNumericFields(op));
        }
        return response;
      })
    );
  }

  getById(id: number): Observable<ApiResponse<AccionOperacion>> {
    return this.http.get<ApiResponse<AccionOperacion>>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (response.success && response.data) {
          response.data = this.castNumericFields(response.data);
        }
        return response;
      })
    );
  }

  create(operacion: AccionOperacion): Observable<ApiResponse<AccionOperacion>> {
    return this.http.post<ApiResponse<AccionOperacion>>(this.apiUrl, operacion);
  }

  update(id: number, operacion: AccionOperacion): Observable<ApiResponse<AccionOperacion>> {
    return this.http.put<ApiResponse<AccionOperacion>>(`${this.apiUrl}/${id}`, operacion);
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/${id}`);
  }

  private castNumericFields(op: AccionOperacion): AccionOperacion {
    return {
      ...op,
      cantidad: parseFloat(op.cantidad.toString()),
      precio_unitario: parseFloat(op.precio_unitario.toString()),
      valor_bruto: parseFloat(op.valor_bruto.toString()),
      comision_bolsa: parseFloat(op.comision_bolsa.toString()),
      comision_operador: parseFloat(op.comision_operador.toString()),
      total_comisiones: parseFloat(op.total_comisiones.toString()),
      valor_neto: parseFloat(op.valor_neto.toString()),
      costo_promedio_unitario: op.costo_promedio_unitario ? parseFloat(op.costo_promedio_unitario.toString()) : undefined,
      utilidad_perdida: op.utilidad_perdida ? parseFloat(op.utilidad_perdida.toString()) : undefined
    };
  }
}
