import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { CatalogoListComponent } from './modules/catalogos/catalogo-list/catalogo-list.component';
import { CatalogoFormComponent } from './modules/catalogos/catalogo-form/catalogo-form.component';
import { CatalogoValorListComponent } from './modules/catalogos/catalogo-valor-list/catalogo-valor-list.component';
import { CatalogoValorFormComponent } from './modules/catalogos/catalogo-valor-form/catalogo-valor-form.component';
import { PersonaListComponent } from './modules/personas/persona-list/persona-list.component';
import { GrupoFamiliarListComponent } from './modules/grupos-familiares/grupo-familiar-list/grupo-familiar-list.component';
import { EmisorListComponent } from './modules/emisores/emisor-list/emisor-list.component';
import { InstrumentoListComponent } from './modules/instrumentos/instrumento-list/instrumento-list.component';
import { InversionListComponent } from './modules/inversiones/inversion-list/inversion-list.component';
import { AmortizacionListComponent } from './modules/amortizaciones/amortizacion-list/amortizacion-list.component';
import { AuthGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'catalogos', component: CatalogoListComponent },
      { path: 'catalogos/new', component: CatalogoFormComponent },
      { path: 'catalogos/:id/edit', component: CatalogoFormComponent },
      { path: 'catalogos/:id/valores', component: CatalogoValorListComponent },
      { path: 'catalogos/:id/valores/new', component: CatalogoValorFormComponent },
      { path: 'catalogos/:id/valores/:valorId/edit', component: CatalogoValorFormComponent },
      { path: 'personas', component: PersonaListComponent },
      { path: 'grupos-familiares', component: GrupoFamiliarListComponent },
      { path: 'emisores', component: EmisorListComponent },
      { path: 'instrumentos', component: InstrumentoListComponent },
      { path: 'inversiones', component: InversionListComponent },
      { path: 'amortizaciones', component: AmortizacionListComponent },
      { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];
