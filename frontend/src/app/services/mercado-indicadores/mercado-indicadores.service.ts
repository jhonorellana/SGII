import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SnapshotCarteraDiaria } from '../portfolio-indicadores/portfolio-indicadores.service';

@Injectable({
  providedIn: 'root'
})
export class MercadoIndicadoresService {
  private apiUrl = `${environment.apiUrl}/mercado/indicadores`;

  constructor(private http: HttpClient) { }

  getIndicadores(): Observable<{ success: boolean, data: SnapshotCarteraDiaria[] }> {
    return this.http.get<{ success: boolean, data: SnapshotCarteraDiaria[] }>(this.apiUrl);
  }
}
