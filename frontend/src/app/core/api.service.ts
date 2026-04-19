import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any;
}

export interface LoginRequest {
  nombre_usuario: string;
  clave: string;
}

export interface LoginResponse {
  usuario: {
    id: number;
    nombre_usuario: string;
    rol: string;
    persona: any;
  };
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;
  private token: string | null = null;

  constructor(private http: HttpClient) {
    this.token = this.isBrowser() ? localStorage.getItem('token') : null;
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders();
    if (this.token) {
      headers = headers.set('Authorization', `Bearer ${this.token}`);
    }
    headers = headers.set('Content-Type', 'application/json');
    return headers;
  }

  login(credentials: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.http.post<ApiResponse<LoginResponse>>(
      `${this.apiUrl}/login`,
      credentials,
      { headers: this.getHeaders() }
    );
  }

  logout(): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiUrl}/logout`,
      {},
      { headers: this.getHeaders() }
    );
  }

  me(): Observable<ApiResponse<LoginResponse>> {
    return this.http.get<ApiResponse<LoginResponse>>(
      `${this.apiUrl}/me`,
      { headers: this.getHeaders() }
    );
  }

  setToken(token: string): void {
    this.token = token;
    if (this.isBrowser()) {
      localStorage.setItem('token', token);
    }
  }

  getToken(): string | null {
    if (this.token) {
      return this.token;
    }
    return this.isBrowser() ? localStorage.getItem('token') : null;
  }

  clearToken(): void {
    this.token = null;
    if (this.isBrowser()) {
      localStorage.removeItem('token');
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  get<T>(endpoint: string): Observable<ApiResponse<T>> {
    const url = endpoint.startsWith('/') ? `${this.apiUrl}${endpoint}` : `${this.apiUrl}/${endpoint}`;
    return this.http.get<ApiResponse<T>>(
      url,
      { headers: this.getHeaders() }
    );
  }

  post<T>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    const url = endpoint.startsWith('/') ? `${this.apiUrl}${endpoint}` : `${this.apiUrl}/${endpoint}`;
    return this.http.post<ApiResponse<T>>(
      url,
      data,
      { headers: this.getHeaders() }
    );
  }

  put<T>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    const url = endpoint.startsWith('/') ? `${this.apiUrl}${endpoint}` : `${this.apiUrl}/${endpoint}`;
    return this.http.put<ApiResponse<T>>(
      url,
      data,
      { headers: this.getHeaders() }
    );
  }

  patch<T>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    const url = endpoint.startsWith('/') ? `${this.apiUrl}${endpoint}` : `${this.apiUrl}/${endpoint}`;
    return this.http.patch<ApiResponse<T>>(
      url,
      data,
      { headers: this.getHeaders() }
    );
  }

  delete<T>(endpoint: string): Observable<ApiResponse<T>> {
    const url = endpoint.startsWith('/') ? `${this.apiUrl}${endpoint}` : `${this.apiUrl}/${endpoint}`;
    return this.http.delete<ApiResponse<T>>(
      url,
      { headers: this.getHeaders() }
    );
  }
}
