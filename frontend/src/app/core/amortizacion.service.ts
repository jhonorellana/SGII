import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Amortizacion {
  id_amortizacion?: number;
  id_inversion: number;
  numero_cuota?: number;
  fecha_pago: string;
  interes?: number;
  capital?: number;
  descuento?: number;
  total?: number;
  int_parcial?: number;
  retencion?: number;
  id_estado_amortizacion: number;
  pagada?: boolean;
  activo: boolean;
  eliminado?: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  inversion?: any;
  estadoAmortizacion?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AmortizacionService {
  private apiUrl = 'http://127.0.0.1:8000/api/amortizaciones';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Amortizacion[]> {
    return this.http.get<Amortizacion[]>(this.apiUrl).pipe(
      map((data: Amortizacion[]) => data.map((a: Amortizacion) => ({
        ...a,
        pagada: typeof a.pagada === 'boolean' ? a.pagada : a.pagada === 1 || a.pagada === '1',
        activo: typeof a.activo === 'boolean' ? a.activo : a.activo === 1 || a.activo === '1',
        eliminado: typeof a.eliminado === 'boolean' ? a.eliminado : a.eliminado === 1 || a.eliminado === '1'
      })))
    );
  }

  getById(id: number): Observable<Amortizacion> {
    return this.http.get<Amortizacion>(`${this.apiUrl}/${id}`);
  }

  getByInversion(idInversion: number): Observable<Amortizacion[]> {
    return this.http.get<Amortizacion[]>(`${this.apiUrl}/inversion/${idInversion}`).pipe(
      map((data: Amortizacion[]) => data.map((a: Amortizacion) => ({
        ...a,
        pagada: typeof a.pagada === 'boolean' ? a.pagada : a.pagada === 1 || a.pagada === '1',
        activo: typeof a.activo === 'boolean' ? a.activo : a.activo === 1 || a.activo === '1',
        eliminado: typeof a.eliminado === 'boolean' ? a.eliminado : a.eliminado === 1 || a.eliminado === '1'
      })))
    );
  }

  create(amortizacion: Amortizacion): Observable<Amortizacion> {
    return this.http.post<Amortizacion>(this.apiUrl, amortizacion);
  }

  update(id: number, amortizacion: Amortizacion): Observable<Amortizacion> {
    return this.http.put<Amortizacion>(`${this.apiUrl}/${id}`, amortizacion);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
