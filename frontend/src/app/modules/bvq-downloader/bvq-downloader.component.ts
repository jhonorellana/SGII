import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { BvqDownloaderService, BvqDownloadResponse, BvqHistoryItem } from '../../core/bvq-downloader.service';

@Component({
  selector: 'app-bvq-downloader',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    ProgressBarModule,
    TooltipModule,
    DialogModule
  ],
  templateUrl: './bvq-downloader.component.html',
  styleUrl: './bvq-downloader.component.css'
})
export class BvqDownloaderComponent implements OnInit {
  loading: boolean = false;
  loadingImport: boolean = false;
  loadingImportBonds: boolean = false;
  loadingImportDividends: boolean = false;
  loadingImportFacturas: boolean = false;
  loadingImportGenericos: boolean = false;
  loadingImportObligaciones: boolean = false;
  loadingImportPapeles: boolean = false;
  loadingImportTitularizaciones: boolean = false;
  fechaSeleccionada: string = new Date().toISOString().split('T')[0];
  autoImportAcciones: boolean = true;
  autoImportBonos: boolean = true;
  autoImportDividendos: boolean = true;
  autoImportFacturas: boolean = true;
  autoImportGenericos: boolean = true;
  autoImportObligaciones: boolean = true;
  autoImportPapeles: boolean = true;
  autoImportTitularizaciones: boolean = true;
  masterAutoImport: boolean = true;

  // Estado del Modal de Log
  displayLogModal: boolean = false;
  selectedLogFilter: 'ALL' | 'SUCCESS' | 'FAILED' = 'ALL';
  copiadoExitoso: boolean = false;

  toggleAllSwitches(value: boolean): void {
    this.masterAutoImport = value;
    this.autoImportAcciones = value;
    this.autoImportBonos = value;
    this.autoImportDividendos = value;
    this.autoImportFacturas = value;
    this.autoImportGenericos = value;
    this.autoImportObligaciones = value;
    this.autoImportPapeles = value;
    this.autoImportTitularizaciones = value;
  }

  lastDownloadResult: BvqDownloadResponse['data'] | null = null;
  lastImportResult: any = null;
  lastImportBondsResult: any = null;
  lastImportDividendsResult: any = null;
  lastImportFacturasResult: any = null;
  lastImportGenericosResult: any = null;
  lastImportObligacionesResult: any = null;
  lastImportPapelesResult: any = null;
  lastImportTitularizacionesResult: any = null;
  lastDateSharesInDb: string | null = null;
  lastDateBondsInDb: string | null = null;
  totalDividendsInDb: number = 0;
  lastDateFacturasInDb: string | null = null;
  lastDateGenericosInDb: string | null = null;
  lastDateObligacionesInDb: string | null = null;
  lastDatePapelesInDb: string | null = null;
  lastDateTitularizacionesInDb: string | null = null;
  historial: BvqHistoryItem[] = [];
  error: string = '';

  activeTab: 'descarga' | 'historial' = 'descarga';

  constructor(private bvqService: BvqDownloaderService) {}

  ngOnInit(): void {
    this.cargarHistorial();
  }

  abrirLogModal(): void {
    this.displayLogModal = true;
  }

  getSemanticStatus(result: any): { type: 'success' | 'warning' | 'danger'; text: string; cssClass: string; icon: string } | null {
    if (!result) return null;

    if (result.success === false || result.error) {
      return {
        type: 'danger',
        text: 'Error en proceso',
        cssClass: 'bg-danger-soft text-danger border border-danger-subtle',
        icon: 'bi-x-circle-fill text-danger'
      };
    }

    const count = result.imported_count ?? 0;
    if (count === 0) {
      return {
        type: 'warning',
        text: 'Sin registros nuevos (0 reg.)',
        cssClass: 'bg-warning-soft text-dark border border-warning-subtle',
        icon: 'bi-exclamation-triangle-fill text-warning'
      };
    }

    return {
      type: 'success',
      text: `+${count} reg.`,
      cssClass: 'bg-success-soft text-success border border-success-subtle',
      icon: 'bi-check-circle-fill text-success'
    };
  }

