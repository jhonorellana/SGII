import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { BvgDownloaderService, BvgDownloadResponse, BvgFileResult, BvgHistoryItem } from '../../core/bvg-downloader.service';

export interface BvgModuleConfig {
  key: string;
  nombre: string;
  archivoOriginal: string;
  carpeta: string;
  categoria: string;
  descripcion: string;
}

@Component({
  selector: 'app-bvg-downloader',
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
  templateUrl: './bvg-downloader.component.html',
  styleUrl: './bvg-downloader.component.css'
})
export class BvgDownloaderComponent implements OnInit {
  loading: boolean = false;
  loadingDownloadMap: { [key: string]: boolean } = {};
  fechaSeleccionada: string = new Date().toISOString().split('T')[0];

  // Estado del Modal de Log
  displayLogModal: boolean = false;
  selectedLogFilter: 'ALL' | 'SUCCESS' | 'FAILED' = 'ALL';
  copiadoExitoso: boolean = false;

  // Resultados y Historial
  lastDownloadResult: BvgDownloadResponse['data'] | null = null;
  historial: BvgHistoryItem[] = [];
  error: string = '';

  activeTab: 'descarga' | 'historial' = 'descarga';

  // Módulos BVG oficiales con estructura simplificada
  modulosList: BvgModuleConfig[] = [
    {
      key: 'acciones',
      nombre: 'Cotizaciones de Acciones BVG',
      archivoOriginal: 'BVG_Acciones.xlsx',
      carpeta: '001_RentaVariable',
      categoria: 'Renta Variable',
      descripcion: 'Precios, variaciones y montos negociados de acciones de empresas en la BVG.'
    },
    {
      key: 'dividendos',
      nombre: 'Histórico de Dividendos BVG',
      archivoOriginal: 'dividendos-totales.xlsx',
      carpeta: '001_RentaVariable',
      categoria: 'Renta Variable',
      descripcion: 'Registro histórico consolidado de dividendos repartidos en la BVG.'
    },
    {
      key: 'bonos',
      nombre: 'Bonos del Estado BVG',
      archivoOriginal: 'BVG_BonosDelEstado.xlsx',
      carpeta: '002_CotizacionesHistoricas',
      categoria: 'Cotizaciones Históricas',
      descripcion: 'Cotizaciones y negociaciones de Bonos del Estado en la BVG.'
    },
    {
      key: 'obligaciones',
      nombre: 'Obligaciones de Empresas',
      archivoOriginal: 'BVG_Obligaciones.xlsx',
      carpeta: '002_CotizacionesHistoricas',
      categoria: 'Cotizaciones Históricas',
      descripcion: 'Emisiones y cotizaciones de Obligaciones Corporativas en la BVG.'
    },
    {
      key: 'papel_comercial',
      nombre: 'Papel Comercial',
      archivoOriginal: 'BVG_PapelComercial.xlsx',
      carpeta: '002_CotizacionesHistoricas',
      categoria: 'Cotizaciones Históricas',
      descripcion: 'Operaciones e información bursátil de Papeles Comerciales.'
    },
    {
      key: 'titularizaciones',
      nombre: 'Titularizaciones',
      archivoOriginal: 'BVG_Titularizaciones.xlsx',
      carpeta: '002_CotizacionesHistoricas',
      categoria: 'Cotizaciones Históricas',
      descripcion: 'Procesos y cotizaciones de Titularizaciones en la BVG.'
    },
    {
      key: 'cetes',
      nombre: 'Certificados de Tesorería (CETES)',
      archivoOriginal: 'BVG_Cetes.xlsx',
      carpeta: '002_CotizacionesHistoricas',
      categoria: 'Cotizaciones Históricas',
      descripcion: 'Rendimientos y cotizaciones de Certificados de Tesorería del Estado.'
    },
    {
      key: 'notas_credito',
      nombre: 'Notas de Crédito (TCT / NCD)',
      archivoOriginal: 'BVG_NotasDeCredito.xlsx',
      carpeta: '002_CotizacionesHistoricas',
      categoria: 'Cotizaciones Históricas',
      descripcion: 'Notas de crédito tributario negociadas en la Bolsa de Guayaquil.'
    },
    {
      key: 'vector_precios',
      nombre: 'Vector de Precios Diario',
      archivoOriginal: 'Vectores Final.xls',
      carpeta: '003_VectorDePrecios',
      categoria: 'Vector de Precios',
      descripcion: 'Vector oficial de precios con hojas Renta Fija, Variable, Curva NSS y SPOT.'
    },
    {
      key: 'valores_permitidos',
      nombre: 'Valores Permitidos para Valoración',
      archivoOriginal: 'valores-permitidos.xlsx',
      carpeta: '003_VectorDePrecios',
      categoria: 'Vector de Precios',
      descripcion: 'Lista maestra de títulos y especies permitidas en el vector de precios.'
    }
  ];

  private readonly STORAGE_KEY = 'bvg_downloader_settings';

  constructor(private downloaderService: BvgDownloaderService) {}

  ngOnInit(): void {
    this.cargarAjustesGuardados();
    this.cargarHistorial();
  }

  setTab(tab: 'descarga' | 'historial'): void {
    this.activeTab = tab;
    this.guardarAjustes();
  }

  setLogFilter(filter: 'ALL' | 'SUCCESS' | 'FAILED'): void {
    this.selectedLogFilter = filter;
    this.guardarAjustes();
  }

