import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AmortizacionListComponent } from './amortizacion-list/amortizacion-list.component';
import { AmortizacionGeneracionComponent } from './amortizacion-generacion/amortizacion-generacion.component';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        component: AmortizacionListComponent,
        data: { title: 'Amortizaciones' }
      },
      {
        path: 'generacion',
        component: AmortizacionGeneracionComponent,
        data: { title: 'Generación de Tabla de Amortización' }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AmortizacionesRoutingModule { }
