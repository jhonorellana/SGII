import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface VencimientoMensual {
  anio: number;
  mes: number;
  nombre_mes: string;
  interes: number;
  capital: number;
  premio: number;
  total: number;
  es_mes_actual?: boolean;
}

export interface ResumenAnual {
  tipo: 'TOTAL' | 'EJECUTADO' | 'PENDIENTE';
  interes: number;
  capital: number;
  premio: number;
  total: number;
}

export interface VencimientosMensualesResponse {
  vencimientos: VencimientoMensual[];
  resumen_anual: ResumenAnual[];
}

@Injectable({
  providedIn: 'root'
})
export class VencimientosMensualesService {
  private apiUrl = '/api/reportes/vencimientos-mensuales';

  constructor(private http: HttpClient) {}

  getVencimientosMensuales(anio: number, mes?: number): Observable<VencimientosMensualesResponse> {
    let url = `${this.apiUrl}?anio=${anio}`;
    if (mes) {
      url += `&mes=${mes}`;
    }
    return this.http.get<VencimientosMensualesResponse>(url);
  }

  exportarExcel(anio: number, mes?: number): Observable<Blob> {
    let url = `${this.apiUrl}/exportar/excel?anio=${anio}`;
    if (mes) {
      url += `&mes=${mes}`;
    }
    return this.http.get(url, { responseType: 'blob' });
  }

  exportarPDF(anio: number, mes?: number): Observable<Blob> {
    let url = `${this.apiUrl}/exportar/pdf?anio=${anio}`;
    if (mes) {
      url += `&mes=${mes}`;
    }
    return this.http.get(url, { responseType: 'blob' });
  }
}
