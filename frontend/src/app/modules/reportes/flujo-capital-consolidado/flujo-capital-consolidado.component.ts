import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { FlujoCapitalService } from '../../../core/flujo-capital.service';
import { GrupoFamiliarService } from '../../../core/grupo-familiar.service';
import { PersonaService } from '../../../core/persona.service';
import { AuthService } from '../../../core/auth.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { ModalActionsComponent } from '../../../core/modal-actions';
import { AmortizacionService } from '../../../core/amortizacion.service';
import { InputTextModule } from 'primeng/inputtext';
import { InversionService } from '../../../core/inversion.service';
import { EmisorService } from '../../../core/emisor.service';
import { forkJoin } from 'rxjs';

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
  id_propietario: number;
  id_emisor: number;
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
    CalendarModule,
    DialogModule,
    TableModule,
    TabViewModule,
    InputTextModule,
    ModalActionsComponent
  ],
  providers: [MessageService, ModalActionsComponent, InversionService, EmisorService],
  templateUrl: './flujo-capital-consolidado.component.html',
  styleUrls: ['./flujo-capital-consolidado.component.css']
})
export class FlujoCapitalConsolidadoComponent implements OnInit {
  @Input() isModal: boolean = false;
  @Input() paramsModal: any = null;

  reporteForm!: FormGroup;
  amortizacionForm!: FormGroup;
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
    total: 0,
    id_propietario: 0,
    id_emisor: 0
  };
  
  flujoCapitalDiario: FlujoCapitalItem[] = [];
  totalesDiario: FlujoCapitalItem = {
    fecha: 'TOTAL',
    propietario: '',
    empresa: '',
    interes: 0,
    capital: 0,
    descuento: 0,
    interes_moroso: 0,
    capital_moroso: 0,
    descuento_moroso: 0,
    total: 0,
    id_propietario: 0,
    id_emisor: 0
  };

  loading = false;

  // Propiedades para el modal de detalle
  mostrarModalDetalle = false;
  detalleSeleccionado: FlujoCapitalItem | null = null;
  detalleItems: any[] = [];
  loadingDetalle = false;
  lastParams: any = null;

  // Edición de Amortización
  displayEditAmortizacionDialog = false;
  // Modal de Pago Parcial (División de Cuota)
  displayPagoParcialDialog = false;
  loadingPagoParcial = false;
  pagoParcialForm!: FormGroup;
  saldoRestanteCalculado = { capital: 0, interes: 0, descuento: 0, total: 0 };
  totalPagadoCalculado = 0;

  // Historial de Pagos Parciales
  displayHistorialDialog = false;
  loadingHistorial = false;
  historialPagos: any[] = [];
  cuotaHistorialSeleccionada: any = null;
  loadingAmortizacion = false;
  editingAmortizacionId: number | null = null;
  amortizacionOriginal: any = null;
  selectedAmortizacionDetalle: any = null;
  
  // Resumen de Inversión
  inversionResumen: any = null;

  currentUser: any = null;
  gruposFamiliares: any[] = [];
  personas: any[] = [];
  emisores: any[] = [];

  constructor(
    private fb: FormBuilder,
    private flujoCapitalService: FlujoCapitalService,
    private grupoFamiliarService: GrupoFamiliarService,
    private personaService: PersonaService,
    private amortizacionService: AmortizacionService,
    private inversionService: InversionService,
    private emisorService: EmisorService,
    private messageService: MessageService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {    this.inicializarFormulario();
    this.inicializarAmortizacionForm();
    this.inicializarPagoParcialForm();
    this.loadCurrentUser();
    this.loadInitialData();

    if (this.isModal && this.paramsModal) {
      this.reporteForm.patchValue({
        fecha_inicio: new Date(this.paramsModal.fecha_inicio + 'T00:00:00'),
        fecha_fin: new Date(this.paramsModal.fecha_fin + 'T00:00:00'),
        id_grupo_familiar: this.paramsModal.id_grupo_familiar,
        id_propietario: this.paramsModal.id_propietario,
        id_emisor: this.paramsModal.id_emisor || null
      });
      // Delay so form updates properly
      setTimeout(() => {
        this.generarReporte();
      }, 500);
    } else {
      // Generar reporte automáticamente después de cargar los datos iniciales
      setTimeout(() => {
        this.generarReporte();
      }, 1000);
    }
  }

  inicializarAmortizacionForm(): void {
    this.amortizacionForm = this.fb.group({
      fecha_pago: [null, Validators.required],
      capital: [0, [Validators.required, Validators.min(0)]],
      interes: [0, [Validators.required, Validators.min(0)]],
      descuento: [0, [Validators.required, Validators.min(0)]]
    });
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
      id_propietario: [null],
      id_emisor: [null]
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

    this.emisorService.getEmisores().subscribe({
      next: (response) => {
        const emisoresArray = Array.isArray(response) ? response : (response.data || []);
        this.emisores = emisoresArray
          .filter((e: any) => e.activo == 1 || e.activo === true)
          .map((e: any) => ({
            id_emisor: e.id_emisor,
            nombre: e.nombre
          }))
          .sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || ''));
      },
      error: (error) => {
        console.error('Error cargando emisores:', error);
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
      id_propietario: this.reporteForm.get('id_propietario')?.value,
      id_emisor: this.reporteForm.get('id_emisor')?.value
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
      total: 0,
      id_propietario: 0,
      id_emisor: 0
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

    const agrupado: { [fecha: string]: FlujoCapitalItem } = {};
    this.flujoCapital.forEach(item => {
      if (!agrupado[item.fecha]) {
        agrupado[item.fecha] = {
          fecha: item.fecha,
          propietario: 'Varios',
          empresa: 'Varias',
          interes: 0,
          capital: 0,
          descuento: 0,
          interes_moroso: 0,
          capital_moroso: 0,
          descuento_moroso: 0,
          total: 0,
          id_propietario: 0,
          id_emisor: 0
        };
      }
      const g = agrupado[item.fecha];
      g.interes += item.interes;
      g.capital += item.capital;
      g.descuento += item.descuento;
      g.interes_moroso += item.interes_moroso;
      g.capital_moroso += item.capital_moroso;
      g.descuento_moroso += item.descuento_moroso;
      g.total += item.total;
    });

    this.flujoCapitalDiario = Object.keys(agrupado)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map(k => agrupado[k]);

    this.totalesDiario = { ...this.totales };
  }

  exportarExcel(): void {
    const params = {
      fecha_inicio: this.formatDate(this.reporteForm.get('fecha_inicio')?.value),
      fecha_fin: this.formatDate(this.reporteForm.get('fecha_fin')?.value),
      id_grupo_familiar: this.reporteForm.get('id_grupo_familiar')?.value,
      id_propietario: this.reporteForm.get('id_propietario')?.value,
      id_emisor: this.reporteForm.get('id_emisor')?.value
    };

    this.flujoCapitalService.exportarExcel(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.generarExcelFrontend(response.data);
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: response.message || 'No se pudo exportar el archivo Excel'
          });
        }
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

  generarExcelFrontend(datos: any[]): void {
    const wb = XLSX.utils.book_new();

    // Encabezados
    const headers = [
      'Fecha',
      'Propietario',
      'Empresa/Emisor',
      'Interés',
      'Capital',
      'Premio',
      'Int. Riesgo',
      'Cap. Riesgo',
      'Prem. Riesgo',
      'Total'
    ];

    // Datos del reporte (excluyendo totales)
    const datosReporte = datos.filter(item => item.empresa !== 'TOTAL').map(item => [
      item.fecha,
      item.propietario,
      item.empresa,
      item.interes,
      item.capital,
      item.descuento,
      item.interes_moroso,
      item.capital_moroso,
      item.descuento_moroso,
      item.total
    ]);

    // Fila de totales
    const totales = datos.find(item => item.empresa === 'TOTAL');
    if (totales) {
      datosReporte.push([
        totales.fecha,
        totales.propietario,
        totales.empresa,
        totales.interes,
        totales.capital,
        totales.descuento,
        totales.interes_moroso,
        totales.capital_moroso,
        totales.descuento_moroso,
        totales.total
      ]);
    }

    // Crear worksheet
    const wsData = [headers, ...datosReporte];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Formato de encabezados
    const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({r: 0, c: col});
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          font: {bold: true, color: {rgb: "FFFFFFFF"}},
          fill: {fgColor: {rgb: "FF4472C4"}}
        };
      }
    }

    // Formato de totales
    if (totales) {
      const totalRow = datosReporte.length;
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({r: totalRow, c: col});
        if (ws[cellAddress]) {
          ws[cellAddress].s = {
            font: {bold: true, color: {rgb: "FFFFFFFF"}},
            fill: {fgColor: {rgb: "FF198754"}}
          };
        }
      }
    }

    // Ancho de columnas
    ws['!cols'] = [
      {wch: 12}, // Fecha
      {wch: 20}, // Propietario
      {wch: 20}, // Empresa/Emisor
      {wch: 12}, // Interés
      {wch: 12}, // Capital
      {wch: 12}, // Premio
      {wch: 12}, // Int. Riesgo
      {wch: 12}, // Cap. Riesgo
      {wch: 12}, // Prem. Riesgo
      {wch: 12}  // Total
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Detallado');

    // -----------------------------------------------------
    // HOJA 2: CONSOLIDADO DIARIO
    // -----------------------------------------------------
    const headersDiario = [
      'Fecha',
      'Interés',
      'Capital',
      'Premio',
      'Int. Riesgo',
      'Cap. Riesgo',
      'Prem. Riesgo',
      'Total'
    ];

    const datosDiario = this.flujoCapitalDiario.map(item => [
      item.fecha,
      item.interes,
      item.capital,
      item.descuento,
      item.interes_moroso,
      item.capital_moroso,
      item.descuento_moroso,
      item.total
    ]);

    if (this.totalesDiario) {
      datosDiario.push([
        this.totalesDiario.fecha,
        this.totalesDiario.interes,
        this.totalesDiario.capital,
        this.totalesDiario.descuento,
        this.totalesDiario.interes_moroso,
        this.totalesDiario.capital_moroso,
        this.totalesDiario.descuento_moroso,
        this.totalesDiario.total
      ]);
    }

    const wsDataDiario = [headersDiario, ...datosDiario];
    const wsDiario = XLSX.utils.aoa_to_sheet(wsDataDiario);

    // Formato de encabezados diario
    const headerRangeD = XLSX.utils.decode_range(wsDiario['!ref'] || 'A1');
    for (let col = headerRangeD.s.c; col <= headerRangeD.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({r: 0, c: col});
      if (wsDiario[cellAddress]) {
        wsDiario[cellAddress].s = {
          font: {bold: true, color: {rgb: "FFFFFFFF"}},
          fill: {fgColor: {rgb: "FF4472C4"}}
        };
      }
    }

    // Formato de totales diario
    if (this.totalesDiario) {
      const totalRow = datosDiario.length;
      for (let col = headerRangeD.s.c; col <= headerRangeD.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({r: totalRow, c: col});
        if (wsDiario[cellAddress]) {
          wsDiario[cellAddress].s = {
            font: {bold: true, color: {rgb: "FFFFFFFF"}},
            fill: {fgColor: {rgb: "FF198754"}}
          };
        }
      }
    }

    wsDiario['!cols'] = [
      {wch: 12}, // Fecha
      {wch: 12}, // Interés
      {wch: 12}, // Capital
      {wch: 12}, // Premio
      {wch: 12}, // Int. Riesgo
      {wch: 12}, // Cap. Riesgo
      {wch: 12}, // Prem. Riesgo
      {wch: 12}  // Total
    ];

    XLSX.utils.book_append_sheet(wb, wsDiario, 'Consolidado Diario');

    const params = {
      fecha_inicio: this.formatDate(this.reporteForm.get('fecha_inicio')?.value),
      fecha_fin: this.formatDate(this.reporteForm.get('fecha_fin')?.value)
    };

    XLSX.writeFile(wb, `flujo-capital-consolidado-${params.fecha_inicio}-${params.fecha_fin}.xlsx`);

    this.messageService.add({
      severity: 'success',
      summary: 'Exportación',
      detail: 'Archivo Excel descargado correctamente'
    });
  }

  exportarPDF(): void {
    const params = {
      fecha_inicio: this.formatDate(this.reporteForm.get('fecha_inicio')?.value),
      fecha_fin: this.formatDate(this.reporteForm.get('fecha_fin')?.value),
      id_grupo_familiar: this.reporteForm.get('id_grupo_familiar')?.value,
      id_propietario: this.reporteForm.get('id_propietario')?.value,
      id_emisor: this.reporteForm.get('id_emisor')?.value
    };

    this.flujoCapitalService.exportarPDF(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.generarPDFFrontend(response.data);
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: response.message || 'No se pudo exportar el archivo PDF'
          });
        }
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

  generarPDFFrontend(datos: any[]): void {
    try {
      // Crear documento PDF en orientación landscape
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Agregar título
      doc.setFontSize(16);
      doc.text('Reporte de Flujo de Capital Consolidado', 148, 15, { align: 'center' });

      // Agregar período
      doc.setFontSize(12);
      const params = {
        fecha_inicio: this.formatDate(this.reporteForm.get('fecha_inicio')?.value),
        fecha_fin: this.formatDate(this.reporteForm.get('fecha_fin')?.value)
      };
      doc.text(`Período: ${params.fecha_inicio} - ${params.fecha_fin}`, 148, 25, { align: 'center' });

      // Preparar datos para la tabla
      const headers = [
        { title: 'Fecha', dataKey: 'fecha' },
        { title: 'Propietario', dataKey: 'propietario' },
        { title: 'Empresa', dataKey: 'empresa' },
        { title: 'Interés', dataKey: 'interes' },
        { title: 'Capital', dataKey: 'capital' },
        { title: 'Premio', dataKey: 'descuento' },
        { title: 'Int. Riesgo', dataKey: 'interes_moroso' },
        { title: 'Cap. Riesgo', dataKey: 'capital_moroso' },
        { title: 'Prem. Riesgo', dataKey: 'descuento_moroso' },
        { title: 'Total', dataKey: 'total' }
      ];

      // Datos de la tabla (excluir el TOTAL del array)
      const datosSinTotal = datos.filter((item: any) => item.empresa !== 'TOTAL');

      // Formatear datos para autoTable
      const tableData = datosSinTotal.map((item: any) => ({
        fecha: item.fecha,
        propietario: item.propietario,
        empresa: item.empresa,
        interes: this.formatCurrency(item.interes),
        capital: this.formatCurrency(item.capital),
        descuento: this.formatCurrency(item.descuento),
        interes_moroso: this.formatCurrency(item.interes_moroso),
        capital_moroso: this.formatCurrency(item.capital_moroso),
        descuento_moroso: this.formatCurrency(item.descuento_moroso),
        total: this.formatCurrency(item.total)
      }));

      // Encontrar fila de totales
      const totales = datos.find((item: any) => item.empresa === 'TOTAL');
      if (totales) {
        tableData.push({
          fecha: totales.fecha,
          propietario: totales.propietario,
          empresa: totales.empresa,
          interes: this.formatCurrency(totales.interes),
          capital: this.formatCurrency(totales.capital),
          descuento: this.formatCurrency(totales.descuento),
          interes_moroso: this.formatCurrency(totales.interes_moroso),
          capital_moroso: this.formatCurrency(totales.capital_moroso),
          descuento_moroso: this.formatCurrency(totales.descuento_moroso),
          total: this.formatCurrency(totales.total)
        });
      }

      // Configurar estilos de la tabla
      const tableStyles = {
        headStyles: {
          fillColor: [59, 130, 246] as any,
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold' as any
        },
        bodyStyles: {
          fontSize: 9,
          textColor: 0
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245] as any
        },
        columnStyles: {
          fecha: { cellWidth: 25, halign: 'center' as any },
          propietario: { cellWidth: 30, halign: 'left' as any },
          empresa: { cellWidth: 40, halign: 'left' as any },
          interes: { cellWidth: 25, halign: 'right' as any },
          capital: { cellWidth: 25, halign: 'right' as any },
          descuento: { cellWidth: 25, halign: 'right' as any },
          interes_moroso: { cellWidth: 25, halign: 'right' as any },
          capital_moroso: { cellWidth: 25, halign: 'right' as any },
          descuento_moroso: { cellWidth: 25, halign: 'right' as any },
          total: { cellWidth: 25, halign: 'right' as any, fontStyle: 'bold' as any }
        },
        margin: { top: 35, left: 15, right: 15, bottom: 20 },
        styles: {
          overflow: 'linebreak' as any,
          cellPadding: 3
        },
        didParseCell: function(data: any) {
          // Resaltar la fila de totales
          if (data.row.index === tableData.length - 1 && totales) {
            data.cell.styles.fillColor = [34, 197, 94] as any;
            data.cell.styles.textColor = 255;
            data.cell.styles.fontStyle = 'bold' as any;
          }
        },
        didDrawCell: function(data: any) {
          // Dibujar bordes para la fila de totales
          if (data.row.index === tableData.length - 1 && totales) {
            doc.setDrawColor(34, 197, 94);
            doc.setLineWidth(0.1);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
          }
        }
      };

      // Generar la primera tabla (Detallado)
      doc.setFontSize(14);
      doc.text('Detalle por Propietario', 14, 35);
      
      autoTable(doc, {
        columns: headers,
        body: tableData,
        ...tableStyles,
        startY: 40
      });

      // -----------------------------------------------------
      // TABLA 2: CONSOLIDADO DIARIO
      // -----------------------------------------------------
      const headersDiario = [
        { title: 'Fecha', dataKey: 'fecha' },
        { title: 'Interés', dataKey: 'interes' },
        { title: 'Capital', dataKey: 'capital' },
        { title: 'Premio', dataKey: 'descuento' },
        { title: 'Int. Riesgo', dataKey: 'interes_moroso' },
        { title: 'Cap. Riesgo', dataKey: 'capital_moroso' },
        { title: 'Prem. Riesgo', dataKey: 'descuento_moroso' },
        { title: 'Total', dataKey: 'total' }
      ];

      const tableDataDiario = this.flujoCapitalDiario.map(item => ({
        fecha: item.fecha,
        interes: this.formatCurrency(item.interes),
        capital: this.formatCurrency(item.capital),
        descuento: this.formatCurrency(item.descuento),
        interes_moroso: this.formatCurrency(item.interes_moroso),
        capital_moroso: this.formatCurrency(item.capital_moroso),
        descuento_moroso: this.formatCurrency(item.descuento_moroso),
        total: this.formatCurrency(item.total)
      }));

      if (this.totalesDiario) {
        tableDataDiario.push({
          fecha: this.totalesDiario.fecha,
          interes: this.formatCurrency(this.totalesDiario.interes),
          capital: this.formatCurrency(this.totalesDiario.capital),
          descuento: this.formatCurrency(this.totalesDiario.descuento),
          interes_moroso: this.formatCurrency(this.totalesDiario.interes_moroso),
          capital_moroso: this.formatCurrency(this.totalesDiario.capital_moroso),
          descuento_moroso: this.formatCurrency(this.totalesDiario.descuento_moroso),
          total: this.formatCurrency(this.totalesDiario.total)
        });
      }

      // Column styles for Diario (fewer columns so wider widths)
      const columnStylesDiario = {
        fecha: { cellWidth: 35, halign: 'center' as any },
        interes: { cellWidth: 30, halign: 'right' as any },
        capital: { cellWidth: 30, halign: 'right' as any },
        descuento: { cellWidth: 30, halign: 'right' as any },
        interes_moroso: { cellWidth: 30, halign: 'right' as any },
        capital_moroso: { cellWidth: 30, halign: 'right' as any },
        descuento_moroso: { cellWidth: 30, halign: 'right' as any },
        total: { cellWidth: 35, halign: 'right' as any, fontStyle: 'bold' as any }
      };

      const finalY1 = (doc as any).lastAutoTable.finalY || 40;
      doc.setFontSize(14);
      doc.text('Consolidado Diario', 14, finalY1 + 15);

      autoTable(doc, {
        columns: headersDiario,
        body: tableDataDiario,
        ...tableStyles,
        columnStyles: columnStylesDiario,
        startY: finalY1 + 20,
        didParseCell: (data: any) => {
          // Resaltar totales diario
          if (data.row.index === tableDataDiario.length - 1 && this.totalesDiario) {
            data.cell.styles.fillColor = [34, 197, 94] as any;
            data.cell.styles.textColor = 255;
            data.cell.styles.fontStyle = 'bold' as any;
          }
        },
        didDrawCell: (data: any) => {
          if (data.row.index === tableDataDiario.length - 1 && this.totalesDiario) {
            doc.setDrawColor(34, 197, 94);
            doc.setLineWidth(0.1);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
          }
        }
      });

      // Agregar pie de página
      const finalY2 = (doc as any).lastAutoTable.finalY || 200;
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(`Generado el ${new Date().toLocaleDateString('es-CO')}`, 148, finalY2 + 10, { align: 'center' });

      // Guardar PDF
      const fileName = `flujo-capital-consolidado-${params.fecha_inicio}-${params.fecha_fin}.pdf`;
      doc.save(fileName);

      this.messageService.add({
        severity: 'success',
        summary: 'Exportación',
        detail: 'Archivo PDF generado y descargado correctamente'
      });

    } catch (error) {
      console.error('Error al generar PDF:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el archivo PDF'
      });
    }
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
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

  // Método para mostrar el detalle de una fila en la pestaña Detallado
  mostrarDetalle(item: FlujoCapitalItem): void {
    this.detalleSeleccionado = item;
    this.loadingDetalle = true;
    this.mostrarModalDetalle = true;

    const params: any = {
      fecha: item.fecha
    };

    if (item.id_propietario) params.id_propietario = item.id_propietario;
    if (item.id_emisor) params.id_emisor = item.id_emisor;

    const idGrupo = this.reporteForm.get('id_grupo_familiar')?.value;
    if (idGrupo) params.id_grupo_familiar = idGrupo;

    this.cargarDetalleBackend(params);
  }

  // Método para mostrar el detalle de una fila en la pestaña Consolidado por Día
  mostrarDetalleDiario(item: FlujoCapitalItem): void {
    this.detalleSeleccionado = {
      ...item,
      propietario: item.propietario && item.propietario !== 'Varios' ? item.propietario : 'Todos (Consolidado por Día)',
      empresa: item.empresa && item.empresa !== 'Varias' ? item.empresa : 'Todas (Consolidado por Día)'
    };
    this.loadingDetalle = true;
    this.mostrarModalDetalle = true;

    const params: any = {
      fecha: item.fecha
    };

    const idGrupo = this.reporteForm.get('id_grupo_familiar')?.value;
    if (idGrupo) params.id_grupo_familiar = idGrupo;

    const idProp = this.reporteForm.get('id_propietario')?.value;
    if (idProp) params.id_propietario = idProp;

    const idEmisor = this.reporteForm.get('id_emisor')?.value;
    if (idEmisor) params.id_emisor = idEmisor;

    this.cargarDetalleBackend(params);
  }

  private cargarDetalleBackend(params: any): void {
    this.lastParams = params;
    this.flujoCapitalService.getDetalleFlujoCapital(params).subscribe({
      next: (response: any) => {
        this.loadingDetalle = false;
        if (response.success) {
          this.detalleItems = response.data || [];
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Advertencia',
            detail: response.message || 'No se pudo obtener el detalle'
          });
        }
      },
      error: (error: any) => {
        this.loadingDetalle = false;
        console.error('Error al obtener detalle:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo conectar con el backend'
        });
      }
    });
  }

  // Método para cerrar el modal de detalle
  cerrarModalDetalle(): void {
    this.mostrarModalDetalle = false;
    this.detalleSeleccionado = null;
    this.detalleItems = [];
  }

  // Método para exportar el detalle a Excel
  exportarDetalle(): void {
    if (this.detalleItems.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No hay datos para exportar'
      });
      return;
    }

    // Generar Excel con los datos del detalle
    const wb = XLSX.utils.book_new();

    // Encabezados para el detalle
    const headers = [
      'INV-AM',
      'Fecha Compra',
      'Propietario',
      'Liquidación',
      'Nombre Instrumento',
      'Cuota',
      'Interés',
      'Capital',
      'Premio',
      'Total'
    ];

    // Datos del detalle
    const datosDetalle = this.detalleItems.map(item => [
      `${item.id_inversion}-${item.id_amortizacion}`,
      item.fecha_compra,
      item.propietario,
      item.liquidacion,
      item.nombre_instrumento,
      item.cuota,
      item.interes,
      item.capital,
      item.premio,
      item.total
    ]);

    // Crear worksheet
    const wsData = [headers, ...datosDetalle];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Formato de encabezados
    const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({r: 0, c: col});
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          font: {bold: true, color: {rgb: "FFFFFFFF"}},
          fill: {fgColor: {rgb: "FF4472C4"}}
        };
      }
    }

    // Ancho de columnas
    ws['!cols'] = [
      {wch: 15}, // INV-AM
      {wch: 12}, // Fecha Compra
      {wch: 12}, // Liquidación
      {wch: 25}, // Nombre Instrumento
      {wch: 10}, // Cuota
      {wch: 12}, // Interés
      {wch: 12}, // Capital
      {wch: 12}, // Premio
      {wch: 12}, // Int. Riesgo
      {wch: 12}, // Cap. Riesgo
      {wch: 12}, // Prem. Riesgo
      {wch: 12}  // Total
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Detalle Flujo Capital');

    // Descargar archivo
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `detalle-flujo-capital-${fecha}.xlsx`);

    this.messageService.add({
      severity: 'success',
      summary: 'Exportación',
      detail: 'Archivo Excel del detalle descargado correctamente'
    });
  }

  // --- Helper methods para cálculo de fechas y días ---
  formatDateOnlyString(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') {
      const match = val.trim().match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }
    if (val instanceof Date) {
      const year = val.getFullYear();
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const day = String(val.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return String(val);
  }

  parseDateToUTC(val: any): number | null {
    if (!val) return null;
    let year: number, month: number, day: number;
    if (val instanceof Date) {
      year = val.getFullYear();
      month = val.getMonth();
      day = val.getDate();
    } else if (typeof val === 'string') {
      const match = val.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10) - 1;
        day = parseInt(match[3], 10);
      } else {
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        year = d.getFullYear();
        month = d.getMonth();
        day = d.getDate();
      }
    } else {
      return null;
    }
    return Date.UTC(year, month, day);
  }

  calculateDaysDifference(startVal: any, endVal: any): number | null {
    const startUtc = this.parseDateToUTC(startVal);
    const endUtc = this.parseDateToUTC(endVal);
    if (startUtc === null || endUtc === null) return null;
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((endUtc - startUtc) / msPerDay);
  }

  // --- Lógica de Edición de Amortización ---
  editarAmortizacion(item: any): void {
    if (!item.id_amortizacion) {
      this.messageService.add({severity: 'error', summary: 'Error', detail: 'ID de amortización no encontrado'});
      return;
    }
    
    this.loadingAmortizacion = true;
    this.displayEditAmortizacionDialog = true;
    this.editingAmortizacionId = item.id_amortizacion;

    // Pre-calcular fechas iniciales desde item para disponibilidad inmediata
    const initialFechaCompra = this.formatDateOnlyString(item.fecha_compra);
    let initialFechaVencimiento = this.formatDateOnlyString(item.fecha_vencimiento);
    if (!initialFechaVencimiento && item.nombre_instrumento) {
      const matches = item.nombre_instrumento.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
      if (matches && matches.length > 0) {
        initialFechaVencimiento = matches[matches.length - 1];
      }
    }
    item.fecha_compra_formateada = initialFechaCompra;
    item.fecha_vencimiento_formateada = initialFechaVencimiento;
    item.dias_compra_vencimiento = this.calculateDaysDifference(initialFechaCompra, initialFechaVencimiento);
    item.dias_transcurridos_hoy = this.calculateDaysDifference(initialFechaCompra, new Date());

    this.selectedAmortizacionDetalle = item;
    this.inversionResumen = null;

    // Load Inversion for summary
    forkJoin({
      inv: this.inversionService.getById(item.id_inversion),
      amortizaciones: this.amortizacionService.getByInversion(item.id_inversion)
    }).subscribe({
      next: ({ inv, amortizaciones }: any) => {
        let valorNominalOriginal = Number(inv.valor_nominal || 0);
        let capitalInvertidoOriginal = Number(inv.capital_invertido || 0);

        let capitalRecibido = 0;
        let interesRecibido = 0;
        let interesEsperado = 0;

        (amortizaciones || []).forEach((a: any) => {
          const cap = Number(a.capital || 0);
          const int = Number(a.interes || 0);
          const pagada = a.id_estado_amortizacion === 135 || a.estado_amortizacion === 'Pagado' || a.pagada_old === 1;
          
          interesEsperado += int;
          
          if (pagada) {
            capitalRecibido += cap;
            interesRecibido += int;
          }
        });

        // Fechas de compra y vencimiento consolidadas
        const rawFechaCompra = inv?.fecha_compra || item.fecha_compra;
        let rawFechaVencimiento = inv?.instrumento?.fecha_vencimiento || item.fecha_vencimiento;
        if (!rawFechaVencimiento && (inv?.instrumento?.nombre || item.nombre_instrumento)) {
          const matches = (inv?.instrumento?.nombre || item.nombre_instrumento).match(/\b(\d{4}-\d{2}-\d{2})\b/g);
          if (matches && matches.length > 0) {
            rawFechaVencimiento = matches[matches.length - 1];
          }
        }

        const fechaCompra = this.formatDateOnlyString(rawFechaCompra) || initialFechaCompra;
        const fechaVencimiento = this.formatDateOnlyString(rawFechaVencimiento) || initialFechaVencimiento;
        const diasCompraVencimiento = this.calculateDaysDifference(fechaCompra, fechaVencimiento);
        const diasTranscurridosHoy = this.calculateDaysDifference(fechaCompra, new Date());

        this.inversionResumen = {
          valorNominalOriginal: valorNominalOriginal,
          valorNominalRecibido: capitalRecibido,
          valorNominalPendiente: Math.max(0, valorNominalOriginal - capitalRecibido),
          capitalInvertidoOriginal: capitalInvertidoOriginal,
          capitalInvertidoRecibido: valorNominalOriginal > 0 ? (capitalRecibido / valorNominalOriginal) * capitalInvertidoOriginal : 0,
          capitalInvertidoPendiente: valorNominalOriginal > 0 ? Math.max(0, capitalInvertidoOriginal - ((capitalRecibido / valorNominalOriginal) * capitalInvertidoOriginal)) : capitalInvertidoOriginal,
          interesTotalEsperado: interesEsperado,
          interesTotalRecibido: interesRecibido,
          interesTotalPendiente: Math.max(0, interesEsperado - interesRecibido),
          fechaCompra: fechaCompra,
          fechaVencimiento: fechaVencimiento,
          diasCompraVencimiento: diasCompraVencimiento,
          diasTranscurridosHoy: diasTranscurridosHoy
        };
      },
      error: (err) => console.error('Error cargando inversión y amortizaciones:', err)
    });
    
    this.amortizacionService.getById(item.id_amortizacion).subscribe({
      next: (data) => {
        this.amortizacionOriginal = data;
        
        let parsedDate = null;
        if (data.fecha_pago) {
          const dateString = data.fecha_pago.toString().substring(0, 10);
          parsedDate = new Date(dateString + 'T00:00:00');
        }

        this.amortizacionForm.patchValue({
          fecha_pago: parsedDate,
          capital: data.capital,
          interes: data.interes,
          descuento: data.descuento
        });
        this.loadingAmortizacion = false;
      },
      error: (err) => {
        this.loadingAmortizacion = false;
        this.displayEditAmortizacionDialog = false;
        console.error('Error cargando amortización:', err);
        this.messageService.add({severity: 'error', summary: 'Error', detail: 'No se pudo cargar la amortización'});
      }
    });
  }

  saveAmortizacion(): void {
    if (this.amortizacionForm.invalid || !this.editingAmortizacionId) return;

    this.loadingAmortizacion = true;
    const formValues = this.amortizacionForm.value;
    const updateData = {
      ...this.amortizacionOriginal,
      fecha_pago: this.formatDate(formValues.fecha_pago),
      capital: formValues.capital,
      interes: formValues.interes,
      descuento: formValues.descuento,
      total: Number(formValues.capital) + Number(formValues.interes) + Number(formValues.descuento)
    };

    this.amortizacionService.update(this.editingAmortizacionId, updateData).subscribe({
      next: () => {
        this.loadingAmortizacion = false;
        this.displayEditAmortizacionDialog = false;
        this.selectedAmortizacionDetalle = null;
        this.inversionResumen = null;
        this.messageService.add({severity: 'success', summary: 'Éxito', detail: 'Amortización actualizada correctamente'});
        
        // Recargar detalle si es posible
        if (this.lastParams) {
          this.cargarDetalleBackend(this.lastParams);
        }
      },
      error: (err) => {
        this.loadingAmortizacion = false;
        console.error('Error actualizando amortización:', err);
        this.messageService.add({severity: 'error', summary: 'Error', detail: 'No se pudo actualizar la amortización'});
      }
    });
  }

  cancelEditAmortizacion(): void {
    this.displayEditAmortizacionDialog = false;
    this.editingAmortizacionId = null;
    this.amortizacionOriginal = null;
    this.selectedAmortizacionDetalle = null;
    this.inversionResumen = null;
    this.amortizacionForm.reset();
  }

  inicializarPagoParcialForm(): void {
    this.pagoParcialForm = this.fb.group({
      fecha_pago_hoy: [new Date(), Validators.required],
      capital_pagado: [0, [Validators.required, Validators.min(0)]],
      interes_pagado: [0, [Validators.required, Validators.min(0)]],
      descuento_pagado: [0, Validators.required],
      fecha_compromiso: [null, Validators.required],
      observacion: ['']
    });

    this.pagoParcialForm.valueChanges.subscribe(() => {
      this.recalcularSaldoRestante();
    });
  }

  getOriginalCapitalCuota(): number {
    return Number(this.amortizacionForm?.get('capital')?.value ?? this.amortizacionOriginal?.capital ?? 0);
  }

  getOriginalInteresCuota(): number {
    return Number(this.amortizacionForm?.get('interes')?.value ?? this.amortizacionOriginal?.interes ?? 0);
  }

  getOriginalDescuentoCuota(): number {
    return Number(this.amortizacionForm?.get('descuento')?.value ?? this.amortizacionOriginal?.descuento ?? 0);
  }

  getOriginalTotalCuota(): number {
    return Number((this.getOriginalCapitalCuota() + this.getOriginalInteresCuota() + this.getOriginalDescuentoCuota()).toFixed(2));
  }

  abrirModalPagoParcial(): void {
    if (!this.amortizacionOriginal && !this.selectedAmortizacionDetalle) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: 'No se encontraron datos de la cuota para dividir'
      });
      return;
    }

    this.pagoParcialForm.patchValue({
      fecha_pago_hoy: new Date(),
      capital_pagado: 0,
      interes_pagado: 0,
      descuento_pagado: 0,
      fecha_compromiso: null,
      observacion: ''
    }, { emitEvent: false });

    this.recalcularSaldoRestante();
    this.displayPagoParcialDialog = true;
  }

  cancelarPagoParcial(): void {
    this.displayPagoParcialDialog = false;
  }

  recalcularSaldoRestante(): void {
    const origCapital = this.getOriginalCapitalCuota();
    const origInteres = this.getOriginalInteresCuota();
    const origDescuento = this.getOriginalDescuentoCuota();

    const pagadoCapital = Number(this.pagoParcialForm?.get('capital_pagado')?.value || 0);
    const pagadoInteres = Number(this.pagoParcialForm?.get('interes_pagado')?.value || 0);
    const pagadoDescuento = Number(this.pagoParcialForm?.get('descuento_pagado')?.value || 0);

    const capRestante = Math.max(0, Number((origCapital - pagadoCapital).toFixed(2)));
    const intRestante = Math.max(0, Number((origInteres - pagadoInteres).toFixed(2)));
    const descRestante = Number((origDescuento - pagadoDescuento).toFixed(2));
    const totRestante = Number((capRestante + intRestante + descRestante).toFixed(2));

    this.saldoRestanteCalculado = {
      capital: capRestante,
      interes: intRestante,
      descuento: descRestante,
      total: totRestante
    };

    this.totalPagadoCalculado = Number((pagadoCapital + pagadoInteres + pagadoDescuento).toFixed(2));
  }

  guardarPagoParcial(): void {
    if (this.pagoParcialForm.invalid || !this.editingAmortizacionId) {
      this.pagoParcialForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario Incompleto',
        detail: 'Por favor complete todos los campos obligatorios, incluyendo la fecha de compromiso'
      });
      return;
    }

    const formVal = this.pagoParcialForm.value;
    const pagadoCapital = Number(formVal.capital_pagado || 0);
    const pagadoInteres = Number(formVal.interes_pagado || 0);
    const pagadoDescuento = Number(formVal.descuento_pagado || 0);
    const totalPagado = Number((pagadoCapital + pagadoInteres + pagadoDescuento).toFixed(2));

    const origCapital = this.getOriginalCapitalCuota();
    const origInteres = this.getOriginalInteresCuota();

    if (totalPagado <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validación',
        detail: 'El total pagado hoy debe ser mayor a cero'
      });
      return;
    }

    if (pagadoCapital > origCapital) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validación',
        detail: `El capital pagado ($${pagadoCapital}) no puede superar el capital de la cuota ($${origCapital})`
      });
      return;
    }

    if (pagadoInteres > origInteres) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validación',
        detail: `El interés pagado ($${pagadoInteres}) no puede superar el interés de la cuota ($${origInteres})`
      });
      return;
    }

    if (!formVal.fecha_compromiso) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validación',
        detail: 'Debe ingresar la fecha en que el emisor se compromete a pagar el saldo restante'
      });
      return;
    }

    const payload = {
      pago_actual: {
        fecha_pago: this.formatDate(formVal.fecha_pago_hoy),
        capital: pagadoCapital,
        interes: pagadoInteres,
        descuento: pagadoDescuento
      },
      saldo_restante: {
        fecha_pago: this.formatDate(formVal.fecha_compromiso),
        capital: this.saldoRestanteCalculado.capital,
        interes: this.saldoRestanteCalculado.interes,
        descuento: this.saldoRestanteCalculado.descuento
      },
      observacion: formVal.observacion ? formVal.observacion.trim() : null
    };

    this.loadingPagoParcial = true;
    this.amortizacionService.registrarPagoParcial(this.editingAmortizacionId, payload).subscribe({
      next: (res) => {
        this.loadingPagoParcial = false;
        this.displayPagoParcialDialog = false;
        this.displayEditAmortizacionDialog = false;
        this.editingAmortizacionId = null;
        this.amortizacionOriginal = null;
        this.selectedAmortizacionDetalle = null;
        this.inversionResumen = null;

        this.messageService.add({
          severity: 'success',
          summary: 'Pago Parcial Registrado',
          detail: res.message || 'La cuota se dividió exitosamente en pagada y pendiente'
        });

        if (this.lastParams) {
          this.cargarDetalleBackend(this.lastParams);
        }
        this.generarReporte();
      },
      error: (err) => {
        this.loadingPagoParcial = false;
        console.error('Error al registrar pago parcial:', err);
        const errorMsg = err.error?.message || err.message || 'Error al procesar el pago parcial';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMsg
        });
      }
    });
  }


  verHistorialPagos(item?: any): void {
    const amortizacionItem = item || this.selectedAmortizacionDetalle;
    if (!amortizacionItem || !amortizacionItem.id_amortizacion) return;

    this.cuotaHistorialSeleccionada = amortizacionItem;
    this.loadingHistorial = true;
    this.displayHistorialDialog = true;
    this.historialPagos = [];

    this.amortizacionService.getHistorialPagos(amortizacionItem.id_amortizacion).subscribe({
      next: (res) => {
        this.loadingHistorial = false;
        this.historialPagos = res.data || [];
      },
      error: (err) => {
        this.loadingHistorial = false;
        console.error('Error cargando historial de pagos:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar el historial de pagos parciales'
        });
      }
    });
  }
}
