import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MaximosMinimosEmisor {
  codigo_seb: string;
  emisor: string;
  sector: string;
  es_liquido: boolean;
  total_sesiones: number;
  primer_registro: string;
  ultima_fecha: string;
  ultimo_cierre: number;
  ultimo_maximo: number;
  ultimo_minimo: number;
  ultimas_acciones: number;
  fecha_ult_negoc: string;
  fecha_ult_cierre: string;
  dias_inactividad: number;
  estado_liquidez: 'ALTA' | 'MODERADA' | 'BAJA';
  precios_distintos: number;
}

export interface EmisoresResponse {
  success: boolean;
  total_emisores: number;
  emisores_liquidos: number;
  data: MaximosMinimosEmisor[];
}

export interface CanalPunto {
  fecha: string;
  precio_cierre: number;
  precio_maximo: number;
  precio_minimo: number;
  num_acciones: number;
  volumen_estimado_usd: number;
  fecha_ult_negoc: string;
  es_liquido: boolean;
}

export interface ProyeccionPunto {
  dia_t: number;
  fecha_estimada: string;
  p10_conservador: number;
  p50_mediana: number;
  p90_optimista: number;
}

export interface ProyeccionHito {
  dias: number;
  fecha_estimada: string;
  escenario_pesimista_p10: number;
  escenario_base_p50: number;
  escenario_optimista_p90: number;
  variacion_base_pct: number;
  variacion_optimista_pct: number;
  variacion_pesimista_pct: number;
}

export interface ProyeccionMonteCarlo {
  precio_base: number;
  dias_simulados: number;
  num_simulaciones: number;
  curva_proyeccion: ProyeccionPunto[];
  hitos: {
    '30d'?: ProyeccionHito;
    '60d'?: ProyeccionHito;
    '90d'?: ProyeccionHito;
    [key: string]: ProyeccionHito | undefined;
  };
}

export interface CanalMetricas {
  precio_actual: number;
  precio_anterior: number;
  retorno_acumulado_periodo_pct: number;
  retorno_medio_diario_pct: number;
  volatilidad_diaria_pct: number;
  volatilidad_anualizada_pct: number;
  precio_maximo_periodo: number;
  precio_minimo_periodo: number;
  vwap_precio_ponderado: number;
  banda_actual_bvq: {
    minimo_autorizado: number;
    maximo_autorizado: number;
    tension_banda: 'NEUTRO' | 'TECHO_SOBRECOMPRA' | 'SUELO_VENTA';
  };
  dias_inactividad_mercado: number;
  volumen_total_periodo_usd: number;
  acciones_totales_periodo: number;
}

export interface CanalMetadata {
  codigo_seb: string;
  emisor: string;
  sector: string;
  es_liquido: boolean;
  periodo_consultado: string;
  fecha_inicio: string;
  fecha_fin: string;
  total_sesiones: number;
}

export interface CanalBursatilResponse {
  success: boolean;
  message?: string;
  metadata?: CanalMetadata;
  metricas?: CanalMetricas;
  series?: CanalPunto[];
  proyeccion_monte_carlo?: ProyeccionMonteCarlo;
}

@Injectable({
  providedIn: 'root'
})
export class MaximosMinimosService {
  private baseUrl = `${environment.apiUrl}/renta-variable/maximos-minimos`;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene todos los emisores disponibles clasificados con liquidez y últimas fechas
   */
  getEmisores(): Observable<EmisoresResponse> {
    return this.http.get<EmisoresResponse>(`${this.baseUrl}/emisores`);
  }

  /**
   * Obtiene la serie temporal de precios, bandas BVQ +-10%, VWAP y proyección Monte Carlo
   */
  getCanalHistorico(
    codigoSeb: string,
    periodo: string = '1y',
    incluirProyeccion: boolean = true,
    diasProyeccion: number = 90,
    fechaDesde?: string,
    fechaHasta?: string
  ): Observable<CanalBursatilResponse> {
    let params = new HttpParams()
      .set('periodo', periodo)
      .set('proyeccion', incluirProyeccion ? 'true' : 'false')
      .set('dias_proyeccion', diasProyeccion.toString());

    if (fechaDesde && fechaHasta) {
      params = params.set('fecha_desde', fechaDesde).set('fecha_hasta', fechaHasta);
    }

    return this.http.get<CanalBursatilResponse>(`${this.baseUrl}/canal/${codigoSeb}`, { params });
  }

  /**
   * Ejecuta una simulación Monte Carlo ad-hoc con parámetros personalizados
   */
  getProyeccion(
    codigoSeb: string,
    dias: number = 90,
    simulaciones: number = 500
  ): Observable<any> {
    const params = new HttpParams()
      .set('dias', dias.toString())
      .set('simulaciones', simulaciones.toString());

    return this.http.get<any>(`${this.baseUrl}/proyeccion/${codigoSeb}`, { params });
  }
}
