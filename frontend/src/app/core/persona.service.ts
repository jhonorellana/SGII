import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';

export interface Persona {
  id_persona: number;
  nombres: string;
  apellidos: string;
  identificacion?: string;
  correo?: string;
  telefono?: string;
  activo: boolean | number;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface PersonaRequest {
  nombres: string;
  apellidos: string;
  identificacion?: string;
  correo?: string;
  telefono?: string;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PersonaService {
  private endpoint = 'personas';

  constructor(private apiService: ApiService) {}

  getAll(): Observable<ApiResponse<Persona[]>> {
    return this.apiService.get<Persona[]>(this.endpoint);
  }

  getById(id: number): Observable<ApiResponse<Persona>> {
    return this.apiService.get<Persona>(`${this.endpoint}/${id}`);
  }

  create(data: PersonaRequest): Observable<ApiResponse<Persona>> {
    return this.apiService.post<Persona>(this.endpoint, data);
  }

  update(id: number, data: PersonaRequest): Observable<ApiResponse<Persona>> {
    return this.apiService.put<Persona>(`${this.endpoint}/${id}`, data);
  }

  delete(id: number): Observable<ApiResponse<any>> {
    return this.apiService.delete<any>(`${this.endpoint}/${id}`);
  }
}
