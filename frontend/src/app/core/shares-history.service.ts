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
}
