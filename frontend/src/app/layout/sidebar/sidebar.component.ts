import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/auth.service';

export interface MenuItem {
  title: string;
  icon: string;
  path: string;
  children?: MenuItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit {
  isCollapsed = false;
  currentPath = '';
  currentUser: any = null;
  expandedMenuItems: Set<string> = new Set();

  menuItems: MenuItem[] = [
    {
      title: 'Dashboard',
      icon: 'bi-speedometer2',
      path: '/dashboard'
    },
    {
      title: 'Catálogos',
      icon: 'bi-tags',
      path: '/catalogos'
    },
    {
      title: 'Datos Maestros',
      icon: 'bi-database',
      path: '',
      children: [
        {
          title: 'Personas',
          icon: 'bi-people',
          path: '/personas'
        },
        {
          title: 'Grupos Familiares',
          icon: 'bi-house-heart',
          path: '/grupos-familiares'
        },
        {
          title: 'Emisores',
          icon: 'bi-building',
          path: '/emisores'
        },
        {
          title: 'Instrumentos',
          icon: 'bi-graph-up',
          path: '/instrumentos'
        }
      ]
    },
    {
      title: 'Inversiones',
      icon: 'bi-currency-dollar',
      path: '/inversiones',
      children: [
        {
          title: 'Gestión de Inversiones',
          icon: 'bi-list-check',
          path: '/inversiones'
        },
        {
          title: 'Amortizaciones',
          icon: 'bi-calculator',
          path: '/amortizaciones'
        }
      ]
    },
    {
      title: 'Reportes',
      icon: 'bi-file-earmark-bar-graph',
      path: '/reportes',
      children: [
        {
          title: 'Reporte de Inversiones',
          icon: 'bi-graph-up-arrow',
          path: '/reportes/inversiones'
        },
        {
          title: 'Reporte de Rendimientos',
          icon: 'bi-percent',
          path: '/reportes/rendimientos'
        }
      ]
    },
    {
      title: 'Administración',
      icon: 'bi-gear',
      path: '/administracion',
      children: [
        {
          title: 'Usuarios',
          icon: 'bi-person-badge',
          path: '/usuarios'
        },
        {
          title: 'Configuración',
          icon: 'bi-gear-fill',
          path: '/configuracion'
        }
      ]
    }
  ];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentPath = event.urlAfterRedirects;
    });
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  toggleMenuItem(item: MenuItem): void {
    const key = item.title;
    if (this.expandedMenuItems.has(key)) {
      this.expandedMenuItems.delete(key);
    } else {
      this.expandedMenuItems.add(key);
    }
  }

  isActive(path: string): boolean {
    return this.currentPath === path || this.currentPath.startsWith(path + '/');
  }

  isExpanded(item: MenuItem): boolean {
    if (!item.children) return false;
    return this.expandedMenuItems.has(item.title) || item.children.some(child => this.isActive(child.path));
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}