  getLogArchivosFiltrados(): any[] {
    if (!this.lastDownloadResult || !this.lastDownloadResult.archivos) return [];
    if (this.selectedLogFilter === 'SUCCESS') {
      return this.lastDownloadResult.archivos.filter(a => a.status === 'SUCCESS');
    }
    if (this.selectedLogFilter === 'FAILED') {
      return this.lastDownloadResult.archivos.filter(a => a.status === 'FAILED');
    }
    return this.lastDownloadResult.archivos;
  }

  copiarLogAlPortapapeles(): void {
    if (!this.lastDownloadResult) return;
    const lines: string[] = [];
    lines.push(`LOG DE DESCARGA BVQ - FECHA: ${this.lastDownloadResult.fecha}`);
    lines.push(`Directorio: ${this.lastDownloadResult.directorio_base}`);
    lines.push(`Totales: ${this.lastDownloadResult.total_archivos} | Exitosos: ${this.lastDownloadResult.exitosos} | Fallidos: ${this.lastDownloadResult.fallidos}`);
    lines.push(`--------------------------------------------------------------------------------`);

    this.lastDownloadResult.archivos.forEach(a => {
      lines.push(`[${a.status}] ${a.carpeta}/${a.archivo} - ${a.status === 'SUCCESS' ? this.formatBytes(a.size_bytes) : 'Error: ' + a.error}`);
    });

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      this.copiadoExitoso = true;
      setTimeout(() => this.copiadoExitoso = false, 2500);
    });
  }

  loadingOnlyDownload: boolean = false;

  resetImportResults(): void {
    this.lastImportResult = null;
    this.lastImportBondsResult = null;
    this.lastImportDividendsResult = null;
    this.lastImportFacturasResult = null;
    this.lastImportGenericosResult = null;
    this.lastImportObligacionesResult = null;
    this.lastImportPapelesResult = null;
    this.lastImportTitularizacionesResult = null;
  }

  ejecutarSoloDescarga(): void {
    this.loadingOnlyDownload = true;
    this.error = '';
    this.lastDownloadResult = null;
    this.resetImportResults();

    this.bvqService.descargar(
      this.fechaSeleccionada,
      false, false, false, false, false, false, false, false
    ).subscribe({
      next: (res) => {
        this.loadingOnlyDownload = false;
        if (res.data) {
          this.lastDownloadResult = res.data;
          if (res.data.fallidos > 0) {
            this.error = `Se completó la descarga: ${res.data.exitosos} exitosos y ${res.data.fallidos} fallidos. Revise el detalle abajo.`;
          }
        }
        this.cargarHistorial();
      },
      error: (err) => {
        this.loadingOnlyDownload = false;
        console.error('Error al ejecutar descarga BVQ:', err);
        if (err?.error?.data) {
          this.lastDownloadResult = err.error.data;
        }
        this.error = err?.error?.message || 'Ocurrió un error al descargar los archivos de la BVQ.';
      }
    });
  }

  ejecutarImportarTodo(): void {
    this.error = '';
    if (this.autoImportAcciones) this.ejecutarSoloImportacionAcciones();
    if (this.autoImportBonos) this.ejecutarSoloImportacionBonos();
    if (this.autoImportDividendos) this.ejecutarSoloImportacionDividendos();
    if (this.autoImportFacturas) this.ejecutarSoloImportacionFacturas();
    if (this.autoImportGenericos) this.ejecutarSoloImportacionGenericos();
    if (this.autoImportObligaciones) this.ejecutarSoloImportacionObligaciones();
    if (this.autoImportPapeles) this.ejecutarSoloImportacionPapeles();
    if (this.autoImportTitularizaciones) this.ejecutarSoloImportacionTitularizaciones();
  }

  ejecutarDescarga(): void {
    this.loading = true;
    this.error = '';
    this.lastDownloadResult = null;
    this.resetImportResults();

    this.bvqService.descargar(
      this.fechaSeleccionada,
      this.autoImportAcciones,
      this.autoImportBonos,
      this.autoImportDividendos,
      this.autoImportFacturas,
      this.autoImportGenericos,
      this.autoImportObligaciones,
      this.autoImportPapeles,
      this.autoImportTitularizaciones
    ).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.data) {
          this.lastDownloadResult = res.data;
          if (res.data.fallidos > 0) {
            this.error = `Descarga completada con ${res.data.fallidos} errores. Vea el detalle de archivos a continuación.`;
          }
          if (res.data.importacion_acciones) {
            this.lastImportResult = res.data.importacion_acciones;
            this.lastDateSharesInDb = res.data.importacion_acciones.last_date_in_db || this.lastDateSharesInDb;
          }
          if (res.data.importacion_bonos) {
            this.lastImportBondsResult = res.data.importacion_bonos;
            this.lastDateBondsInDb = res.data.importacion_bonos.last_date_in_db || this.lastDateBondsInDb;
          }
          if (res.data.importacion_dividendos) {
            this.lastImportDividendsResult = res.data.importacion_dividendos;
            this.totalDividendsInDb = res.data.importacion_dividendos.total_records_in_db || this.totalDividendsInDb;
          }
          if (res.data.importacion_facturas) {
            this.lastImportFacturasResult = res.data.importacion_facturas;
            this.lastDateFacturasInDb = res.data.importacion_facturas.last_date_in_db || this.lastDateFacturasInDb;
          }
          if (res.data.importacion_genericos) {
            this.lastImportGenericosResult = res.data.importacion_genericos;
            this.lastDateGenericosInDb = res.data.importacion_genericos.last_date_in_db || this.lastDateGenericosInDb;
          }
          if (res.data.importacion_obligaciones) {
            this.lastImportObligacionesResult = res.data.importacion_obligaciones;
            this.lastDateObligacionesInDb = res.data.importacion_obligaciones.last_date_in_db || this.lastDateObligacionesInDb;
          }
          if (res.data.importacion_papeles) {
            this.lastImportPapelesResult = res.data.importacion_papeles;
            this.lastDatePapelesInDb = res.data.importacion_papeles.last_date_in_db || this.lastDatePapelesInDb;
          }
          if (res.data.importacion_titularizaciones) {
            this.lastImportTitularizacionesResult = res.data.importacion_titularizaciones;
            this.lastDateTitularizacionesInDb = res.data.importacion_titularizaciones.last_date_in_db || this.lastDateTitularizacionesInDb;
          }
        }
        this.cargarHistorial();
      },
      error: (err) => {
        this.loading = false;
        console.error('Error al ejecutar descarga BVQ:', err);
        if (err?.error?.data) {
          this.lastDownloadResult = err.error.data;
        }
        this.error = err?.error?.message || 'Ocurrió un error al descargar los archivos de la BVQ.';
      }
    });
  }

  ejecutarSoloImportacionAcciones(): void {
    this.loadingImport = true;
    this.error = '';

    this.bvqService.importarAcciones(this.fechaSeleccionada).subscribe({
      next: (res) => {
        this.loadingImport = false;
        if (res.data) {
          this.lastImportResult = res.data;
          this.lastDateSharesInDb = res.data.last_date_in_db || this.lastDateSharesInDb;
        }
      },
      error: (err) => {
        this.loadingImport = false;
        console.error('Error al importar acciones:', err);
        this.error = 'Ocurrió un error al procesar e importar las acciones a la base de datos.';
      }
    });
  }

  ejecutarSoloImportacionBonos(): void {
    this.loadingImportBonds = true;
    this.error = '';

    this.bvqService.importarBonos(this.fechaSeleccionada).subscribe({
      next: (res) => {
        this.loadingImportBonds = false;
        if (res.data) {
          this.lastImportBondsResult = res.data;
          this.lastDateBondsInDb = res.data.last_date_in_db || this.lastDateBondsInDb;
        }
      },
      error: (err) => {
        this.loadingImportBonds = false;
        console.error('Error al importar bonos:', err);
        this.error = 'Ocurrió un error al procesar e importar los bonos a la base de datos.';
      }
    });
  }

  ejecutarSoloImportacionDividendos(): void {
    this.loadingImportDividends = true;
    this.error = '';

    this.bvqService.importarDividendos(this.fechaSeleccionada).subscribe({
      next: (res) => {
        this.loadingImportDividends = false;
        if (res.data) {
          this.lastImportDividendsResult = res.data;
          this.totalDividendsInDb = res.data.total_records_in_db || this.totalDividendsInDb;
        }
      },
      error: (err) => {
        this.loadingImportDividends = false;
        console.error('Error al importar dividendos:', err);
        this.error = 'Ocurrió un error al procesar e importar el histórico de dividendos.';
      }
    });
  }

  ejecutarSoloImportacionFacturas(): void {
    this.loadingImportFacturas = true;
    this.error = '';

    this.bvqService.importarFacturas(this.fechaSeleccionada).subscribe({
      next: (res) => {
        this.loadingImportFacturas = false;
        if (res.data) {
          this.lastImportFacturasResult = res.data;
          this.lastDateFacturasInDb = res.data.last_date_in_db || this.lastDateFacturasInDb;
        }
      },
      error: (err) => {
        this.loadingImportFacturas = false;
        console.error('Error al importar facturas:', err);
        this.error = 'Ocurrió un error al procesar e importar las facturas comerciales.';
      }
    });
  }

  ejecutarSoloImportacionGenericos(): void {
    this.loadingImportGenericos = true;
    this.error = '';

    this.bvqService.importarGenericos(this.fechaSeleccionada).subscribe({
      next: (res) => {
        this.loadingImportGenericos = false;
        if (res.data) {
          this.lastImportGenericosResult = res.data;
          this.lastDateGenericosInDb = res.data.last_date_in_db || this.lastDateGenericosInDb;
        }
      },
      error: (err) => {
        this.loadingImportGenericos = false;
        console.error('Error al importar genéricos:', err);
        this.error = 'Ocurrió un error al procesar e importar los valores genéricos.';
      }
    });
  }

  ejecutarSoloImportacionObligaciones(): void {
    this.loadingImportObligaciones = true;
    this.error = '';

    this.bvqService.importarObligaciones(this.fechaSeleccionada).subscribe({
      next: (res) => {
        this.loadingImportObligaciones = false;
        if (res.data) {
          this.lastImportObligacionesResult = res.data;
          this.lastDateObligacionesInDb = res.data.last_date_in_db || this.lastDateObligacionesInDb;
        }
      },
      error: (err) => {
        this.loadingImportObligaciones = false;
        console.error('Error al importar obligaciones:', err);
        this.error = 'Ocurrió un error al procesar e importar las obligaciones.';
      }
    });
  }

  ejecutarSoloImportacionPapeles(): void {
    this.loadingImportPapeles = true;
    this.error = '';

    this.bvqService.importarPapeles(this.fechaSeleccionada).subscribe({
      next: (res) => {
        this.loadingImportPapeles = false;
        if (res.data) {
          this.lastImportPapelesResult = res.data;
          this.lastDatePapelesInDb = res.data.last_date_in_db || this.lastDatePapelesInDb;
        }
      },
      error: (err) => {
        this.loadingImportPapeles = false;
        console.error('Error al importar papel comercial:', err);
        this.error = 'Ocurrió un error al procesar e importar el papel comercial.';
      }
    });
  }

  ejecutarSoloImportacionTitularizaciones(): void {
    this.loadingImportTitularizaciones = true;
    this.error = '';

    this.bvqService.importarTitularizaciones(this.fechaSeleccionada).subscribe({
      next: (res) => {
        this.loadingImportTitularizaciones = false;
        if (res.data) {
          this.lastImportTitularizacionesResult = res.data;
          this.lastDateTitularizacionesInDb = res.data.last_date_in_db || this.lastDateTitularizacionesInDb;
        }
      },
      error: (err) => {
        this.loadingImportTitularizaciones = false;
        console.error('Error al importar titularizaciones:', err);
        this.error = 'Ocurrió un error al procesar e importar las titularizaciones.';
      }
    });
  }

  cargarHistorial(): void {
    this.bvqService.getHistorial().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.historial = res.data;
          this.lastDateSharesInDb = res.last_date_shares || null;
          this.lastDateBondsInDb = res.last_date_bonds || null;
          this.totalDividendsInDb = res.total_dividends || 0;
          this.lastDateFacturasInDb = res.last_date_facturas || null;
          this.lastDateGenericosInDb = res.last_date_genericos || null;
          this.lastDateObligacionesInDb = res.last_date_obligaciones || null;
          this.lastDatePapelesInDb = res.last_date_papeles || null;
          this.lastDateTitularizacionesInDb = res.last_date_titularizaciones || null;
        }
      },
      error: (err) => {
        console.error('Error al obtener historial de descargas:', err);
      }
    });
  }


  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}



