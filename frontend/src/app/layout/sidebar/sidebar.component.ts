import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

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
  expandedMenuItems: Set<string> = new Set();

  @Output() sidebarToggle = new EventEmitter<boolean>();

  menuItems: MenuItem[] = [
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
          title: 'Instrumentos',
          icon: 'bi-graph-up',
          path: '/instrumentos'
        },
        {
          title: 'Otros Valores',
          icon: 'bi-wallet2',
          path: '/otros-valores'
        },
        {
          title: 'Amortizaciones',
          icon: 'bi-calculator',
          path: '/amortizaciones'
        },
        {
          title: 'Generación de Tablas',
          icon: 'bi-table',
          path: '/amortizaciones/generacion'
        }
      ]
    },
    {
      title: 'Contabilidad',
      icon: 'bi-calculator',
      path: '/contabilidad',
      children: [
        {
          title: 'Movimientos de Capital',
          icon: 'bi-cash-coin',
          path: '/movimientos-capital'
        },
        {
          title: 'Ventas de Inversiones',
          icon: 'bi-currency-exchange',
          path: '/ventas-inversion'
        },
        {
          title: 'Venta Agrupada',
          icon: 'bi-layers',
          path: '/venta-agrupada'
        }
      ]
    },
    {
      title: 'Reportes',
      icon: 'bi-file-earmark-bar-graph',
      path: '/reportes',
      children: [
        {
          title: 'Vencimientos Semanales',
          icon: 'bi-calendar-week',
          path: '/reportes/vencimientos-semanales'
        },
        {
          title: 'Vencimientos Mensuales',
          icon: 'bi-calendar-month',
          path: '/reportes/vencimientos-mensuales'
        },
        {
          title: 'Patrimonio Consolidado',
          icon: 'bi-wallet2',
          path: '/reportes/patrimonio-consolidado'
        },
        {
          title: 'Flujo Capital',
          icon: 'bi-cash-coin',
          path: '/reportes/flujo-capital-consolidado'
        },
        {
          title: 'Recuperación Anual',
          icon: 'bi-cash-stack',
          path: '/reportes/recuperacion-anual'
        },
        {
          title: 'Proyección Interés',
          icon: 'bi-bar-chart-line',
          path: '/reportes/proyeccion-interes-anual'
        },
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
      title: 'Datos Maestros',
      icon: 'bi-database',
      path: '',
      children: [
        {
          title: 'Catálogos',
          icon: 'bi-tags',
          path: '/catalogos'
        },
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
          title: 'Cuentas Bancarias',
          icon: 'bi-bank',
          path: '/cuentas-bancarias'
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
    private router: Router
  ) {}

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentPath = event.urlAfterRedirects;
    });
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    this.sidebarToggle.emit(this.isCollapsed);
  }

  handleMenuClick(item: MenuItem, event: Event): void {
    if (this.isCollapsed) {
      event.preventDefault();
      // Expand sidebar
      this.isCollapsed = false;
      this.sidebarToggle.emit(false);

      // Expand the corresponding submenu if it has children
      if (item.children) {
        setTimeout(() => {
          this.expandedMenuItems.add(item.title);
        }, 50); // Small delay to allow sidebar expansion to start
      }
    } else {
      // When sidebar is expanded, toggle submenu for items with children
      if (item.children) {
        event.preventDefault();
        this.toggleMenuItem(item);
      }
    }
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
}
