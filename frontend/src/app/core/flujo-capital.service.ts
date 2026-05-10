import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FlujoCapitalService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getFlujoCapital(params: {
    fecha_inicio: string;
    fecha_fin: string;
    id_grupo_familiar?: number | null;
    id_propietario?: number | null;
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

    return this.http.get(
      `${this.apiUrl}/reportes/flujo-capital?${queryParams.toString()}`
    );
  }

  exportarExcel(params: {
    fecha_inicio: string;
    fecha_fin: string;
    id_grupo_familiar?: number | null;
    id_propietario?: number | null;
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

    return this.http.get(
      `${this.apiUrl}/reportes/flujo-capital/exportar/excel?${queryParams.toString()}`
    );
  }

  exportarPDF(params: {
    fecha_inicio: string;
    fecha_fin: string;
    id_grupo_familiar?: number | null;
    id_propietario?: number | null;
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

    return this.http.get(
      `${this.apiUrl}/reportes/flujo-capital/exportar/pdf?${queryParams.toString()}`
    );
  }

  getDetalleFlujoCapital(params: {
    fecha: string;
    id_propietario?: number;
    id_emisor?: number;
  }): Observable<any> {
    const queryParams = new URLSearchParams();
    queryParams.append('fecha', params.fecha);

    if (params.id_propietario) {
      queryParams.append('id_propietario', params.id_propietario.toString());
    }

    if (params.id_emisor) {
      queryParams.append('id_emisor', params.id_emisor.toString());
    }

    return this.http.get(
      `${this.apiUrl}/reportes/flujo-capital/detalle?${queryParams.toString()}`
    );
  }
}
