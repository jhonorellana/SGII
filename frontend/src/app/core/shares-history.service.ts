import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface SharesHistoryRecord {
  fecha: string;
  emisor: string;
  cantidad: number | string;
  valor: number | string;
  precio: number | string;
  transacciones: number | string;
}

export interface ShareDetailRecord {
  id: number;
  cantidad: number;
  precio: number;
  valor_nominal: number;
  valor_efectivo: number;
  tipo: string;
}

export interface PortfolioShareKPIs {
  precio_minimo: number;
  precio_maximo: number;
  precio_promedio: number;
  volumen_total: number;
  acciones_totales: number;
  transacciones_totales: number;
  primer_precio_periodo: number;
  ultimo_precio_periodo: number;
  variacion_periodo_pct: number;
}

export interface PortfolioShareSocio {
  id_persona: number;
  persona: string;
  cantidad: number;
  capital_invertido: number;
  valor_mercado: number;
  costo_promedio?: number;
}

export interface PortfolioShareItem {
  id_emisor: number;
  emisor_nombre: string;
  id_emisor_legacy: number | null;
  cantidad_acciones: number;
  capital_invertido: number;
  valor_mercado: number;
  utilidad_perdida_no_realizada: number;
  porcentaje_rendimiento: number;
  costo_promedio: number;
  precio_ultimo: number;
  fecha_ultimo_precio: string | null;
  variacion_diaria_pct: number;
  tendencia_diaria: string;
  socios: PortfolioShareSocio[];
  historico: SharesHistoryRecord[];
  kpis: PortfolioShareKPIs;
  // UI helper fields
  chartData?: any;
  chartOptions?: any;
}

@Injectable({
  providedIn: 'root'
})
export class SharesHistoryService {
  constructor(private apiService: ApiService) {}

  getHistorico(issuerId: number, year: number = 0): Observable<ApiResponse<SharesHistoryRecord[]>> {
    return this.apiService.get<SharesHistoryRecord[]>(
      `reportes/historico-acciones?issuer=${issuerId}&year=${year}`
    );
  }

  getHistoricoPortafolio(year: number = 2026): Observable<ApiResponse<PortfolioShareItem[]>> {
    return this.apiService.get<PortfolioShareItem[]>(
      `reportes/historico-acciones/portafolio?year=${year}`
    );
  }

  getDetallesDiarios(issuerId: number, date: string): Observable<ApiResponse<ShareDetailRecord[]>> {
    return this.apiService.get<ShareDetailRecord[]>(
      `reportes/historico-acciones/detalles?issuer=${issuerId}&date=${date}`
    );
  }
}
