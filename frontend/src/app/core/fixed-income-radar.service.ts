import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FixedIncomeKPIs {
  total_titulos: number;
  tir_promedio: number;
  tasa_cupon_promedio: number;
  plazo_promedio_dias: number;
}

export interface FixedIncomeMarketInstrument {
  id: number;
  fecha_vector: string;
  codigo_titulo_vector: string;
  nemo_emisor: string;
  nombre_emisor: string;
  clase_titulo: string;
  calificacion_riesgo: string;
  precio_porcentaje: number;
  tasa_descuento_tir: number;
  tasa_cupon: number;
  plazo_dias_remanentes: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  forma_reajuste: string;
}

export interface FixedIncomeMarketResponse {
  status: string;
  data: {
    latest_date: string;
    kpis: FixedIncomeKPIs;
    instruments: FixedIncomeMarketInstrument[];
  };
}

export interface VectorSuggestion {
  codigo_titulo_vector: string;
  clase_titulo: string;
  precio_porcentaje: number;
  tasa_descuento_tir: number;
  calificacion_riesgo: string;
}

export interface FixedIncomePortfolioHolding {
  id_inversion: number;
  id_instrumento: number;
  nombre_emisor: string;
  nombre_instrumento: string;
  codigo_titulo_vector: string;
  sugerencia_vector?: VectorSuggestion | null;
  capital_original: number;
  capital_invertido: number;
  precio_compra_porcentaje: number;
  precio_vector_porcentaje: number;
  valor_mercado_actual: number;
  ganancia_no_realizada_usd: number;
  ganancia_no_realizada_pct: number;
  tasa_cupon_compra: number;
  rendimiento_compra?: number;
  tir_vector: number;
  calificacion_riesgo: string;
  plazo_dias_remanentes: number;
  fecha_compra: string;
  fecha_emision?: string;
  fecha_vencimiento: string;
}

export interface FixedIncomePortfolioResponse {
  status: string;
  data: {
    fecha_vector: string;
    summary: {
      total_valor_compra: number;
      total_valor_mercado: number;
      total_ganancia_usd: number;
      total_ganancia_pct: number;
      total_posiciones: number;
    };
    holdings: FixedIncomePortfolioHolding[];
  };
}

export interface InvestmentDetailResponse {
  status: string;
  data: {
    inversion: {
      id_inversion: number;
      id_instrumento: number;
      propietario_nombre?: string;
      nombre_emisor: string;
      nombre_instrumento: string;
      codigo_titulo_vector: string;
      sugerencia_vector?: VectorSuggestion | null;
      valor_nominal: number;
      capital_invertido_original: number;
      saldo_capital_actual: number;
      precio_compra_porcentaje: number;
      precio_vector_porcentaje?: number | null;
      tir_vector?: number | null;
      tasa_cupon_compra: number;
      rendimiento_compra?: number;
      rendimiento?: number;
      calificacion_riesgo: string;
      fecha_compra: string;
      fecha_emision: string;
      fecha_vencimiento: string;
    };
    amortizacion_summary: {
      total_cuotas: number;
      cuotas_pagadas?: number;
      capital_pagado: number;
      capital_pendiente: number;
      interes_pagado?: number;
      interes_pendiente?: number;
      pct_amortizado?: number;
    };
    cuotas: Array<{
      id_amortizacion: number;
      numero_cuota: number;
      fecha_pago: string;
      capital: number;
      interes: number;
      total: number;
      id_estado_amortizacion: number;
      estado_nombre: string;
    }>;
  };
}

@Injectable({
  providedIn: 'root'
})
export class FixedIncomeRadarService {
  private apiUrl = `${environment.apiUrl}/renta-fija`;

  constructor(private http: HttpClient) {}

  getMarketRadar(filters?: { fecha_vector?: string; clase_titulo?: string; calificacion_riesgo?: string; search?: string }): Observable<FixedIncomeMarketResponse> {
    let params = new HttpParams();
    if (filters) {
      if (filters.fecha_vector) params = params.set('fecha_vector', filters.fecha_vector);
      if (filters.clase_titulo) params = params.set('clase_titulo', filters.clase_titulo);
      if (filters.calificacion_riesgo) params = params.set('calificacion_riesgo', filters.calificacion_riesgo);
      if (filters.search) params = params.set('search', filters.search);
    }
    return this.http.get<FixedIncomeMarketResponse>(`${this.apiUrl}/radar`, { params });
  }

  getUserPortfolio(filters?: { propietario_id?: number; clase_titulo?: string; include_expired?: boolean }): Observable<FixedIncomePortfolioResponse> {
    let params = new HttpParams();
    if (filters) {
      if (filters.propietario_id) params = params.set('propietario_id', filters.propietario_id.toString());
      if (filters.clase_titulo) params = params.set('clase_titulo', filters.clase_titulo);
      if (filters.include_expired !== undefined) params = params.set('include_expired', filters.include_expired ? 'true' : 'false');
    }
    return this.http.get<FixedIncomePortfolioResponse>(`${this.apiUrl}/mi-portafolio`, { params });
  }

  getInvestmentDetail(idInversion: number): Observable<InvestmentDetailResponse> {
    return this.http.get<InvestmentDetailResponse>(`${this.apiUrl}/inversion/${idInversion}`);
  }

  updateVectorCode(idInstrumento: number, codigoVector: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/actualizar-codigo-vector`, {
      id_instrumento: idInstrumento,
      codigo_titulo_vector: codigoVector
    });
  }
}
