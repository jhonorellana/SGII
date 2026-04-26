import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GrupoFamiliarService {
  private apiUrl = 'http://127.0.0.1:8000/api/grupos-familiares';

  constructor(private http: HttpClient) {}

  getGruposFamiliares(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  getGrupoFamiliar(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  createGrupoFamiliar(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  updateGrupoFamiliar(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  deleteGrupoFamiliar(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
