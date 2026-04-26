import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface Instrumento {
  id_instrumento?: number;
  id_emisor: number;
  id_tipo_inversion: number;
  codigo_titulo: string;
  nombre: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  tasa_referencial?: number;
  fechas_recuperacion?: string;
  codigo_titulo_vector?: string;
  codigo_seb?: string;
  codigo_bce?: string;
  calificacion_riesgo?: string;
  activo: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
  emisor?: any;
  tipoInversion?: any;
}

@Injectable({
  providedIn: 'root'
})
export class InstrumentoService {
  private apiUrl = 'http://127.0.0.1:8000/api/instrumentos';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Instrumento[]> {
    return this.http.get<Instrumento[]>(this.apiUrl).pipe(
      map((data: Instrumento[]) => data.map((i: Instrumento) => ({
        ...i,
        activo: typeof i.activo === 'boolean' ? i.activo : i.activo === 1 || i.activo === '1'
      })))
    );
  }

  getById(id: number): Observable<Instrumento> {
    return this.http.get<Instrumento>(`${this.apiUrl}/${id}`);
  }

  create(instrumento: Instrumento): Observable<Instrumento> {
    return this.http.post<Instrumento>(this.apiUrl, instrumento);
  }

  update(id: number, instrumento: Instrumento): Observable<Instrumento> {
    return this.http.put<Instrumento>(`${this.apiUrl}/${id}`, instrumento);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
