import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { BvqDownloaderService, BvqDownloadResponse, BvqFileResult, BvqHistoryItem } from '../../core/bvq-downloader.service';

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
  loadingDownloadMap: { [key: string]: boolean } = {};
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

  // Resultados y Estado de BD
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
    this.guardarAjustes();
  }

  setTab(tab: 'descarga' | 'historial'): void {
    this.activeTab = tab;
    this.guardarAjustes();
  }

  setLogFilter(filter: 'ALL' | 'SUCCESS' | 'FAILED'): void {
    this.selectedLogFilter = filter;
    this.guardarAjustes();
  }

  private readonly STORAGE_KEY = 'bvq_downloader_settings';

  guardarAjustes(): void {
    try {
      const data = {
        fechaSeleccionada: this.fechaSeleccionada,
        masterAutoImport: this.masterAutoImport,
        autoImportAcciones: this.autoImportAcciones,
        autoImportBonos: this.autoImportBonos,
        autoImportDividendos: this.autoImportDividendos,
        autoImportFacturas: this.autoImportFacturas,
        autoImportGenericos: this.autoImportGenericos,
        autoImportObligaciones: this.autoImportObligaciones,
        autoImportPapeles: this.autoImportPapeles,
        autoImportTitularizaciones: this.autoImportTitularizaciones,
        activeTab: this.activeTab,
        selectedLogFilter: this.selectedLogFilter,
        lastDownloadResult: this.lastDownloadResult,
        lastImportResult: this.lastImportResult,
        lastImportBondsResult: this.lastImportBondsResult,
        lastImportDividendsResult: this.lastImportDividendsResult,
        lastImportFacturasResult: this.lastImportFacturasResult,
        lastImportGenericosResult: this.lastImportGenericosResult,
        lastImportObligacionesResult: this.lastImportObligacionesResult,
        lastImportPapelesResult: this.lastImportPapelesResult,
        lastImportTitularizacionesResult: this.lastImportTitularizacionesResult
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('No se pudo guardar la configuración en localStorage:', e);
    }
  }

  cargarAjustesGuardados(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.fechaSeleccionada) this.fechaSeleccionada = data.fechaSeleccionada;
        if (data.masterAutoImport !== undefined) this.masterAutoImport = data.masterAutoImport;
        if (data.autoImportAcciones !== undefined) this.autoImportAcciones = data.autoImportAcciones;
        if (data.autoImportBonos !== undefined) this.autoImportBonos = data.autoImportBonos;
        if (data.autoImportDividendos !== undefined) this.autoImportDividendos = data.autoImportDividendos;
        if (data.autoImportFacturas !== undefined) this.autoImportFacturas = data.autoImportFacturas;
        if (data.autoImportGenericos !== undefined) this.autoImportGenericos = data.autoImportGenericos;
        if (data.autoImportObligaciones !== undefined) this.autoImportObligaciones = data.autoImportObligaciones;
        if (data.autoImportPapeles !== undefined) this.autoImportPapeles = data.autoImportPapeles;
        if (data.autoImportTitularizaciones !== undefined) this.autoImportTitularizaciones = data.autoImportTitularizaciones;
        if (data.activeTab) this.activeTab = data.activeTab;
        if (data.selectedLogFilter) this.selectedLogFilter = data.selectedLogFilter;
        if (data.lastDownloadResult) this.lastDownloadResult = data.lastDownloadResult;
        if (data.lastImportResult) this.lastImportResult = data.lastImportResult;
        if (data.lastImportBondsResult) this.lastImportBondsResult = data.lastImportBondsResult;
        if (data.lastImportDividendsResult) this.lastImportDividendsResult = data.lastImportDividendsResult;
        if (data.lastImportFacturasResult) this.lastImportFacturasResult = data.lastImportFacturasResult;
        if (data.lastImportGenericosResult) this.lastImportGenericosResult = data.lastImportGenericosResult;
        if (data.lastImportObligacionesResult) this.lastImportObligacionesResult = data.lastImportObligacionesResult;
        if (data.lastImportPapelesResult) this.lastImportPapelesResult = data.lastImportPapelesResult;
        if (data.lastImportTitularizacionesResult) this.lastImportTitularizacionesResult = data.lastImportTitularizacionesResult;
      }
    } catch (e) {
      console.warn('Error al cargar la configuración de localStorage:', e);
    }
  }

  constructor(private bvqService: BvqDownloaderService) {}

  ngOnInit(): void {
    this.cargarAjustesGuardados();
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

  getModuleImportLogs(): Array<{ modulo: string; tabla: string; result: any }> {
    return [
      { modulo: 'Acciones', tabla: 'shares', result: this.lastImportResult },
      { modulo: 'Bonos', tabla: 'bond_his', result: this.lastImportBondsResult },
      { modulo: 'Dividendos', tabla: 'dividendos_his', result: this.lastImportDividendsResult },
      { modulo: 'Facturas Comerciales', tabla: 'facturas_his', result: this.lastImportFacturasResult },
      { modulo: 'Valores Genéricos', tabla: 'genericos_his', result: this.lastImportGenericosResult },
      { modulo: 'Obligaciones', tabla: 'obligaciones_his', result: this.lastImportObligacionesResult },
      { modulo: 'Papel Comercial', tabla: 'papeles_his', result: this.lastImportPapelesResult },
      { modulo: 'Titularizaciones', tabla: 'titularizaciones_his', result: this.lastImportTitularizacionesResult }
    ];
  }

  getModuleImportLogsFiltrados(): Array<{ modulo: string; tabla: string; result: any }> {
    const logs = this.getModuleImportLogs();
    if (this.selectedLogFilter === 'SUCCESS') {
      return logs.filter(m => m.result && m.result.success);
    }
    if (this.selectedLogFilter === 'FAILED') {
      return logs.filter(m => m.result && !m.result.success);
    }
    return logs.filter(m => m.result !== null);
  }

  copiarLogAlPortapapeles(): void {
    const lines: string[] = [];
    lines.push(`================================================================================`);
    lines.push(`LOG DE DESCARGA E IMPORTACIÓN BVQ - FECHA SELECCIONADA: ${this.fechaSeleccionada}`);
    lines.push(`================================================================================`);

    lines.push(`\n--- RESULTADOS DE IMPORTACIÓN A BASE DE DATOS (ETL) ---`);
    const moduleLogs = this.getModuleImportLogs();
    moduleLogs.forEach(m => {
      if (m.result) {
        const status = m.result.success ? 'ÉXITO' : 'ERROR';
        const errDetail = m.result.error || (m.result.detalles && m.result.detalles.error) ? ` | ERROR TÉCNICO: ${m.result.error || m.result.detalles.error}` : '';
        lines.push(`[${status}] Módulo ${m.modulo} (${m.tabla}): ${m.result.message}${errDetail}`);
      } else {
        lines.push(`[PENDIENTE] Módulo ${m.modulo} (${m.tabla}): Esperando procesamiento...`);
      }
    });

    if (this.lastDownloadResult) {
      lines.push(`\n--- RESULTADOS DE DESCARGA DE BOLETINES (HTTP/CURL) ---`);
      lines.push(`Directorio Base: ${this.lastDownloadResult.directorio_base}`);
      lines.push(`Totales: ${this.lastDownloadResult.total_archivos} | Exitosos: ${this.lastDownloadResult.exitosos} | Fallidos: ${this.lastDownloadResult.fallidos}`);
      lines.push(`--------------------------------------------------------------------------------`);
      if (this.lastDownloadResult.archivos) {
        this.lastDownloadResult.archivos.forEach(a => {
          lines.push(`[${a.status}] ${a.carpeta}/${a.archivo} - ${a.status === 'SUCCESS' ? this.formatBytes(a.size_bytes) : 'Error: ' + a.error}`);
        });
      }
    }

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
    this.guardarAjustes();
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
        this.guardarAjustes();
        this.cargarHistorial();
      },
      error: (err) => {
        this.loadingOnlyDownload = false;
        console.error('Error al ejecutar descarga BVQ:', err);
        if (err?.error?.data) {
          this.lastDownloadResult = err.error.data;
        }
        this.error = err?.error?.message || 'Ocurrió un error al descargar los archivos de la BVQ.';
        this.guardarAjustes();
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
        this.guardarAjustes();
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

  isDownloadingModulo(modulo: string): boolean {
    return !!this.loadingDownloadMap[modulo];
  }

  ejecutarDescargarModulo(modulo: string): void {
    this.loadingDownloadMap[modulo] = true;
    this.error = '';

    this.bvqService.descargarModulo(modulo, this.fechaSeleccionada).subscribe({
      next: (res) => {
        this.loadingDownloadMap[modulo] = false;
        if (res.data) {
          if (!this.lastDownloadResult) {
            this.lastDownloadResult = {
              fecha: this.fechaSeleccionada,
              directorio_base: res.data.directorio_base || '',
              total_archivos: 1,
              exitosos: res.data.success ? 1 : 0,
              fallidos: res.data.success ? 0 : 1,
              tiempo_ejecucion_segundos: res.data.tiempo_ejecucion_segundos || 0,
              archivos: res.data.archivos || []
            };
          } else {
            if (res.data.archivos && Array.isArray(res.data.archivos)) {
              this.lastDownloadResult.archivos = [
                ...this.lastDownloadResult.archivos.filter(
                  a => !res.data.archivos.some((newA: BvqFileResult) => newA.archivo === a.archivo)
                ),
                ...res.data.archivos
              ];
            }
          }
        }
        this.guardarAjustes();
        this.cargarHistorial();
      },
      error: (err) => {
        this.loadingDownloadMap[modulo] = false;
        console.error(`Error al descargar módulo ${modulo}:`, err);
        this.error = err?.error?.message || `Ocurrió un error al descargar el archivo de ${modulo}.`;
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



