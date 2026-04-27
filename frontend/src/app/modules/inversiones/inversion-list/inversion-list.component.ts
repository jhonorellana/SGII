import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule, Table } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { AccordionModule } from 'primeng/accordion';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { InversionService, Inversion } from '../../../core/inversion.service';
import { CatalogoService } from '../../../core/catalogo.service';
import { EmisorService } from '../../../core/emisor.service';
import { InstrumentoService } from '../../../core/instrumento.service';
import { GrupoFamiliarService } from '../../../core/grupo-familiar.service';
import { PersonaService } from '../../../core/persona.service';

@Component({
  selector: 'app-inversion-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    AccordionModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    FormsModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './inversion-list.component.html',
  styleUrls: ['./inversion-list.component.css']
})
export class InversionListComponent implements OnInit, AfterViewInit {
  inversiones: Inversion[] = [];
  inversionesFiltradas: Inversion[] = [];
  gruposFamiliares: any[] = [];
  instrumentos: any[] = [];
  emisores: any[] = [];
  propietarios: any[] = [];
  aportantes: any[] = [];
  estadosInversion: any[] = [];

  fechaCompraFilter: string = '';
  fechaEmisionFilter: string = '';
  fechaVencimientoFilter: string = '';

  displayInstrumentoDialog: boolean = false;
  selectedInstrumento: any = null;
  displayDialog: boolean = false;
  isEdit: boolean = false;

  inversion: Inversion = {
    id_grupo_familiar: 0,
    id_propietario: 0,
    id_estado_inversion: 0,
    fecha_compra: '',
    capital_invertido: 0,
    retencion_fuente: 0,
    expirado: false,
    activo: true
  };

  selectedInversiones: Inversion[] = [];

  @ViewChild('dt') table!: Table;

  cols: any[] = [
    { field: 'id_inversion', header: 'ID' },
    { field: 'propietario.nombres', header: 'Propietario' },
    { field: 'instrumento.emisor.nombre', header: 'Emisor' },
    { field: 'instrumento.tipoInversion.nombre', header: 'Tipo Inversión' },
    { field: 'valor_nominal', header: 'Valor Nominal' },
    { field: 'capital_invertido', header: 'Capital Invertido' },
    { field: 'fecha_compra', header: 'Fecha Compra' },
    { field: 'instrumento.fecha_emision', header: 'Fecha Emision' },
    { field: 'instrumento.fecha_vencimiento', header: 'Fecha Vencimiento' },
    { field: 'estadoInversion.nombre', header: 'Estado' },
    { field: 'activo', header: 'Activo' },
    { field: 'acciones', header: 'Acciones' }
  ];

