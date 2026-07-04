import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GananciaAnualItem {
  anio: number;
  ganancia: number;
}

@Injectable({
  providedIn: 'root'
})
export class GananciaAnualService {
  private apiUrl = `${environment.apiUrl}/reportes/ganancia-anual`;

  constructor(private http: HttpClient) {}

  getGananciaAnual(): Observable<GananciaAnualItem[]> {
    return this.http.get<GananciaAnualItem[]>(this.apiUrl);
  }
}
