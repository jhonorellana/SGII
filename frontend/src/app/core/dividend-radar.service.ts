import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DividendOpportunityItem {
  id_emisor: number;
  emisor: string;
  precio_mercado: number;
  ultimo_dividendo_acc: number;
  dividendo_proyectado_d1: number;
  yield_pct: number;
  estrellas_consistencia: number;
  mes_probable_pago: string;
  precio_teorico_gordon: number;
  margen_oportunidad_pct: number;
  total_dividendos_registrados: number;
  fecha_ultimo_precio?: string;
  precio_anterior?: number;
  variacion_porcentaje?: number;
  sma5?: number;
  sma20?: number;
  volumen_relativo?: number;
  dias_inactividad?: number;
  senales?: string[];
}

export interface RadarResponse {
  success: boolean;
  total_emisores_evaluados: number;
  yield_promedio_mercado: number;
  data: DividendOpportunityItem[];
}

export interface SimulationYearItem {
  ano: number;
  acciones_totales: number;
  dividendo_recibido_usd: number;
  acciones_reinvertidas: number;
  valor_estimado_portafolio_usd: number;
}

export interface SimulationResponse {
  success: boolean;
  message?: string;
  data: {
    emisor: string;
    precio_accion_usd: number;
    monto_ingresado_usd: number;
    inversion_efectiva_usd: number;
    saldo_remanente_usd: number;
    acciones_compradas: number;
    dividendo_por_accion_usd: number;
    dividendo_anual_estimado_usd: number;
    yield_estimado_pct: number;
    proyeccion_multianual: SimulationYearItem[];
  };
}

export interface PortfolioPositionItem {
  id_persona: number;
  persona: string;
  id_emisor: number;
  emisor: string;
  cantidad_actual: number;
  capital_invertido: number;
  costo_promedio: number;
  precio_ultimo: number;
  valor_mercado: number;
  ganancia_perdida: number;
  dividendo_acciones_cant: number;
  val_div_acciones: number;
  div_efectivo_recibido: number;
  ultimo_dividendo_acc?: number;
  dividendo_por_accion: number;
  dividendo_proyectado_d1?: number;
  precio_teorico_gordon?: number;
  margen_oportunidad_pct?: number;
  total_dividendos_registrados?: number;
  dividend_yield_pct: number;
  ingreso_anual_estimado_usd: number;
  estrellas_consistencia: number;
  mes_probable_pago: string;
  fecha_ultimo_precio?: string;
  precio_anterior?: number;
  variacion_porcentaje?: number;
  sma5?: number;
  sma20?: number;
  volumen_relativo?: number;
  dias_inactividad?: number;
  senales?: string[];
  fecha_ultima_operacion: string;
}

export interface PortfolioResponse {
  success: boolean;
  total_valor_portafolio_usd: number;
  total_dividendos_anuales_usd: number;
  yield_promedio_ponderado_pct: number;
  titulares: { id_persona: number; persona: string }[];
  data: PortfolioPositionItem[];
}

@Injectable({
  providedIn: 'root'
})
export class DividendRadarService {
  private apiUrl = `${environment.apiUrl}/dividendos`;

  constructor(private http: HttpClient) {}

  getRadar(): Observable<RadarResponse> {
    return this.http.get<RadarResponse>(`${this.apiUrl}/radar`);
  }

  simularInversion(montoUsd: number, idEmisor: number): Observable<SimulationResponse> {
    return this.http.post<SimulationResponse>(`${this.apiUrl}/simular`, {
      monto_usd: montoUsd,
      id_emisor: idEmisor
    });
  }

  getMiPortafolio(idPersona?: number): Observable<PortfolioResponse> {
    let url = `${this.apiUrl}/mi-portafolio`;
    if (idPersona && idPersona > 0) {
      url += `?id_persona=${idPersona}`;
    }
    return this.http.get<PortfolioResponse>(url);
  }

  analizarConIA(stockData: any, promptCustom?: string): Observable<{
    success: boolean;
    emisor: string;
    prompt: string;
    chatgpt_url: string;
    ai_response?: string;
  }> {
    return this.http.post<any>(`${this.apiUrl}/analizar-ia`, {
      ...stockData,
      prompt: promptCustom || ''
    });
  }
}
