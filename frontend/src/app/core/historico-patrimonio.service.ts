import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HistoricoPatrimonioService {
  private apiUrl = 'http://127.0.0.1:8000/api/historico-patrimonio';

  constructor(private http: HttpClient) {}

  getHistoricoPatrimonio(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  getRecord(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  createRecord(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  updateRecord(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  deleteRecord(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
