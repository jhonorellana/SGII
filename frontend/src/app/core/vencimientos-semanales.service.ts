import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface VencimientoSemanal {
  fecha: string;
  nombre_dia: string;
  interes: number;
  capital: number;
  descuento: number;
  premio: number;
  interes_moroso: number;
  capital_moroso: number;
  descuento_moroso: number;
  total: number;
  es_hoy?: boolean;
}

export interface ResumenSemanal {
  tipo: 'TOTAL' | 'EJECUTADO' | 'PENDIENTE';
  interes: number;
  capital: number;
  premio: number;
  total: number;
}

export interface VencimientosSemanalesResponse {
  success: boolean;
  data: {
    vencimientos: VencimientoSemanal[];
    resumen_semanal: ResumenSemanal[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class VencimientosSemanalesService {
  private apiUrl = 'http://localhost:8000/api/reportes/vencimientos-semanales';

  constructor(private http: HttpClient) {}

  getVencimientosSemanales(fecha?: string): Observable<VencimientosSemanalesResponse> {
    let url = this.apiUrl;
    if (fecha) {
      url += `?fecha=${fecha}`;
    }
    return this.http.get<VencimientosSemanalesResponse>(url);
  }

  exportarExcel(fecha?: string): Observable<any> {
    let url = `${this.apiUrl}/exportar/excel`;
    if (fecha) {
      url += `?fecha=${fecha}`;
    }
    return this.http.get(url);
  }

  exportarPDF(fecha?: string): Observable<any> {
    let url = `${this.apiUrl}/exportar/pdf`;
    if (fecha) {
      url += `?fecha=${fecha}`;
    }
    return this.http.get(url);
  }

  getDetalleVencimientosSemanales(fecha: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/detalle?fecha=${fecha}`);
  }
}
