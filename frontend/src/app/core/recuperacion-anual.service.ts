import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RecuperacionAnualItem {
  anio: string;
  capital: number;
  interes: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class RecuperacionAnualService {
  private apiUrl = 'http://localhost:8000/api/reportes/recuperacion-anual';

  constructor(private http: HttpClient) { }

  getRecuperacionAnual(historico: number): Observable<RecuperacionAnualItem[]> {
    return this.http.get<RecuperacionAnualItem[]>(`${this.apiUrl}?historico=${historico}`);
  }
}