  guardarAjustes(): void {
    try {
      const data = {
        fechaSeleccionada: this.fechaSeleccionada,
        activeTab: this.activeTab,
        selectedLogFilter: this.selectedLogFilter,
        lastDownloadResult: this.lastDownloadResult
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
        if (data.activeTab) this.activeTab = data.activeTab;
        if (data.selectedLogFilter) this.selectedLogFilter = data.selectedLogFilter;
        if (data.lastDownloadResult) this.lastDownloadResult = data.lastDownloadResult;
      }
    } catch (e) {
      console.warn('No se pudo cargar la configuración de localStorage:', e);
    }
  }

  ejecutarDescargaCompleta(): void {
    this.loading = true;
    this.error = '';

    this.downloaderService.descargar(this.fechaSeleccionada).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.lastDownloadResult = res.data;
          this.guardarAjustes();
          this.cargarHistorial();
        } else {
          this.error = res.message || 'Error en la descarga de archivos de la BVG';
          if (res.data) {
            this.lastDownloadResult = res.data;
          }
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || err.message || 'Error de conexión con el servidor backend';
      }
    });
  }

  descargarModuloIndividual(moduloKey: string): void {
    this.loadingDownloadMap[moduloKey] = true;
    this.error = '';

    this.downloaderService.descargarModulo(moduloKey, this.fechaSeleccionada).subscribe({
      next: (res) => {
        this.loadingDownloadMap[moduloKey] = false;
        if (res.success && res.data) {
          const newFile: BvgFileResult = {
            url: '',
            archivo: res.data.archivo,
            carpeta: res.data.carpeta,
            path: res.data.path,
            status: 'SUCCESS',
            size_bytes: res.data.size_bytes,
            error: null
          };

          if (!this.lastDownloadResult) {
            const dateParts = (this.fechaSeleccionada || new Date().toISOString().split('T')[0]).split('-');
            const aaaa = dateParts[0];
            const mm = dateParts[1];
            const dd = dateParts[2];
            const dayFolder = `${aaaa}_${mm}_${dd}`;
            const baseFolder = `C:\\Users\\super\\DATOS\\004. DatosBVG\\${aaaa}_${mm}\\${dayFolder}`;

            this.lastDownloadResult = {
              fecha: this.fechaSeleccionada,
              directorio_base: baseFolder,
              total_archivos: 1,
              exitosos: 1,
              fallidos: 0,
              tiempo_ejecucion_segundos: 0,
              archivos: [newFile]
            };
          } else {
            const index = this.lastDownloadResult.archivos.findIndex(a => a.archivo === newFile.archivo || (a.carpeta === newFile.carpeta && a.archivo.includes(moduloKey)));
            if (index >= 0) {
              this.lastDownloadResult.archivos[index] = newFile;
            } else {
              this.lastDownloadResult.archivos.push(newFile);
            }
          }
          this.guardarAjustes();
          this.cargarHistorial();
        } else {
          this.error = res.message || `Error al descargar el módulo ${moduloKey}`;
        }
      },
      error: (err) => {
        this.loadingDownloadMap[moduloKey] = false;
        this.error = err.error?.message || `Error de red al descargar ${moduloKey}`;
      }
    });
  }

  cargarHistorial(): void {
    this.downloaderService.getHistorial().subscribe({
      next: (res) => {
        if (res.success) {
          this.historial = res.data;
        }
      },
      error: (err) => {
        console.error('Error al cargar historial BVG:', err);
      }
    });
  }

  openLogModal(): void {
    this.displayLogModal = true;
  }

  closeLogModal(): void {
    this.displayLogModal = false;
  }

  getFilteredArchivos(): BvgFileResult[] {
    if (!this.lastDownloadResult?.archivos) return [];
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
    
    let text = `=== LOG DE DESCARGA BOLSA DE VALORES DE GUAYAQUIL (BVG) ===\n`;
    text += `Fecha de Proceso: ${this.lastDownloadResult.fecha}\n`;
    text += `Directorio Destino: ${this.lastDownloadResult.directorio_base}\n`;
    text += `Resumen: ${this.lastDownloadResult.exitosos} Exitosos, ${this.lastDownloadResult.fallidos} Fallidos de ${this.lastDownloadResult.total_archivos} Total. Tiempo: ${this.lastDownloadResult.tiempo_ejecucion_segundos}s\n\n`;
    text += `DETALLE DE ARCHIVOS:\n`;

    const items = this.getFilteredArchivos();
    items.forEach((item, index) => {
      text += `${index + 1}. [${item.status}] ${item.archivo} (${item.carpeta})\n`;
      text += `   Ruta: ${item.path}\n`;
      text += `   Tamaño: ${item.size_bytes} bytes\n`;
      if (item.error) {
        text += `   Error: ${item.error}\n`;
      }
      text += `\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      this.copiadoExitoso = true;
      setTimeout(() => {
        this.copiadoExitoso = false;
      }, 3000);
    }).catch(err => {
      console.error('Error al copiar al portapapeles:', err);
    });
  }

  formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  getArchivoResultForModule(moduleKey: string): BvgFileResult | null {
    if (!this.lastDownloadResult || !this.lastDownloadResult.archivos) return null;
    const moduleConfig = this.modulosList.find(m => m.key === moduleKey);
    if (!moduleConfig) return null;

    return this.lastDownloadResult.archivos.find(a => 
      a.carpeta === moduleConfig.carpeta && 
      (a.archivo.toLowerCase().includes(moduleConfig.key.replace('_', '')) || 
       a.archivo.toLowerCase().includes(moduleConfig.archivoOriginal.split('.')[0].toLowerCase()))
    ) || null;
  }
}
