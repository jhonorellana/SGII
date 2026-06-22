import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SnapshotCarteraDiaria {
  id_snapshot: number;
  id_emisor: number;
  fecha: string;
  cantidad_posicion: string;
  costo_promedio: string;
  precio_mercado: string;
  valor_mercado: string;
  pl_no_realizado: string;
  porcentaje_no_realizado: string;
  sma_5: string;
  sma_20: string;
  vr: string | null;
  dias_sin_negociacion: number;
  alertas: string[];
  emisor?: any;
}

@Injectable({
  providedIn: 'root'
})
export class PortfolioIndicadoresService {
  private apiUrl = `${environment.apiUrl}/portfolio/indicadores`;

  constructor(private http: HttpClient) { }

  getIndicadores(): Observable<{ success: boolean, data: SnapshotCarteraDiaria[] }> {
    return this.http.get<{ success: boolean, data: SnapshotCarteraDiaria[] }>(this.apiUrl);
  }
}
