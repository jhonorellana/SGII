import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CalendarModule } from 'primeng/calendar';
import { FlujoCapitalService } from '../../../core/flujo-capital.service';
import { GrupoFamiliarService } from '../../../core/grupo-familiar.service';
import { PersonaService } from '../../../core/persona.service';
import { AuthService } from '../../../core/auth.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface FlujoCapitalItem {
  fecha: string;
  propietario: string;
  empresa: string;
  interes: number;
  capital: number;
  descuento: number;
  interes_moroso: number;
  capital_moroso: number;
  descuento_moroso: number;
  total: number;
}

@Component({
  selector: 'app-flujo-capital-consolidado',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    ButtonModule,
    DropdownModule,
    ProgressSpinnerModule,
    CalendarModule
  ],
  providers: [MessageService],
  templateUrl: './flujo-capital-consolidado.component.html',
  styleUrls: ['./flujo-capital-consolidado.component.css']
})
export class FlujoCapitalConsolidadoComponent implements OnInit {
  reporteForm!: FormGroup;
  flujoCapital: FlujoCapitalItem[] = [];
  totales: FlujoCapitalItem = {
    fecha: 'TOTAL',
    propietario: '',
    empresa: '',
    interes: 0,
    capital: 0,
    descuento: 0,
    interes_moroso: 0,
    capital_moroso: 0,
    descuento_moroso: 0,
    total: 0
  };
  loading = false;

  currentUser: any = null;
  gruposFamiliares: any[] = [];
  personas: any[] = [];

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private flujoCapitalService: FlujoCapitalService,
    private grupoFamiliarService: GrupoFamiliarService,
    private personaService: PersonaService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.inicializarFormulario();
    this.loadCurrentUser();
    this.loadInitialData();

    // Generar reporte automáticamente después de cargar los datos iniciales
    setTimeout(() => {
      this.generarReporte();
    }, 1000);
  }

  loadCurrentUser(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  inicializarFormulario(): void {
    const fechaInicio = new Date();
    const fechaFin = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth() + 1, 0);

    this.reporteForm = this.fb.group({
      fecha_inicio: [fechaInicio, Validators.required],
      fecha_fin: [fechaFin, Validators.required],
      id_grupo_familiar: [null],
      id_propietario: [null]
    });
  }

  loadInitialData(): void {
    this.grupoFamiliarService.getGruposFamiliares().subscribe({
      next: (response) => {
        if (response.success) {
          this.gruposFamiliares = response.data || [];
        }
      },
      error: (error) => {
        console.error('Error cargando grupos familiares:', error);
      }
    });

    this.personaService.getAll().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.personas = response.data.map((p: any) => ({
            id: p.id_persona,
            nombre_completo: `${p.nombres} ${p.apellidos}`
          })) || [];
        }
      },
      error: (error) => {
        console.error('Error cargando personas:', error);
      }
    });
  }

  generarReporte(): void {
    if (this.reporteForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Por favor complete los campos requeridos'
      });
      return;
    }

    this.loading = true;

    const params = {
      fecha_inicio: this.formatDate(this.reporteForm.get('fecha_inicio')?.value),
      fecha_fin: this.formatDate(this.reporteForm.get('fecha_fin')?.value),
      id_grupo_familiar: this.reporteForm.get('id_grupo_familiar')?.value,
      id_propietario: this.reporteForm.get('id_propietario')?.value
    };

    this.flujoCapitalService.getFlujoCapital(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.flujoCapital = response.data;
          this.calcularTotales();
          this.loading = false;

          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Reporte generado correctamente'
          });
        } else {
          throw new Error('Error en la respuesta del backend');
        }
      },
      error: (error) => {
        console.error('Error al generar reporte:', error);
        this.loading = false;

        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo conectar con el backend. Por favor, verifique la conexión.'
        });
      }
    });
  }

  calcularTotales(): void {
    this.totales = {
      fecha: 'TOTAL',
      propietario: '',
      empresa: '',
      interes: 0,
      capital: 0,
      descuento: 0,
      interes_moroso: 0,
      capital_moroso: 0,
      descuento_moroso: 0,
      total: 0
    };

    this.flujoCapital.forEach(item => {
      this.totales.interes += item.interes;
      this.totales.capital += item.capital;
      this.totales.descuento += item.descuento;
      this.totales.interes_moroso += item.interes_moroso;
      this.totales.capital_moroso += item.capital_moroso;
      this.totales.descuento_moroso += item.descuento_moroso;
      this.totales.total += item.total;
    });
  }

  exportarExcel(): void {
    const params = {
      fecha_inicio: this.formatDate(this.reporteForm.get('fecha_inicio')?.value),
      fecha_fin: this.formatDate(this.reporteForm.get('fecha_fin')?.value),
      id_grupo_familiar: this.reporteForm.get('id_grupo_familiar')?.value,
      id_propietario: this.reporteForm.get('id_propietario')?.value
    };

    this.flujoCapitalService.exportarExcel(params).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flujo-capital-consolidado-${params.fecha_inicio}-${params.fecha_fin}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.messageService.add({
          severity: 'success',
          summary: 'Exportación',
          detail: 'Archivo Excel descargado correctamente'
        });
      },
      error: (error) => {
        console.error('Error al exportar Excel:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo exportar el archivo Excel'
        });
      }
    });
  }

  exportarPDF(): void {
    const params = {
      fecha_inicio: this.formatDate(this.reporteForm.get('fecha_inicio')?.value),
      fecha_fin: this.formatDate(this.reporteForm.get('fecha_fin')?.value),
      id_grupo_familiar: this.reporteForm.get('id_grupo_familiar')?.value,
      id_propietario: this.reporteForm.get('id_propietario')?.value
    };

    this.flujoCapitalService.exportarPDF(params).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flujo-capital-consolidado-${params.fecha_inicio}-${params.fecha_fin}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.messageService.add({
          severity: 'success',
          summary: 'Exportación',
          detail: 'Archivo PDF descargado correctamente'
        });
      },
      error: (error) => {
        console.error('Error al exportar PDF:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo exportar el archivo PDF'
        });
      }
    });
  }

  formatDate(date: Date): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
}
