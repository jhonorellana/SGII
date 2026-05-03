import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GeneracionParams {
  id_inversion: number;
  frecuencia_pago: number;
  cuotas_diferir: number;
  tipo_amortizacion: 'A' | 'F';
}

export interface InversionParametros {
  id_inversion: number;
  valor_nominal: number;
  capital_invertido: number;
  tasa_interes: number;
  valor_interes: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  fechas_recuperacion: string;
  tipo_instrumento: string; // desde catalogo_valor.descripcion
  tipo_instrumento_codigo: string; // desde catalogo_valor.valor
  interes_primer_mes?: number;
  interes_acumulado_previo?: number;
  fechas_pagos_capital?: string;
}

export interface CuotaAmortizacion {
  numero_cuota: number;
  fecha_pago: string;
  capital_restante: number;
  capital_retorno: number;
  capital_devuelto: number;
  interes_parcial: number;
  premio: number;
  interes_total: number;
  flujo: number;
}

export interface TablaAmortizacion {
  cuotas: CuotaAmortizacion[];
  fecha_inicio: string;
  fecha_fin: string;
  total_intereses: number;
  total_capital: number;
  total_descuento: number;
}

export interface GeneracionResultado {
  cuotas_generadas: number;
  fecha_inicio: string;
  fecha_fin: string;
  total_intereses: number;
  total_capital: number;
  total_descuento: number;
}

export interface ApiResponse<T> {
  message: string;
  data?: T;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AmortizacionGeneracionService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  /**
   * Obtener parámetros de una inversión para generación
   */
  getParametros(idInversion: number): Observable<ApiResponse<InversionParametros>> {
    return this.http.get<ApiResponse<InversionParametros>>(
      `${this.apiUrl}/amortizaciones/parametros/${idInversion}`
    );
  }

  /**
   * Previsualizar tabla de amortización sin guardar
   */
  previsualizar(params: GeneracionParams): Observable<ApiResponse<TablaAmortizacion>> {
    return this.http.post<ApiResponse<TablaAmortizacion>>(
      `${this.apiUrl}/amortizaciones/previsualizar`,
      params
    );
  }

  /**
   * Generar y guardar tabla de amortización
   */
  generar(params: GeneracionParams): Observable<ApiResponse<GeneracionResultado>> {
    return this.http.post<ApiResponse<GeneracionResultado>>(
      `${this.apiUrl}/amortizaciones/generar`,
      params
    );
  }

  /**
   * Eliminar tabla existente
   */
  eliminar(idInversion: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.apiUrl}/amortizaciones/eliminar/${idInversion}`
    );
  }

  /**
   * Verificar si existe tabla para una inversión
   */
  existeTabla(idInversion: number): Observable<boolean> {
    return this.http.get<boolean>(
      `${this.apiUrl}/amortizaciones/existe/${idInversion}`
    );
  }

  /**
   * Calcular valores estimados (para validaciones)
   */
  calcularValoresEstimados(parametros: InversionParametros, params: GeneracionParams): {
    cuotasEstimadas: number;
    interesEstimado: number;
    capitalEstimado: number;
  } {
    const fechaInicio = new Date(parametros.fecha_emision);
    const fechaFin = new Date(parametros.fecha_vencimiento);
    const mesesTotales = this.calcularMesesEntreFechas(fechaInicio, fechaFin);
    const cuotasTotales = Math.floor(mesesTotales / params.frecuencia_pago);
    const cuotasConCapital = cuotasTotales - params.cuotas_diferir;

    const tasaMensual = parametros.tasa_interes / 100 / 12 * params.frecuencia_pago;
    const interesEstimado = parametros.valor_nominal * tasaMensual * cuotasTotales;
    const capitalEstimado = parametros.capital_invertido / cuotasConCapital;

    return {
      cuotasEstimadas: cuotasTotales,
      interesEstimado: Math.round(interesEstimado * 100) / 100,
      capitalEstimado: Math.round(capitalEstimado * 100) / 100
    };
  }

  /**
   * Validar parámetros de generación
   */
  validarParametros(parametros: InversionParametros, params: GeneracionParams): {
    valido: boolean;
    errores: string[];
  } {
    const errores: string[] = [];

    // Validar frecuencia de pago
    if (params.frecuencia_pago < 1 || params.frecuencia_pago > 12) {
      errores.push('La frecuencia de pago debe estar entre 1 y 12 meses');
    }

    // Validar cuotas a diferir
    if (params.cuotas_diferir < 0 || params.cuotas_diferir > 12) {
      errores.push('Las cuotas a diferir deben estar entre 0 y 12');
    }

    // Validar tipo de amortización
    if (!['A', 'F'].includes(params.tipo_amortizacion)) {
      errores.push('El tipo de amortización debe ser A (Alemana) o F (Francesa)');
    }

    // Validar fechas
    const fechaEmision = new Date(parametros.fecha_emision);
    const fechaVencimiento = new Date(parametros.fecha_vencimiento);

    if (fechaEmision >= fechaVencimiento) {
      errores.push('La fecha de emisión debe ser anterior a la fecha de vencimiento');
    }

    // Validar que las cuotas a diferir no excedan el total
    const mesesTotales = this.calcularMesesEntreFechas(fechaEmision, fechaVencimiento);
    const cuotasTotales = Math.floor(mesesTotales / params.frecuencia_pago);

    if (params.cuotas_diferir >= cuotasTotales) {
      errores.push('Las cuotas a diferir deben ser menores que el total de cuotas');
    }

    // Validar valores financieros
    if (parametros.valor_nominal <= 0) {
      errores.push('El valor nominal debe ser mayor a 0');
    }

    if (parametros.tasa_interes < 0) {
      errores.push('La tasa de interés no puede ser negativa');
    }

    if (parametros.capital_invertido <= 0) {
      errores.push('El capital invertido debe ser mayor a 0');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

  /**
   * Calcular meses entre dos fechas
   */
  private calcularMesesEntreFechas(fechaInicio: Date, fechaFin: Date): number {
    const años = fechaFin.getFullYear() - fechaInicio.getFullYear();
    const meses = fechaFin.getMonth() - fechaInicio.getMonth();
    return años * 12 + meses;
  }

  /**
   * Formatear moneda para display
   */
  formatCurrency(value: number): string {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }

  /**
   * Formatear fecha
   */
  formatDate(date: string): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}
