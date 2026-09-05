import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface ValoracionSerieRecord {
  fecha: string;
  cantidad_acciones: number;
  valor_mercado: number;
  costo_invertido: number;
  plusvalia_monto: number;
  plusvalia_pct: number;
  precio_promedio_mercado: number;
}

export interface ValoracionResumen {
  valor_mercado_actual: number;
  cantidad_actual: number;
  costo_actual: number;
  plusvalia_actual_monto: number;
  plusvalia_actual_pct: number;
}

export interface ValoracionHistoricaData {
  serie: ValoracionSerieRecord[];
  resumen: ValoracionResumen;
  emisores: { id_emisor: number; nombre: string }[];
}

export interface ValoracionFiltros {
  fecha_inicio?: string;
  fecha_fin?: string;
  id_emisor?: number;
  id_propietario?: number;
  id_grupo_familiar?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ValoracionHistoricaService {
  constructor(private apiService: ApiService) {}

  getValoracionHistorica(filtros?: ValoracionFiltros): Observable<ApiResponse<ValoracionHistoricaData>> {
    let params = '';
    if (filtros) {
      const queryParts: string[] = [];
      if (filtros.fecha_inicio) queryParts.push(`fecha_inicio=${filtros.fecha_inicio}`);
      if (filtros.fecha_fin) queryParts.push(`fecha_fin=${filtros.fecha_fin}`);
      if (filtros.id_emisor) queryParts.push(`id_emisor=${filtros.id_emisor}`);
      if (filtros.id_propietario) queryParts.push(`id_propietario=${filtros.id_propietario}`);
      if (filtros.id_grupo_familiar) queryParts.push(`id_grupo_familiar=${filtros.id_grupo_familiar}`);
      if (queryParts.length > 0) {
        params = '?' + queryParts.join('&');
      }
    }
    return this.apiService.get<ValoracionHistoricaData>(`reportes/valoracion-historica-acciones${params}`);
  }
}
