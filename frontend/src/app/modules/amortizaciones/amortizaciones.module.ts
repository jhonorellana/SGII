import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AmortizacionesRoutingModule } from './amortizaciones-routing.module';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ConfirmationService } from 'primeng/api';
import { AmortizacionGeneracionService } from '../../core/amortizacion-generacion.service';
import { InversionService } from '../../core/inversion.service';

@NgModule({
  imports: [
    CommonModule,
    AmortizacionesRoutingModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    TagModule,
    DialogModule,
    CalendarModule,
    InputNumberModule,
    ToastModule,
    ConfirmDialogModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [
    MessageService,
    ConfirmationService,
    AmortizacionGeneracionService,
    InversionService
  ]
})
export class AmortizacionesModule { }
