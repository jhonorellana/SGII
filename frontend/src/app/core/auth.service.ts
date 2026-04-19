import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService, LoginRequest, LoginResponse } from './api.service';

export { LoginRequest, LoginResponse } from './api.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {
    // Verificar si hay token al iniciar (solo en browser)
    if (this.isBrowser()) {
      const token = this.apiService.getToken();
      if (token) {
        this.loadCurrentUser();
      }
    }
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  login(credentials: LoginRequest): Observable<any> {
    return this.apiService.login(credentials);
  }

  logout(): void {
    this.apiService.logout().subscribe({
      next: () => {
        this.clearSession();
      },
      error: () => {
        this.clearSession();
      }
    });
  }

  private clearSession(): void {
    this.apiService.clearToken();
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  private loadCurrentUser(): void {
    this.apiService.me().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentUserSubject.next(response.data.usuario);
        }
      },
      error: () => {
        this.clearSession();
      }
    });
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.apiService.isAuthenticated();
  }

  hasRole(role: string): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser && currentUser.rol === role;
  }

  isAdmin(): boolean {
    return this.hasRole('Administrador');
  }

  isPatriarca(): boolean {
    return this.hasRole('Patriarca');
  }

  isIntegrante(): boolean {
    return this.hasRole('Integrante familiar');
  }
}
