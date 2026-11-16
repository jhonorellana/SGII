import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { MessageService } from 'primeng/api';
import { AccionOperacionService } from '../../../core/accion-operacion.service';

export interface AccionPreviewItem {
  id_temporal: string;
  filename: string;
  bolsa: string;
  tipo_titulo: string;
  id_tipo_operacion: number;
  tipo_operacion_codigo: string;
  tipo_operacion_nombre: string;
  liquidacion: string | null;
  fecha_operacion: string | null;
  fecha_valor: string | null;
  comitente_nombre: string | null;
  comitente_identificacion: string | null;
  id_persona: number | null;
  persona_detectada: string | null;
  emisor_nombre: string | null;
  codigo_vector: string | null;
  codigo_seb: string | null;
  id_emisor: number | null;
  emisor_detectado: string | null;
  id_instrumento: number | null;
  instrumento_detectado: string | null;
  instrumento_match_metodo: string | null;
  cantidad: number;
  valor_nominal_unitario: number;
  valor_nominal_total: number;
  precio_unitario: number;
  valor_bruto: number;
  comision_bolsa: number;
  comision_operador: number;
  total_comisiones: number;
  valor_neto: number;
  factura_bolsa: string | null;
  factura_casa_valores: string | null;
  operador_valores: string | null;
  estado: 'LISTO' | 'DUPLICADO' | 'ERROR';
  duplicado_bd: boolean;
  id_operacion_existente: number | null;
  stock_disponible: number | null;
  observacion_sistema: string;
  seleccionado: boolean;
}

@Component({
  selector: 'app-importar-pdf-acciones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    DropdownModule,
    ToastModule,
    ProgressBarModule,
    CheckboxModule,
    TooltipModule,
    DialogModule,
    InputSwitchModule
  ],
  providers: [MessageService],
  templateUrl: './importar-pdf-acciones.component.html',
  styleUrls: ['./importar-pdf-acciones.component.css']
})
export class ImportarPdfAccionesComponent {
  isDragging = false;
  isLoading = false;
  isSaving = false;

  items: AccionPreviewItem[] = [];
  personasOptions: { label: string; value: number }[] = [];
  instrumentosOptions: { label: string; value: number }[] = [];
  tiposOperacionOptions = [
    { label: 'Compra de Acciones', value: 204 },
    { label: 'Venta de Acciones', value: 205 }
  ];

  registrarMovimientoCapital = true;

  // Modal de edición
  editDialogVisible = false;
  editItem: AccionPreviewItem | null = null;
  editBackup: AccionPreviewItem | null = null;

  // Resultado de la importación
  resultadoImportacion: any = null;

  constructor(
    private operacionService: AccionOperacionService,
    private messageService: MessageService,
    private router: Router
  ) {}

