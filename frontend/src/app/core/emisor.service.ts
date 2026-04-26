import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EmisorService {
  private apiUrl = 'http://127.0.0.1:8000/api/emisores';

  constructor(private http: HttpClient) {}

  getEmisores(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  getEmisor(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  createEmisor(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  updateEmisor(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  deleteEmisor(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