  constructor(
    private inversionService: InversionService,
    private grupoFamiliarService: GrupoFamiliarService,
    private instrumentoService: InstrumentoService,
    private emisorService: EmisorService,
    private personaService: PersonaService,
    private catalogoService: CatalogoService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadInversiones();
    this.loadGruposFamiliares();
    this.loadInstrumentos();
    this.loadEmisores();
    this.loadPropietarios();
    this.loadAportantes();
    this.loadEstadosInversion();
    this.setFechaActual();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.table) {
        this.table.filter(true, 'activo', 'equals');
      }
    }, 100);
  }

  setFechaActual(): void {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.inversion.fecha_compra = `${year}-${month}-${day}`;
  }

  loadInversiones(): void {
    this.inversionService.getAll().subscribe({
      next: (data) => {
        const rawData = Array.isArray(data) ? data : (data as any).data || [];
        // Transformar fechas a formato YYYY-MM-DD sin hora
        this.inversiones = rawData.map((inv: any) => ({
          ...inv,
          fecha_compra: this.formatDate(inv.fecha_compra),
          instrumento: inv.instrumento ? {
            ...inv.instrumento,
            fecha_emision: this.formatDate(inv.instrumento.fecha_emision),
            fecha_vencimiento: this.formatDate(inv.instrumento.fecha_vencimiento)
          } : inv.instrumento
        }));
        console.log('Datos transformados:', this.inversiones);
        this.inversionesFiltradas = [...this.inversiones];
      },
      error: (error) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar inversiones' });
      }
    });
  }

  loadGruposFamiliares(): void {
    this.grupoFamiliarService.getGruposFamiliares().subscribe({
      next: (data: any) => {
        const gruposArray = Array.isArray(data) ? data : (data as any).data || [];
        this.gruposFamiliares = gruposArray.filter((g: any) => g.activo === true || g.activo === 1);
      },
      error: (error: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar grupos familiares' });
      }
    });
  }

  loadInstrumentos(): void {
    this.instrumentoService.getAll().subscribe({
      next: (data: any) => {
        const instrumentosArray = Array.isArray(data) ? data : (data as any).data || [];
        this.instrumentos = instrumentosArray.filter((i: any) => i.activo === true || i.activo === 1);
      },
      error: (error: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar instrumentos' });
      }
    });
  }

  loadEmisores(): void {
    this.emisorService.getEmisores().subscribe({
      next: (data: any) => {
        const emisoresArray = Array.isArray(data) ? data : (data as any).data || [];
        this.emisores = emisoresArray.filter((e: any) => e.activo === true || e.activo === 1);
      },
      error: (error: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar emisores' });
      }
    });
  }

  loadPropietarios(): void {
    this.personaService.getAll().subscribe({
      next: (data: any) => {
        const personasArray = Array.isArray(data) ? data : (data as any).data || [];
        this.propietarios = personasArray.filter((p: any) => p.activo === true || p.activo === 1);
      },
      error: (error: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar propietarios' });
      }
    });
  }

  loadAportantes(): void {
    this.personaService.getAll().subscribe({
      next: (data: any) => {
        const personasArray = Array.isArray(data) ? data : (data as any).data || [];
        this.aportantes = personasArray.filter((p: any) => p.activo === true || p.activo === 1);
      },
      error: (error: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar aportantes' });
      }
    });
  }

  loadEstadosInversion(): void {
    this.catalogoService.getValoresByCatalogo(4).subscribe({
      next: (data: any) => {
        const estadosArray = Array.isArray(data) ? data : (data as any).data || [];
        this.estadosInversion = estadosArray.filter((e: any) => e.activo === true || e.activo === 1);
      },
      error: (error: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar estados de inversión' });
      }
    });
  }

  openNew(): void {
    this.isEdit = false;
    this.inversion = {
      id_grupo_familiar: 0,
      id_propietario: 0,
      id_estado_inversion: 0,
      fecha_compra: '',
      capital_invertido: 0,
      retencion_fuente: 0,
      expirado: false,
      activo: true
    };
    this.setFechaActual();
    this.displayDialog = true;
  }

  viewInstrumento(inversion: any): void {
    this.selectedInstrumento = inversion.instrumento;
    console.log('Instrumento seleccionado:', this.selectedInstrumento);
    this.displayInstrumentoDialog = true;
  }

  openEdit(inversion: any): void {
    this.isEdit = true;
    this.inversion = { ...inversion };
    // Formatear fechas a YYYY-MM-DD
    if (this.inversion.fecha_compra) {
      this.inversion.fecha_compra = this.formatDate(this.inversion.fecha_compra);
    }
    if (this.inversion.fecha_venta) {
      this.inversion.fecha_venta = this.formatDate(this.inversion.fecha_venta);
    }
    if (this.inversion.fecha_primer_pago) {
      this.inversion.fecha_primer_pago = this.formatDate(this.inversion.fecha_primer_pago);
    }
    this.displayDialog = true;
  }

  // Cálculos automáticos
  onValorNominalChange(): void {
    this.calcularValorSinComision();
    this.calcularInteresMensual();
    this.calcularPrecioNetoCompra();
  }

  onPrecioCompraChange(): void {
    this.calcularValorSinComision();
    this.calcularPrecioNetoCompra();
  }

  onTasaInteresChange(): void {
    this.calcularInteresMensual();
  }

  onComisionesChange(): void {
    this.calcularTotalComisiones();
    this.calcularValorConInteres();
    this.calcularTasaMensualReal();
  }

  onInteresAcumuladoPrevioChange(): void {
    this.calcularInteresPrimerMes();
    this.calcularValorConInteres();
  }

  calcularValorSinComision(): void {
    if (this.inversion.valor_nominal && this.inversion.precio_compra) {
      this.inversion.valor_sin_comision = (this.inversion.valor_nominal * this.inversion.precio_compra) / 100;
    }
  }

  calcularInteresMensual(): void {
    if (this.inversion.valor_nominal && this.inversion.tasa_interes) {
      this.inversion.interes_mensual = (this.inversion.valor_nominal * this.inversion.tasa_interes) / 100 / 12;
    }
  }

  calcularTotalComisiones(): void {
    const comisionBolsa = this.inversion.comision_bolsa || 0;
    const comisionCasa = this.inversion.comision_casa_valores || 0;
    this.inversion.total_comisiones = comisionBolsa + comisionCasa;
  }

  calcularInteresPrimerMes(): void {
    if (this.inversion.interes_mensual && this.inversion.interes_acumulado_previo) {
      this.inversion.interes_primer_mes = this.inversion.interes_mensual - this.inversion.interes_acumulado_previo;
    }
  }

  calcularValorConInteres(): void {
    if (this.inversion.valor_sin_comision && this.inversion.total_comisiones && this.inversion.interes_acumulado_previo) {
      this.inversion.valor_con_interes = this.inversion.valor_sin_comision + this.inversion.total_comisiones + this.inversion.interes_acumulado_previo;
    }
  }

  calcularTasaMensualReal(): void {
    if (this.inversion.interes_mensual && this.inversion.valor_sin_comision && this.inversion.total_comisiones) {
      const montoPagado = this.inversion.valor_sin_comision + this.inversion.total_comisiones;
      if (montoPagado > 0) {
        this.inversion.tasa_mensual_real = (this.inversion.interes_mensual * 12 / montoPagado) * 100;
      }
    }
  }

  calcularPrecioNetoCompra(): void {
    if (this.inversion.valor_sin_comision && this.inversion.total_comisiones && this.inversion.valor_nominal) {
      const montoPagado = this.inversion.valor_sin_comision + this.inversion.total_comisiones;
      this.inversion.precio_neto_compra = (montoPagado / this.inversion.valor_nominal) * 100;
    }
  }

  onInstrumentoChange(): void {
    // Autocompletado para "Nota Credito"
    if (this.inversion.instrumento?.tipoInversion?.nombre === 'Nota Credito') {
      this.inversion.liquidacion = 'SRI 2034-12-31';
      if (this.inversion.instrumento) {
        this.inversion.instrumento.fecha_vencimiento = '2034-12-31';
      }
    }
  }

  onActivoFilterChange(value: string): void {
    if (value === '') {
      this.table.filter('', 'activo', 'equals');
    } else if (value === 'true') {
      this.table.filter(true, 'activo', 'equals');
    } else {
      this.table.filter(false, 'activo', 'equals');
    }
  }

  onFechaFilterChange(field: string, value: string): void {
    console.log('onFechaFilterChange - field:', field, 'value:', value);

    if (!value || value === '') {
      // Limpiar filtro
      this.table.filter('', field, 'equals');
      console.log('Limpiando filtro');
      return;
    }

    // Si el valor tiene 10 caracteres (YYYY-MM-DD completo), usar equals
    // Si tiene menos de 10 caracteres, usar contains
    const useEquals = value.length === 10;
    console.log('useEquals:', useEquals);

    // Usar el sistema de filtros de PrimeNG
    if (useEquals) {
      this.table.filter(value, field, 'equals');
    } else {
      this.table.filter(value, field, 'contains');
    }
  }

  aplicarFiltrosFecha(): void {
    this.inversionesFiltradas = this.inversiones.filter(inv => {
      const fechaCompraOk = !this.fechaCompraFilter || this.formatDate(inv.fecha_compra) === this.fechaCompraFilter;
      const fechaEmisionOk = !this.fechaEmisionFilter || this.formatDate(inv.instrumento?.fecha_emision) === this.fechaEmisionFilter;
      const fechaVencimientoOk = !this.fechaVencimientoFilter || this.formatDate(inv.instrumento?.fecha_vencimiento) === this.fechaVencimientoFilter;
      return fechaCompraOk && fechaEmisionOk && fechaVencimientoOk;
    });
  }

  save(): void {
    if (this.isEdit && this.inversion.id_inversion) {
      this.inversionService.update(this.inversion.id_inversion, this.inversion).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Inversión actualizada' });
          this.displayDialog = false;
          this.loadInversiones();
        },
        error: (error) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar inversión' });
        }
      });
    } else {
      this.inversionService.create(this.inversion).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Inversión creada' });
          this.displayDialog = false;
          this.loadInversiones();
        },
        error: (error) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al crear inversión' });
        }
      });
    }
  }

  delete(inversion: Inversion): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de desactivar la inversión ${inversion.id_inversion}?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        if (inversion.id_inversion) {
          this.inversionService.delete(inversion.id_inversion).subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Inversión desactivada' });
              this.loadInversiones();
            },
            error: (error) => {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al desactivar inversión' });
            }
          });
        }
      }
    });
  }

  formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatNumber(value: number | string | undefined): string {
    if (value === undefined || value === null || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    // Formato manual para asegurar coma como separador de miles
    const parts = numValue.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  exportToExcel(): void {
    const data = this.inversiones.map(i => ({
      'ID': i.id_inversion,
      'Propietario': i.propietario?.nombres || '',
      'Emisor': i.instrumento?.emisor?.nombre || '',
      'Tipo Inversión': i.instrumento?.tipoInversion?.nombre || '',
      'Valor Nominal': i.valor_nominal || '',
      'Capital Invertido': i.capital_invertido,
      'Fecha Compra': this.formatDate(i.fecha_compra),
      'Fecha Emision': this.formatDate(i.instrumento?.fecha_emision),
      'Fecha Vencimiento': this.formatDate(i.instrumento?.fecha_vencimiento),
      'Estado': i.estadoInversion?.nombre || '',
      'Activo': i.activo ? 'Activo' : 'Inactivo'
    }));

    const csv = this.convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'inversiones.csv';
    link.click();
  }

  exportToPDF(): void {
    const data = this.inversiones.map(i => ({
      'ID': i.id_inversion,
      'Propietario': i.propietario?.nombres || '',
      'Emisor': i.instrumento?.emisor?.nombre || '',
      'Tipo Inversión': i.instrumento?.tipoInversion?.nombre || '',
      'Valor Nominal': i.valor_nominal || '',
      'Capital Invertido': i.capital_invertido,
      'Fecha Compra': this.formatDate(i.fecha_compra),
      'Fecha Emision': this.formatDate(i.instrumento?.fecha_emision),
      'Fecha Vencimiento': this.formatDate(i.instrumento?.fecha_vencimiento),
      'Estado': i.estadoInversion?.nombre || '',
      'Activo': i.activo ? 'Activo' : 'Inactivo'
    }));

    let content = '<table style="width:100%; border-collapse: collapse;">';
    content += '<thead><tr style="background-color: #4a8c62; color: white;">';
    Object.keys(data[0] || {}).forEach(key => {
      content += `<th style="border: 1px solid #ddd; padding: 8px;">${key}</th>`;
    });
    content += '</tr></thead><tbody>';

    data.forEach(row => {
      content += '<tr>';
      Object.values(row).forEach(value => {
        content += `<td style="border: 1px solid #ddd; padding: 8px;">${value}</td>`;
      });
      content += '</tr>';
    });
    content += '</tbody></table>';

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head><title>Inversiones</title></head>
        <body>${content}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }

  convertToCSV(data: any[]): string {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');
    return csvContent;
  }
}