  // ===================== Drag & Drop =====================
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.validarYProcesar(Array.from(event.dataTransfer.files));
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.validarYProcesar(Array.from(input.files));
    }
    input.value = '';
  }

  private validarYProcesar(allFiles: File[]): void {
    const files = allFiles.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (files.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Formato inválido',
        detail: 'Por favor sube únicamente archivos en formato PDF.'
      });
      return;
    }
    this.procesarArchivos(files);
  }

  procesarArchivos(files: File[]): void {
    this.isLoading = true;
    this.resultadoImportacion = null;

    this.operacionService.previewPdfImport(files).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success && response.data) {
          const nuevos: AccionPreviewItem[] = (response.data.items || []).map((it: any) => this.castItem(it));

          // Evitar duplicados dentro del mismo lote (misma liquidación)
          const existentes = new Set(this.items.map((i) => this.normalizarLiq(i.liquidacion)));
          nuevos.forEach((n) => {
            const key = this.normalizarLiq(n.liquidacion);
            if (key && existentes.has(key)) {
              n.estado = 'DUPLICADO';
              n.seleccionado = false;
              n.observacion_sistema = 'Archivo repetido en el lote actual.';
            }
            existentes.add(key);
          });

          this.items = [...this.items, ...nuevos];
          this.cargarCatalogos(response.data.catalogos);

          this.messageService.add({
            severity: 'success',
            summary: 'Análisis completado',
            detail: `Se analizaron ${nuevos.length} archivo(s) PDF de Renta Variable.`
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: response.message || 'No se pudieron analizar los archivos.'
          });
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.message || 'Error al procesar los archivos PDF.'
        });
      }
    });
  }

  private castItem(it: any): AccionPreviewItem {
    const num = (v: any) => (v === null || v === undefined || v === '' ? 0 : parseFloat(v));
    return {
      ...it,
      id_tipo_operacion: Number(it.id_tipo_operacion || 204),
      cantidad: num(it.cantidad),
      valor_nominal_unitario: num(it.valor_nominal_unitario),
      valor_nominal_total: num(it.valor_nominal_total),
      precio_unitario: num(it.precio_unitario),
      valor_bruto: num(it.valor_bruto),
      comision_bolsa: num(it.comision_bolsa),
      comision_operador: num(it.comision_operador),
      total_comisiones: num(it.total_comisiones),
      valor_neto: num(it.valor_neto)
    };
  }

  private cargarCatalogos(catalogos: any): void {
    if (!catalogos) {
      return;
    }
    if (catalogos.personas) {
      this.personasOptions = catalogos.personas.map((p: any) => ({
        label: `${p.nombres} ${p.apellidos || ''}`.trim(),
        value: p.id_persona
      }));
    }
    if (catalogos.instrumentos) {
      this.instrumentosOptions = catalogos.instrumentos.map((i: any) => ({
        label: `${i.nombre}${i.codigo_titulo_vector ? ' (' + i.codigo_titulo_vector + ')' : ''}`,
        value: i.id_instrumento
      }));
    }
  }

  private normalizarLiq(liq: string | null): string {
    return (liq || '').replace(/\s+/g, '').toUpperCase();
  }

  // ===================== Resumen =====================
  get itemsListos(): AccionPreviewItem[] {
    return this.items.filter((i) => i.estado === 'LISTO');
  }

  get itemsSeleccionados(): AccionPreviewItem[] {
    return this.items.filter((i) => i.seleccionado && i.estado === 'LISTO');
  }

  get totalDuplicados(): number {
    return this.items.filter((i) => i.estado === 'DUPLICADO').length;
  }

  get totalErrores(): number {
    return this.items.filter((i) => i.estado === 'ERROR').length;
  }

  get totalAccionesSeleccionadas(): number {
    return this.itemsSeleccionados.reduce((s, i) => s + (i.cantidad || 0), 0);
  }

  get totalNetoSeleccionado(): number {
    return this.itemsSeleccionados.reduce((s, i) => s + (i.valor_neto || 0), 0);
  }

  get todosSeleccionados(): boolean {
    const listos = this.itemsListos;
    return listos.length > 0 && listos.every((i) => i.seleccionado);
  }

  toggleSeleccionTodos(checked: boolean): void {
    this.items.forEach((i) => {
      if (i.estado === 'LISTO') {
        i.seleccionado = checked;
      }
    });
  }

  // ===================== Edición =====================
  abrirEdicion(item: AccionPreviewItem): void {
    this.editBackup = { ...item };
    this.editItem = item;
    this.editDialogVisible = true;
  }

  cancelarEdicion(): void {
    if (this.editItem && this.editBackup) {
      Object.assign(this.editItem, this.editBackup);
    }
    this.editDialogVisible = false;
    this.editItem = null;
    this.editBackup = null;
  }

  guardarEdicion(): void {
    if (!this.editItem) {
      return;
    }
    const it = this.editItem;
    it.cantidad = Number(it.cantidad) || 0;
    it.precio_unitario = Number(it.precio_unitario) || 0;
    it.comision_bolsa = Number(it.comision_bolsa) || 0;
    it.comision_operador = Number(it.comision_operador) || 0;
    it.valor_bruto = Number(it.valor_bruto) || 0;
    it.valor_neto = Number(it.valor_neto) || 0;
    it.total_comisiones = this.round2(it.comision_bolsa + it.comision_operador);

    const inst = this.instrumentosOptions.find((o) => o.value === it.id_instrumento);
    if (inst) {
      it.instrumento_detectado = inst.label;
    }
    const per = this.personasOptions.find((o) => o.value === it.id_persona);
    if (per) {
      it.persona_detectada = per.label;
    }
    it.tipo_operacion_nombre = it.id_tipo_operacion === 205 ? 'Venta de Acciones' : 'Compra de Acciones';

    this.editDialogVisible = false;
    this.editItem = null;
    this.editBackup = null;
  }

  recalcularMontos(): void {
    if (!this.editItem) {
      return;
    }
    const it = this.editItem;
    it.valor_bruto = this.round2((Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0));
    it.total_comisiones = this.round2((Number(it.comision_bolsa) || 0) + (Number(it.comision_operador) || 0));
    it.valor_neto =
      Number(it.id_tipo_operacion) === 205
        ? this.round2(it.valor_bruto - it.total_comisiones)
        : this.round2(it.valor_bruto + it.total_comisiones);
  }

  diferenciaCuadre(item: AccionPreviewItem): number {
    const esperado = this.round2((item.cantidad || 0) * (item.precio_unitario || 0));
    return this.round2((item.valor_bruto || 0) - esperado);
  }

  eliminarItem(item: AccionPreviewItem): void {
    this.items = this.items.filter((i) => i.id_temporal !== item.id_temporal);
  }

  limpiarTodo(): void {
    this.items = [];
    this.resultadoImportacion = null;
  }

  // ===================== Confirmación =====================
  confirmarImportacion(): void {
    const seleccionados = this.itemsSeleccionados;
    if (seleccionados.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin selección',
        detail: 'Selecciona al menos una operación lista para importar.'
      });
      return;
    }

    const sinSocio = seleccionados.filter((i) => !i.id_persona);
    if (sinSocio.length > 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Socio requerido',
        detail: `Hay ${sinSocio.length} operación(es) sin socio asignado.`
      });
      return;
    }

    this.isSaving = true;
    const payload = seleccionados.map((i) => ({
      filename: i.filename,
      liquidacion: i.liquidacion,
      id_tipo_operacion: i.id_tipo_operacion,
      fecha_operacion: i.fecha_operacion,
      id_persona: i.id_persona,
      id_emisor: i.id_emisor,
      id_instrumento: i.id_instrumento,
      emisor_nombre: i.emisor_nombre,
      codigo_vector: i.codigo_vector,
      valor_nominal_unitario: i.valor_nominal_unitario,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      valor_bruto: i.valor_bruto,
      comision_bolsa: i.comision_bolsa,
      comision_operador: i.comision_operador,
      valor_neto: i.valor_neto,
      observacion: `Importado desde PDF (${i.bolsa}): ${i.filename}`
    }));

    this.operacionService.confirmPdfImport(payload, this.registrarMovimientoCapital).subscribe({
      next: (response) => {
        this.isSaving = false;
        if (response.success) {
          this.resultadoImportacion = response.data;
          const guardadas = new Set(
            (response.data?.guardadas || []).map((g: any) => this.normalizarLiq(g.liquidacion))
          );
          this.items = this.items.filter((i) => !guardadas.has(this.normalizarLiq(i.liquidacion)));
          this.messageService.add({
            severity: 'success',
            summary: 'Importación exitosa',
            detail: response.message
          });
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: response.message });
        }
      },
      error: (err) => {
        this.isSaving = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.message || 'Error al guardar las operaciones.'
        });
      }
    });
  }

  // ===================== Navegación y utilidades =====================
  irAOperaciones(): void {
    this.router.navigate(['/renta-variable/operaciones']);
  }

  irAPortafolio(): void {
    this.router.navigate(['/renta-variable/portafolio']);
  }

  getEstadoSeverity(estado: string): 'success' | 'warning' | 'danger' | 'info' {
    switch (estado) {
      case 'LISTO':
        return 'success';
      case 'DUPLICADO':
        return 'warning';
      case 'ERROR':
        return 'danger';
      default:
        return 'info';
    }
  }

  getRowClass(item: AccionPreviewItem): string {
    if (item.estado === 'DUPLICADO') {
      return 'table-warning-row';
    }
    if (item.estado === 'ERROR') {
      return 'table-danger-row';
    }
    return '';
  }

  formatCurrency(v: number | null | undefined): string {
    const n = Number(v || 0);
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatNumber(v: number | null | undefined, decimals = 0): string {
    const n = Number(v || 0);
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  formatPrecio(v: number | null | undefined): string {
    const n = Number(v || 0);
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }

  private round2(v: number): number {
    return Math.round((v + Number.EPSILON) * 100) / 100;
  }
}

