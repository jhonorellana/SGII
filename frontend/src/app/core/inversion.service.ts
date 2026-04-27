import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Inversion {
  id_inversion?: number;
  id_grupo_familiar: number;
  id_instrumento?: number;
  id_propietario: number;
  id_aportante?: number;
  liquidacion?: string;
  id_estado_inversion: number;
  fecha_compra: string;
  fecha_venta?: string;
  valor_nominal?: number;
  monto_a_negociar?: number;
  capital_invertido: number;
  tasa_interes?: number;
  rendimiento_nominal?: number;
  rendimiento_efectivo?: number;
  valor_efectivo?: number;
  valor_sin_comision?: number;
  valor_con_interes?: number;
  interes_acumulado_previo?: number;
  interes_mensual?: number;
  interes_primer_mes?: number;
  total_comisiones?: number;
  tasa_mensual_real?: number;
  fecha_primer_pago?: string;
  precio_compra?: number;
  precio_neto_compra?: number;
  comision_bolsa?: number;
  comision_casa_valores?: number;
  retencion_fuente?: number;
  observacion?: string;
  expirado?: boolean;
  activo: boolean;
  eliminado?: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  grupoFamiliar?: any;
  instrumento?: any;
  propietario?: any;
  aportante?: any;
  estadoInversion?: any;
}

@Injectable({
  providedIn: 'root'
})
export class InversionService {
  private apiUrl = 'http://127.0.0.1:8000/api/inversiones';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Inversion[]> {
    return this.http.get<Inversion[]>(this.apiUrl).pipe(
      map((data: Inversion[]) => data.map((i: Inversion) => ({
        ...i,
        activo: typeof i.activo === 'boolean' ? i.activo : i.activo === 1 || i.activo === '1',
        expirado: typeof i.expirado === 'boolean' ? i.expirado : i.expirado === 1 || i.expirado === '1',
        eliminado: typeof i.eliminado === 'boolean' ? i.eliminado : i.eliminado === 1 || i.eliminado === '1'
      })))
    );
  }

  getById(id: number): Observable<Inversion> {
    return this.http.get<Inversion>(`${this.apiUrl}/${id}`);
  }

  create(inversion: Inversion): Observable<Inversion> {
    return this.http.post<Inversion>(this.apiUrl, inversion);
  }

  update(id: number, inversion: Inversion): Observable<Inversion> {
    return this.http.put<Inversion>(`${this.apiUrl}/${id}`, inversion);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
