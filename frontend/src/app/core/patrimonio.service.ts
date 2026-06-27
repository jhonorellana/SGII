import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PatrimonioItem {
  detalle: string;
  valor: number;
}

export interface PatrimonioResponse {
  success: boolean;
  data: {
    patrimonio: PatrimonioItem[];
    total: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PatrimonioService {
  private apiUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  getPatrimonioConsolidado(params: {
    fecha_inicio: string;
    fecha_fin: string;
    id_grupo_familiar?: number;
    id_propietario?: number;
    incluir_dividendos?: boolean;
  }): Observable<PatrimonioResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('fecha_inicio', params.fecha_inicio);
    queryParams.append('fecha_fin', params.fecha_fin);

    if (params.id_grupo_familiar) {
      queryParams.append('id_grupo_familiar', params.id_grupo_familiar.toString());
    }

    if (params.id_propietario) {
      queryParams.append('id_propietario', params.id_propietario.toString());
    }

    if (params.incluir_dividendos !== undefined) {
      queryParams.append('incluir_dividendos', params.incluir_dividendos ? '1' : '0');
    }

    return this.http.get<PatrimonioResponse>(
      `${this.apiUrl}/reportes/patrimonio/consolidado?${queryParams.toString()}`
    );
  }

  exportarExcel(params: {
    fecha_inicio: string;
    fecha_fin: string;
    id_grupo_familiar?: number;
    id_propietario?: number;
    incluir_dividendos?: boolean;
  }): Observable<any> {
    const queryParams = new URLSearchParams();
    queryParams.append('fecha_inicio', params.fecha_inicio);
    queryParams.append('fecha_fin', params.fecha_fin);

    if (params.id_grupo_familiar) {
      queryParams.append('id_grupo_familiar', params.id_grupo_familiar.toString());
    }

    if (params.id_propietario) {
      queryParams.append('id_propietario', params.id_propietario.toString());
    }

    if (params.incluir_dividendos !== undefined) {
      queryParams.append('incluir_dividendos', params.incluir_dividendos ? '1' : '0');
    }

    return this.http.get(
      `${this.apiUrl}/reportes/patrimonio/consolidado/exportar/excel?${queryParams.toString()}`
    );
  }

  exportarPDF(params: {
    fecha_inicio: string;
    fecha_fin: string;
    id_grupo_familiar?: number;
    id_propietario?: number;
    incluir_dividendos?: boolean;
  }): Observable<any> {
    const queryParams = new URLSearchParams();
    queryParams.append('fecha_inicio', params.fecha_inicio);
    queryParams.append('fecha_fin', params.fecha_fin);

    if (params.id_grupo_familiar) {
      queryParams.append('id_grupo_familiar', params.id_grupo_familiar.toString());
    }

    if (params.id_propietario) {
      queryParams.append('id_propietario', params.id_propietario.toString());
    }

    if (params.incluir_dividendos !== undefined) {
      queryParams.append('incluir_dividendos', params.incluir_dividendos ? '1' : '0');
    }

    return this.http.get(
      `${this.apiUrl}/reportes/patrimonio/consolidado/exportar/pdf?${queryParams.toString()}`
    );
  }
}
