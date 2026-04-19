import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { CatalogoListComponent } from './modules/catalogos/catalogo-list/catalogo-list.component';
import { CatalogoFormComponent } from './modules/catalogos/catalogo-form/catalogo-form.component';
import { CatalogoValorListComponent } from './modules/catalogos/catalogo-valor-list/catalogo-valor-list.component';
import { CatalogoValorFormComponent } from './modules/catalogos/catalogo-valor-form/catalogo-valor-form.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'catalogos', component: CatalogoListComponent },
      { path: 'catalogos/new', component: CatalogoFormComponent },
      { path: 'catalogos/:id/edit', component: CatalogoFormComponent },
      { path: 'catalogos/:id/valores', component: CatalogoValorListComponent },
      { path: 'catalogos/:id/valores/new', component: CatalogoValorFormComponent },
      { path: 'catalogos/:id/valores/:valorId/edit', component: CatalogoValorFormComponent },
      { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];
