import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BvqFileResult {
  url: string;
  archivo: string;
  carpeta: string;
  path: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  size_bytes: number;
  error?: string | null;
}

export interface BvqDownloadResponse {
  success: boolean;
  message: string;
  data: {
    fecha: string;
    directorio_base: string;
    total_archivos: number;
    exitosos: number;
    fallidos: number;
    tiempo_ejecucion_segundos: number;
    archivos: BvqFileResult[];
    importacion_acciones?: {
      success: boolean;
      message: string;
      imported_count: number;
      last_date_in_db?: string;
    };
    importacion_bonos?: {
      success: boolean;
      message: string;
      imported_count: number;
      last_date_in_db?: string;
    };
    importacion_dividendos?: {
      success: boolean;
      message: string;
      imported_count: number;
      total_records_in_db?: number;
    };
    importacion_facturas?: {
      success: boolean;
      message: string;
      imported_count: number;
      last_date_in_db?: string;
    };
    importacion_genericos?: {
      success: boolean;
      message: string;
      imported_count: number;
      last_date_in_db?: string;
    };
    importacion_obligaciones?: {
      success: boolean;
      message: string;
      imported_count: number;
      last_date_in_db?: string;
    };
    importacion_papeles?: {
      success: boolean;
      message: string;
      imported_count: number;
      last_date_in_db?: string;
    };
    importacion_titularizaciones?: {
      success: boolean;
      message: string;
      imported_count: number;
      last_date_in_db?: string;
    };
  };
}

export interface BvqHistoryItem {
  fecha: string;
  carpeta: string;
  ruta_completa: string;
  total_archivos: number;
  tamano_total_mb: number;
}

@Injectable({
  providedIn: 'root'
})
export class BvqDownloaderService {
  private apiUrl = `${environment.apiUrl}/bvq`;

  constructor(private http: HttpClient) {}

  descargar(
    fecha?: string,
    importarAcciones: boolean = false,
    importarBonos: boolean = false,
    importarDividendos: boolean = false,
    importarFacturas: boolean = false,
    importarGenericos: boolean = false,
    importarObligaciones: boolean = false,
    importarPapeles: boolean = false,
    importarTitularizaciones: boolean = false
  ): Observable<BvqDownloadResponse> {
    return this.http.post<BvqDownloadResponse>(`${this.apiUrl}/descargar`, {
      fecha,
      importar_acciones: importarAcciones,
      importar_bonos: importarBonos,
      importar_dividendos: importarDividendos,
      importar_facturas: importarFacturas,
      importar_genericos: importarGenericos,
      importar_obligaciones: importarObligaciones,
      importar_papeles: importarPapeles,
      importar_titularizaciones: importarTitularizaciones
    });
  }

  importarAcciones(fecha?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/importar-acciones`, { fecha });
  }

  importarBonos(fecha?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/importar-bonos`, { fecha });
  }

  importarDividendos(fecha?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/importar-dividendos`, { fecha });
  }

  importarFacturas(fecha?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/importar-facturas`, { fecha });
  }

  importarGenericos(fecha?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/importar-genericos`, { fecha });
  }

  importarObligaciones(fecha?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/importar-obligaciones`, { fecha });
  }

  importarPapeles(fecha?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/importar-papeles`, { fecha });
  }

  importarTitularizaciones(fecha?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/importar-titularizaciones`, { fecha });
  }

  getHistorial(): Observable<{
    success: boolean;
    last_date_shares?: string;
    last_date_bonds?: string;
    total_dividends?: number;
    last_date_facturas?: string;
    last_date_genericos?: string;
    last_date_obligaciones?: string;
    last_date_papeles?: string;
    last_date_titularizaciones?: string;
    data: BvqHistoryItem[];
  }> {
    return this.http.get<{
      success: boolean;
      last_date_shares?: string;
      last_date_bonds?: string;
      total_dividends?: number;
      last_date_facturas?: string;
      last_date_genericos?: string;
      last_date_obligaciones?: string;
      last_date_papeles?: string;
      last_date_titularizaciones?: string;
      data: BvqHistoryItem[];
    }>(`${this.apiUrl}/historial`);
  }
}




