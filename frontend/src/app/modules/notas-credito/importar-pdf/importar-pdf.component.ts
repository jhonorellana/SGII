import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { PdfImportService, PreviewItem, PersonaOption } from '../../../core/pdf-import.service';

@Component({
  selector: 'app-importar-pdf',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    TagModule,
    DropdownModule,
    ToastModule,
    ProgressBarModule,
    CheckboxModule,
    TooltipModule
  ],
  providers: [MessageService],
  templateUrl: './importar-pdf.component.html',
  styleUrls: ['./importar-pdf.component.css']
})
export class ImportarPdfComponent implements OnInit {
  isDragging = false;
  isLoading = false;
  isSaving = false;

  filesUploaded: File[] = [];
  items: PreviewItem[] = [];
  personasDisponibles: PersonaOption[] = [];

  selectAll = true;

  constructor(
    private pdfImportService: PdfImportService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  // Drag & drop handlers
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
      const files = Array.from(event.dataTransfer.files).filter((f) =>
        f.name.toLowerCase().endsWith('.pdf')
      );
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
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files).filter((f) =>
        f.name.toLowerCase().endsWith('.pdf')
      );
      this.procesarArchivos(files);
      input.value = '';
    }
  }

  procesarArchivos(files: File[]): void {
    this.isLoading = true;
    this.filesUploaded = files;

    this.pdfImportService.previewFiles(files).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.items = res.data.items;
          this.personasDisponibles = res.data.personas_disponibles;

          // Auto-marcar checkbox "seleccionar todo" si hay válidos
          this.actualizarEstadoSelectAll();

          this.messageService.add({
            severity: 'success',
            summary: 'Archivos procesados',
            detail: `Se analizaron ${res.data.resumen.total_archivos} documentos: ${res.data.resumen.validos} válidos, ${res.data.resumen.duplicados} ya registrados.`
          });
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error al procesar',
          detail: err.error?.message || 'Ocurrió un error al procesar los documentos PDF.'
        });
      }
    });
  }

  toggleSelectAll(): void {
    this.items.forEach((item) => {
      if (item.estado !== 'ERROR') {
        item.seleccionado = this.selectAll;
      }
    });
  }

  actualizarEstadoSelectAll(): void {
    const validItems = this.items.filter((i) => i.estado === 'VALIDO');
    if (validItems.length > 0) {
      this.selectAll = validItems.every((i) => i.seleccionado);
    } else {
      this.selectAll = false;
    }
  }

  removerItem(index: number): void {
    this.items.splice(index, 1);
    this.actualizarEstadoSelectAll();
  }

  limpiarTodo(): void {
    this.items = [];
    this.filesUploaded = [];
    this.selectAll = true;
  }

  get itemsSeleccionados(): PreviewItem[] {
    return this.items.filter((i) => i.seleccionado && i.id_propietario);
  }

  get totalNominalSeleccionado(): number {
    return this.itemsSeleccionados.reduce((acc, i) => acc + (i.valor_nominal || 0), 0);
  }

  get totalInvertidoSeleccionado(): number {
    return this.itemsSeleccionados.reduce((acc, i) => acc + (i.capital_invertido || 0), 0);
  }

  get totalValidos(): number {
    return this.items.filter((i) => i.estado === 'VALIDO').length;
  }

  get totalDuplicados(): number {
    return this.items.filter((i) => i.estado === 'DUPLICADO').length;
  }

  get totalErrores(): number {
    return this.items.filter((i) => i.estado === 'ERROR').length;
  }

  confirmarImportacion(): void {
    const seleccionados = this.itemsSeleccionados;
    if (seleccionados.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin selección',
        detail: 'Selecciona al menos una inversión válida para importar.'
      });
      return;
    }

    // Verificar que todos los seleccionados tengan un propietario asignado
    const sinPropietario = seleccionados.some((i) => !i.id_propietario);
    if (sinPropietario) {
      this.messageService.add({
        severity: 'error',
        summary: 'Propietario requerido',
        detail: 'Asigna un propietario a todas las inversiones que deseas importar.'
      });
      return;
    }

    this.isSaving = true;
    this.pdfImportService.confirmImport(seleccionados).subscribe({
      next: (res) => {
        this.isSaving = false;
        if (res.success) {
          this.messageService.add({
            severity: 'success',
            summary: '¡Importación Exitosa!',
            detail: res.message
          });

          // Remover los ítems guardados de la vista previa
          const idsGuardados = (res.data?.guardados || []).map((g: any) => g.liquidacion);
          this.items = this.items.filter((i) => !idsGuardados.includes(i.liquidacion));

          // Si ya no quedan ítems, redirigir a venta-agrupada después de un breve delay
          if (this.items.length === 0) {
            setTimeout(() => {
              this.router.navigate(['/venta-agrupada']);
            }, 1800);
          }
        }
      },
      error: (err) => {
        this.isSaving = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error al importar',
          detail: err.error?.message || 'No se pudieron registrar las inversiones seleccionadas.'
        });
      }
    });
  }

  irAVentaAgrupada(): void {
    this.router.navigate(['/venta-agrupada']);
  }
}
