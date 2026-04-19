import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  currentUser: any = null;
  loading = true;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loading = false;
  }

  logout(): void {
    this.authService.logout();
  }

  get userName(): string {
    return this.currentUser ?
      `${this.currentUser.persona.nombres} ${this.currentUser.persona.apellidos}` :
      'Usuario';
  }

  get userRole(): string {
    return this.currentUser ? this.currentUser.rol : 'Sin rol';
  }
}
