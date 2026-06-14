import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface BonoRecord {
  id: number;
  fecha: string;
  decreto: string;
  precio_porc: number;
  rendimiento: number;
  dias_por_vencer: number;
  anios_por_vencer: number;
  tasa_interes: number;
  valor_nominal: number;
  valor_efectivo: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  procedencia: string;
  tipo: string;
  tipo_mercado: string;
}

export interface ObligacionRecord {
  id: number;
  fecha: string;
  emisor: string;
  precio_porc: number;
  rendimiento: number;
  plazo_dias: number;
  plazo_anios: number;
  interes: number;
  valor_nominal: number;
  valor_efectivo: number;
  emision: string;
  vencimiento: string;
  procedencia: string;
  mercado: string;
}

export interface PapelRecord {
  id: number;
  fecha: string;
  emisor: string;
  precio_porc: number;
  rendimiento: number;
  plazo_dias: number;
  plazo_anios: number;
  descuento_porc: number;
  interes: number;
  valor_nominal: number;
  valor_efectivo: number;
  emision: string;
  vencimiento: string;
  procedencia: string;
  mercado: string;
}

export interface FacturaRecord {
  id: number;
  fecha: string;
  emisor: string;
  precio_porc: number;
  valor_nominal: number;
  valor_efectivo: number;
  emision: string;
  vencimiento: string;
  rendimiento: number;
  procedencia: string;
  observaciones: string;
}

export interface TitularizacionRecord {
  id: number;
  fecha: string;
  emisor: string;
  precio_porc: number;
  rendimiento: number;
  plazo_dias: number;
  plazo_anios: number;
  interes: number;
  valor_nominal: number;
  valor_efectivo: number;
  emision: string;
  vencimiento: string;
  procedencia: string;
  mercado: string;
}

export interface AccionRecord {
  id: number;
  id_emisor: number;
  fecha: string;
  emisor: string;
  tipo: string;
  valor_nominal: number;
  precio: number;
  cantidad: number;
  efectivo: number;
  procedencia: string;
}

export interface CierreAccionRecord {
  id_emisor: number;
  emisor: string;
  fecha_maxima: string;
  precio_maximo: number;
  precio_minimo: number;
  precio_promedio: number;
}

export interface GenericoRecord {
  id: number;
  fecha: string;
  emisor: string;
  precio_porc: number;
  rendimiento: number;
  plazo_dias: number;
  plazo_anios: number;
  interes: number;
  valor_nominal: number;
  valor_efectivo: number;
  emision: string;
  vencimiento: string;
  procedencia: string;
  titulo: string;
  mercado: string;
}

export interface DatosResumenDiario {
  bonos: BonoRecord[];
  obligaciones: ObligacionRecord[];
  papeles: PapelRecord[];
  facturas: FacturaRecord[];
  titularizaciones: TitularizacionRecord[];
  acciones: AccionRecord[];
  genericos: GenericoRecord[];
}

export interface RespuestaResumenDiario {
  exito: boolean;
  datos: DatosResumenDiario;
  mensaje?: string;
}

export interface RespuestaCierreAcciones {
  exito: boolean;
  datos: CierreAccionRecord[];
  mensaje?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ResumenBolsaService {
  constructor(private apiService: ApiService) {}

  obtenerResumenDiario(fechaInicio: string, fechaFin?: string): Observable<RespuestaResumenDiario> {
    const rango = fechaFin ? `&fecha_fin=${fechaFin}` : '';
    return this.apiService.get<any>(`reportes/resumen-diario?fecha_inicio=${fechaInicio}${rango}`).pipe(
      map(res => res as unknown as RespuestaResumenDiario)
    );
  }

  obtenerUltimoCierreAcciones(): Observable<RespuestaCierreAcciones> {
    return this.apiService.get<any>('reportes/acciones-ultimo-cierre').pipe(
      map(res => res as unknown as RespuestaCierreAcciones)
    );
  }
}
