import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BvgFileResult {
  url: string;
  archivo: string;
  carpeta: string;
  path: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  size_bytes: number;
  error?: string | null;
}

export interface BvgDownloadResponse {
  success: boolean;
  message: string;
  data: {
    fecha: string;
    directorio_base: string;
    total_archivos: number;
    exitosos: number;
    fallidos: number;
    tiempo_ejecucion_segundos: number;
    archivos: BvgFileResult[];
  };
}

export interface BvgHistoryItem {
  fecha: string;
  carpeta: string;
  ruta_completa: string;
  total_archivos: number;
  tamano_total_mb: number;
}

export interface BvgHistoryResponse {
  success: boolean;
  data: BvgHistoryItem[];
}

export interface BvgSingleModuleResponse {
  success: boolean;
  message: string;
  data: {
    module: string;
    fecha: string;
    archivo: string;
    carpeta: string;
    path: string;
    size_bytes: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class BvgDownloaderService {
  private apiUrl = `${environment.apiUrl}/bvg`;

  constructor(private http: HttpClient) {}

  descargar(fecha?: string): Observable<BvgDownloadResponse> {
    return this.http.post<BvgDownloadResponse>(`${this.apiUrl}/descargar`, {
      fecha
    });
  }

  descargarModulo(modulo: string, fecha?: string): Observable<BvgSingleModuleResponse> {
    return this.http.post<BvgSingleModuleResponse>(`${this.apiUrl}/descargar-modulo`, {
      modulo,
      fecha
    });
  }

  getHistorial(): Observable<BvgHistoryResponse> {
    return this.http.get<BvgHistoryResponse>(`${this.apiUrl}/historial`);
  }
}
