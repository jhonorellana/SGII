import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface VencimientoMensual {
  anio: number;
  mes: number;
  nombre_mes: string;
  interes: number;
  capital: number;
  descuento: number;
  premio: number;
  interes_moroso: number;
  capital_moroso: number;
  descuento_moroso: number;
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
  success: boolean;
  data: {
    vencimientos: VencimientoMensual[];
    resumen_anual: ResumenAnual[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class VencimientosMensualesService {
  private apiUrl = 'http://localhost:8000/api/reportes/vencimientos-mensuales';

  constructor(private http: HttpClient) {}

  getVencimientosMensuales(fechaInicio: string, fechaFin: string): Observable<VencimientosMensualesResponse> {
    return this.http.get<VencimientosMensualesResponse>(`${this.apiUrl}?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`);
  }

  exportarExcel(fechaInicio: string, fechaFin: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/exportar/excel?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`);
  }

  exportarPDF(fechaInicio: string, fechaFin: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/exportar/pdf?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`);
  }
}
