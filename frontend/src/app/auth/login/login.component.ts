import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, LoginRequest } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      nombre_usuario: ['', [Validators.required]],
      clave: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const loginData: LoginRequest = this.loginForm.value;

    this.authService.login(loginData).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Guardar token
          this.authService['apiService'].setToken(response.data.token);

          // Actualizar usuario actual
          this.authService['currentUserSubject'].next(response.data.usuario);

          // Redirigir a la URL original o al dashboard
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
          this.router.navigate([returnUrl]);
        } else {
          this.errorMessage = response.message || 'Error en el login';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Error de conexión al servidor';
        this.isLoading = false;
        console.error('Login error:', error);
      }
    });
  }

  get f() {
    return this.loginForm.controls;
  }
}
