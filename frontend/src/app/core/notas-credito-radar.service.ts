import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RadarFiltrosResponse {
  success: boolean;
  fecha_minima: string;
  fecha_maxima: string;
  default_fecha_inicio: string;
  default_fecha_fin: string;
  total_registros_historicos: number;
  casas_vendedoras: string[];
  casas_compradoras: string[];
  bolsas: string[];
  titulos: string[];
}

export interface NotaCreditoRadarItem {
  id: number;
  fecha: string;
  titulo: string;
  emisor: string;
  precio_porc: number;
  mercado: string;
  valor_nominal: number;
  valor_efectivo: number;
  descuento_usd: number;
  descuento_pct: number;
  casa_vendedora: string;
  casa_compradora: string;
  bolsa: string;
  es_oportunidad: boolean;
  categoria: 'ORO' | 'PLATA' | 'BRONCE' | 'REGULAR';
  categoria_badge: string;
  categoria_texto: string;
  spread_vs_mayorista: number;
  ganancia_potencial_usd: number;
}

export interface RadarKpis {
  total_operaciones: number;
  volumen_nominal: number;
  volumen_efectivo: number;
  ahorro_descuento_total: number;
  precio_minimo: number;
  precio_maximo: number;
  precio_promedio_simple: number;
  precio_promedio_ponderado: number;
  spread_periodo: number;
  total_oportunidades: number;
  volumen_oportunidades_nominal: number;
  precio_referencia_mayorista: number;
  mejor_oportunidad?: {
    fecha: string;
    precio_porc: number;
    valor_nominal: number;
    casa_vendedora: string;
    bolsa: string;
    descuento_pct: number;
  } | null;
}

export interface DistribucionTramo {
  tramo: string;
  total_ops: number;
  nominal: number;
  precio_promedio: number;
  precio_minimo: number;
  precio_maximo: number;
}

export interface TopVendedoraOportunidad {
  CASA_VENDEDORA: string;
  ops: number;
  nominal_total: number;
  precio_promedio: number;
  precio_minimo: number;
  ops_oportunidad: number;
}

export interface RadarOportunidadesResponse {
  success: boolean;
  filtros_aplicados: any;
  kpis: RadarKpis;
  items: NotaCreditoRadarItem[];
  distribucion_tramos: DistribucionTramo[];
  top_vendedoras_oportunidad: TopVendedoraOportunidad[];
}

export interface SimulacionArbitrajeResponse {
  success: boolean;
  data: {
    valor_nominal: number;
    precio_compra_porc: number;
    precio_venta_porc: number;
    dias_rotacion: number;
    inversion_total: number;
    ingreso_neto_venta: number;
    utilidad_neta_usd: number;
    roi_directo_pct: number;
    tir_anualizada_pct: number;
    desglose: {
      inversion_bruta: number;
      comision_compra_usd: number;
      ingreso_bruto_venta: number;
      comision_venta_usd: number;
      spread_puntos_porc: number;
    };
  };
}

export interface TramoCurvaItem {
  id: number;
  key: string;
  tramo: string;
  nombre: string;
  descripcion: string;
  ops: number;
  pct_ops: number;
  nominal: number;
  pct_nominal: number;
  efectivo: number;
  descuento_total: number;
  precio_min: number;
  p10: number;
  p25: number;
  mediana_p50: number;
  precio_promedio: number;
  precio_ponderado: number;
  p75: number;
  p90: number;
  precio_max: number;
  spread_interno: number;
  descuento_promedio_pct: number;
  spread_vs_mayorista: number;
  ganancia_por_10k: number;
}

export interface CurvaDescuentoKpis {
  total_operaciones: number;
  total_volumen_nominal: number;
  total_volumen_efectivo: number;
  total_ahorro_mercado: number;
  precio_promedio_ponderado: number;
  spread_max_arbitraje: number;
  ganancia_max_por_10k: number;
  precio_ref_compra_micro: number;
  precio_ref_venta_grande: number;
}

export interface CurvaDescuentoResponse {
  success: boolean;
  filtros_aplicados: any;
  kpis: CurvaDescuentoKpis;
  tramos: TramoCurvaItem[];
  chart_curva: any;
  scatter_sample: Array<{
    x: number;
    y: number;
    fecha: string;
    vendedora: string;
    bolsa: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class NotasCreditoRadarService {
  private apiUrl = `${environment.apiUrl}/notas-credito`;

  constructor(private http: HttpClient) {}

  getFiltros(): Observable<RadarFiltrosResponse> {
    return this.http.get<RadarFiltrosResponse>(`${this.apiUrl}/radar-filtros`);
  }

  getRadarOportunidades(filters: any): Observable<RadarOportunidadesResponse> {
    return this.http.post<RadarOportunidadesResponse>(`${this.apiUrl}/radar-oportunidades`, filters);
  }

  getCurvaDescuento(filters: any): Observable<CurvaDescuentoResponse> {
    return this.http.post<CurvaDescuentoResponse>(`${this.apiUrl}/curva-descuento`, filters);
  }

  simularArbitraje(params: {
    valor_nominal: number;
    precio_compra: number;
    precio_venta?: number;
    comision_compra_pct?: number;
    comision_venta_pct?: number;
    dias_rotacion?: number;
  }): Observable<SimulacionArbitrajeResponse> {
    return this.http.post<SimulacionArbitrajeResponse>(`${this.apiUrl}/simular-arbitraje`, params);
  }
}

