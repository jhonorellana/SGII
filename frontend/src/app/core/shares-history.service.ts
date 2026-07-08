import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface SharesHistoryRecord {
  fecha: string;
  emisor: string;
  cantidad: number | string;
  valor: number | string;
  precio: number | string;
  transacciones: number | string;
}

export interface ShareDetailRecord {
  id: number;
  cantidad: number;
  precio: number;
  valor_nominal: number;
  valor_efectivo: number;
  tipo: string;
}

@Injectable({
  providedIn: 'root'
})
export class SharesHistoryService {
  constructor(private apiService: ApiService) {}

  getHistorico(issuerId: number, year: number = 0): Observable<ApiResponse<SharesHistoryRecord[]>> {
    return this.apiService.get<SharesHistoryRecord[]>(
      `reportes/historico-acciones?issuer=${issuerId}&year=${year}`
    );
  }

  getDetallesDiarios(issuerId: number, date: string): Observable<ApiResponse<ShareDetailRecord[]>> {
    return this.apiService.get<ShareDetailRecord[]>(
      `reportes/historico-acciones/detalles?issuer=${issuerId}&date=${date}`
    );
  }
}
