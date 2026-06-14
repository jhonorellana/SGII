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
import { AmortizacionGeneracionComponent } from './modules/amortizaciones/amortizacion-generacion/amortizacion-generacion.component';
import { VencimientosMensualesComponent } from './modules/reportes/vencimientos-mensuales/vencimientos-mensuales.component';
import { VencimientosSemanalesComponent } from './modules/reportes/vencimientos-semanales/vencimientos-semanales.component';
import { PatrimonioConsolidadoComponent } from './modules/reportes/patrimonio-consolidado/patrimonio-consolidado.component';
import { FlujoCapitalConsolidadoComponent } from './modules/reportes/flujo-capital-consolidado/flujo-capital-consolidado.component';
import { RecuperacionAnualComponent } from './modules/reportes/recuperacion-anual/recuperacion-anual.component';
import { ProyeccionInteresAnualComponent } from './modules/reportes/proyeccion-interes-anual/proyeccion-interes-anual.component';
import { OtrosValoresListComponent } from './modules/otros-valores/otros-valores-list/otros-valores-list.component';
import { CuentaBancariaListComponent } from './modules/cuentas-bancarias/cuenta-bancaria-list/cuenta-bancaria-list.component';
import { MovimientoCapitalListComponent } from './modules/movimientos-capital/movimiento-capital-list/movimiento-capital-list.component';
import { VentaInversionListComponent } from './modules/ventas-inversion/venta-inversion-list/venta-inversion-list.component';
import { VentaAgrupadaComponent } from './modules/venta-agrupada/venta-agrupada.component';
import { DashboardInversionesComponent } from './modules/reportes/dashboard-inversiones/dashboard-inversiones.component';
import { HistoricoAccionesComponent } from './modules/reportes/historico-acciones/historico-acciones.component';
import { ResumenDiarioBolsaComponent } from './modules/reportes/resumen-diario-bolsa/resumen-diario-bolsa.component';
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
      { path: 'amortizaciones/generacion', component: AmortizacionGeneracionComponent },
      { path: 'reportes/vencimientos-mensuales', component: VencimientosMensualesComponent },
      { path: 'reportes/vencimientos-semanales', component: VencimientosSemanalesComponent },
      { path: 'reportes/patrimonio-consolidado', component: PatrimonioConsolidadoComponent },
      { path: 'reportes/flujo-capital-consolidado', component: FlujoCapitalConsolidadoComponent },
      { path: 'reportes/recuperacion-anual', component: RecuperacionAnualComponent },
      { path: 'reportes/proyeccion-interes-anual', component: ProyeccionInteresAnualComponent },
      { path: 'reportes/dashboard-inversiones', component: DashboardInversionesComponent },
      { path: 'reportes/historico-acciones', component: HistoricoAccionesComponent },
      { path: 'reportes/resumen-diario-bolsa', component: ResumenDiarioBolsaComponent },
      { path: 'otros-valores', component: OtrosValoresListComponent },
      { path: 'cuentas-bancarias', component: CuentaBancariaListComponent },
      { path: 'movimientos-capital', component: MovimientoCapitalListComponent },
      { path: 'ventas-inversion', component: VentaInversionListComponent },
      // { path: 'ventas-inversion/nueva', component: VentaInversionNewComponent },
      { path: 'venta-agrupada', component: VentaAgrupadaComponent },
      { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];
