import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CalendarModule } from 'primeng/calendar';
import { PatrimonioService, PatrimonioItem } from '../../../core/patrimonio.service';
import { GrupoFamiliarService } from '../../../core/grupo-familiar.service';
import { PersonaService } from '../../../core/persona.service';
import { AuthService } from '../../../core/auth.service';
import { ChartModule } from 'primeng/chart';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-patrimonio-consolidado',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    ButtonModule,
    DropdownModule,
    ProgressSpinnerModule,
    CalendarModule,
    ChartModule
  ],
  providers: [MessageService],
  templateUrl: './patrimonio-consolidado.component.html',
  styleUrls: ['./patrimonio-consolidado.component.css']
})
export class PatrimonioConsolidadoComponent implements OnInit {

  reporteForm!: FormGroup;
  patrimonio: PatrimonioItem[] = [];
  total: number = 0;
  loading = false;

  // Gráfico
  chartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: [],
    datasets: []
  };
  chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 15,
          font: {
            size: 11
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const formattedValue = this.formatCurrency(Number(value));
            const data = context.chart.data.datasets[0].data;
            const total = data.reduce((sum: number, val: number) => sum + Number(val), 0);
            const percentage = ((Number(value) / total) * 100).toFixed(2);
            return `${label}: ${formattedValue} (${percentage}%)`;
          }
        }
      }
    }
  };

  // Dropdowns
  gruposFamiliares: any[] = [];
  personas: any[] = [];

  // Usuario actual
  currentUser: any = null;

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private patrimonioService: PatrimonioService,
    private grupoFamiliarService: GrupoFamiliarService,
    private personaService: PersonaService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.inicializarFormulario();
    this.loadCurrentUser();
    this.loadInitialData();
  }

  loadCurrentUser(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  inicializarFormulario(): void {
    // Fecha inicio: hoy
    const fechaInicio = new Date();
    // Fecha fin: último día del mes 11 (noviembre) del año actual
    const fechaFin = new Date(fechaInicio.getFullYear(), 11, 31);

    this.reporteForm = this.fb.group({
      fecha_inicio: [fechaInicio, Validators.required],
      fecha_fin: [fechaFin, Validators.required],
      id_grupo_familiar: [null],
      id_propietario: [null]
    });

    // Establecer valores por defecto basados en el usuario actual
    setTimeout(() => {
      const defaultValues: any = {};

      if (this.currentUser?.persona) {
        defaultValues.id_propietario = this.currentUser.persona.id_persona;
      }

      if (this.currentUser?.persona) {
        const grupoFamiliarPatriarca = this.gruposFamiliares.find(
          gf => gf.id_patriarca === this.currentUser.persona.id_persona
        );
        if (grupoFamiliarPatriarca) {
          defaultValues.id_grupo_familiar = grupoFamiliarPatriarca.id_grupo_familiar;
        }
      }

      this.reporteForm.patchValue(defaultValues);
    }, 500);
  }

  loadInitialData(): void {
    // Cargar grupos familiares
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

    // Cargar personas
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

    this.patrimonioService.getPatrimonioConsolidado(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.patrimonio = response.data.patrimonio;
          this.total = response.data.total;
          this.loading = false;

          // Actualizar gráfico
          this.actualizarGrafico();

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
          detail: 'No se pudo generar el reporte. Por favor, verifique la conexión.'
        });
      }
    });
  }

  exportarExcel(): void {
    const params = {
      fecha_inicio: this.formatDate(this.reporteForm.get('fecha_inicio')?.value),
      fecha_fin: this.formatDate(this.reporteForm.get('fecha_fin')?.value),
      id_grupo_familiar: this.reporteForm.get('id_grupo_familiar')?.value,
      id_propietario: this.reporteForm.get('id_propietario')?.value
    };

    this.patrimonioService.exportarExcel(params).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fechaInicio = params.fecha_inicio;
        const fechaFin = params.fecha_fin;
        a.download = `patrimonio-consolidado-${fechaInicio}-${fechaFin}.xlsx`;
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

    this.patrimonioService.exportarPDF(params).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fechaInicio = params.fecha_inicio;
        const fechaFin = params.fecha_fin;
        a.download = `patrimonio-consolidado-${fechaInicio}-${fechaFin}.pdf`;
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

  isTotal(item: PatrimonioItem): boolean {
    return item.detalle === 'TOTAL';
  }

  actualizarGrafico(): void {
    // Filtrar el TOTAL para no incluirlo en el gráfico
    const datosSinTotal = this.patrimonio.filter(item => item.detalle !== 'TOTAL');

    // Ordenar de mayor a menor por valor
    const datosOrdenados = [...datosSinTotal].sort((a, b) => b.valor - a.valor);

    // Paleta de colores financieros consistente
    // Verdes para liquidez/corriente, Azules para capital/inversiones, Morados para papeles comerciales, Naranja para vencimientos
    const coloresFinancieros = [
      '#2E8B57', // Sea Green - Liquidez/Corriente
      '#3CB371', // Medium Sea Green
      '#90EE90', // Light Green
      '#1E90FF', // Dodger Blue - Capital/Inversiones estables
      '#4169E1', // Royal Blue
      '#6495ED', // Cornflower Blue
      '#8A2BE2', // Blue Violet - Papeles comerciales
      '#9370DB', // Medium Purple
      '#BA55D3', // Medium Orchid
      '#FF8C00', // Dark Orange - Vencimientos próximos
      '#FFA500', // Orange
      '#FFD700', // Gold
      '#DC143C', // Crimson - Valores negativos
      '#B22222', // Fire Brick
      '#808080'  // Gray - Otros
    ];

    this.chartData = {
      labels: datosOrdenados.map(item => item.detalle),
      datasets: [{
        data: datosOrdenados.map(item => item.valor),
        backgroundColor: coloresFinancieros.slice(0, datosOrdenados.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };
  }
}
