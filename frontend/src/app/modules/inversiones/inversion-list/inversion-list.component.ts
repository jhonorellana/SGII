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
import { ActivatedRoute } from '@angular/router';
import { InversionService, Inversion } from '../../../core/inversion.service';
import { AmortizacionService } from '../../../core/amortizacion.service';
import { CatalogoService } from '../../../core/catalogo.service';
import { EmisorService } from '../../../core/emisor.service';
import { InstrumentoService } from '../../../core/instrumento.service';
import { GrupoFamiliarService } from '../../../core/grupo-familiar.service';
import { PersonaService } from '../../../core/persona.service';
import { ModalActionsComponent } from '../../../core/modal-actions';
import { PaginationService } from '../../../core/pagination.service';
import { CalendarModule } from 'primeng/calendar';

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
    FormsModule,
    CalendarModule,
    ModalActionsComponent
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './inversion-list.component.html',
  styleUrls: ['./inversion-list.component.css']
})
export class InversionListComponent implements OnInit, AfterViewInit {
  @ViewChild('dt') dt: any;
  inversiones: Inversion[] = [];
  inversionesFiltradas: Inversion[] = [];
  gruposFamiliares: any[] = [];
  instrumentos: any[] = [];
  emisores: any[] = [];
  propietarios: any[] = [];
  aportantes: any[] = [];
  estadosInversion: any[] = [];
  totalRecords: number = 0;

  fechaCompraFilter: string = '';
  fechaEmisionFilter: string = '';
  fechaVencimientoFilter: string = '';
  rowsPerPage: number = 10;

  displayInstrumentoDialog: boolean = false;
  selectedInstrumento: any = null;
  displayDialog: boolean = false;
  isEdit: boolean = false;

  // Propiedades para modal de venta
  displayVentaDialog: boolean = false;
  selectedInversion: any = null;
  fechaVenta: string = '';

  // Propiedades para modal de amortización
  displayAmortizacionDialog: boolean = false;
  amortizaciones: any[] = [];
  loading: boolean = true;
  loadingAmortizacion: boolean = false;

  inversion: Inversion = {
    id_grupo_familiar: 0,
    id_propietario: 0,
    id_estado_inversion: 0,
    fecha_compra: '',
    capital_invertido: 0,
    retencion_fuente: 0,
    expirado: false,
    activo: true,
    liquidacion: ''
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

  // KPIs
  get inversionesParaKPI(): Inversion[] {
    if (this.dt && this.dt.filteredValue) {
      return this.dt.filteredValue;
    }
    return this.inversiones;
  }

  get totalInversionesKPI(): number {
    return this.inversionesParaKPI.length;
  }

  get valorNominalTotalKPI(): number {
    return this.inversionesParaKPI.reduce((sum, inv) => sum + Number((inv as any).valor_nominal || 0), 0);
  }

  get capitalInvertidoTotalKPI(): number {
    return this.inversionesParaKPI.reduce((sum, inv) => sum + Number(inv.capital_invertido || 0), 0);
  }

  constructor(
    private inversionService: InversionService,
    private amortizacionService: AmortizacionService,
    private grupoFamiliarService: GrupoFamiliarService,
    private instrumentoService: InstrumentoService,
    private emisorService: EmisorService,
    private personaService: PersonaService,
    private catalogoService: CatalogoService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private route: ActivatedRoute,
    private paginationService: PaginationService
  ) {}

  ngOnInit(): void {
    this.rowsPerPage = this.paginationService.getRowsPerPage('inversiones', 10);
    this.loadInversiones();
    this.loadGruposFamiliares();
    this.loadInstrumentos();
    this.loadEmisores();
    this.loadPropietarios();
    this.loadAportantes();
    this.loadEstadosInversion();
    this.setFechaActual();

    // Verificar si se debe abrir el modal de creación
    this.route.queryParams.subscribe(params => {
      if (params['create'] === 'true') {
        setTimeout(() => this.openNew(), 500);
      }
    });
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
    this.loading = true;
    this.inversionService.getAll().subscribe({
      next: (data) => {
        const rawData = Array.isArray(data) ? data : (data as any).data || [];
        // Transformar fechas a formato YYYY-MM-DD sin hora
        this.inversiones = rawData
          .filter((inv: any) => inv.instrumento?.id_tipo_inversion !== 203)
          .map((inv: any) => ({
          ...inv,
          fecha_compra: this.formatDate(inv.fecha_compra),
          instrumento: inv.instrumento ? {
            ...inv.instrumento,
            fecha_emision: this.formatDate(inv.instrumento.fecha_emision),
            fecha_vencimiento: this.formatDate(inv.instrumento.fecha_vencimiento)
          } : inv.instrumento
        }));
        this.inversionesFiltradas = [...this.inversiones];
        this.totalRecords = this.inversiones.length;
        this.loading = false;
      },
      error: (error) => {
        this.inversiones = [];
        this.inversionesFiltradas = [];
        this.totalRecords = 0;
        this.loading = false;
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
        this.propietarios = personasArray
          .filter((p: any) => p.activo === true || p.activo === 1)
          .map((p: any) => ({
            ...p,
            nombre: `${p.nombres} ${p.apellidos}`.trim()
          }));
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
        this.aportantes = personasArray
          .filter((p: any) => p.activo === true || p.activo === 1)
          .map((p: any) => ({
            ...p,
            nombre: `${p.nombres} ${p.apellidos}`.trim()
          }));
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
      activo: true,
      liquidacion: ''
    };
    this.setFechaActual();
    this.displayDialog = true;
  }

  viewInstrumento(inversion: any): void {
    this.selectedInstrumento = inversion.instrumento;
    this.displayInstrumentoDialog = true;
  }

  viewAmortizacion(inversion: any): void {
    this.selectedInversion = inversion;
    this.loadingAmortizacion = true;
    this.displayAmortizacionDialog = true;
    this.amortizaciones = [];

    this.amortizacionService.getByInversion(inversion.id_inversion).subscribe({
      next: (data) => {
        this.loadingAmortizacion = false;
        this.amortizaciones = data;
      },
      error: (error) => {
        this.loadingAmortizacion = false;
        console.error('Error al cargar amortizaciones:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar la tabla de amortización'
        });
      }
    });
  }

  openVentaModal(inversion: any): void {
    this.selectedInversion = inversion;
    this.fechaVenta = this.getFechaActual();
    this.displayVentaDialog = true;
  }

  getFechaActual(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  dateToString(date: Date): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  registrarVenta(): void {
    if (!this.selectedInversion || !this.fechaVenta) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Por favor seleccione la fecha de venta'
      });
      return;
    }

    // Convertir fecha de p-calendar a string YYYY-MM-DD si es necesario
    let fechaString = '';
    if (typeof this.fechaVenta === 'string') {
      fechaString = this.fechaVenta;
    } else if (this.fechaVenta && typeof this.fechaVenta === 'object' && 'getFullYear' in this.fechaVenta) {
      fechaString = this.dateToString(this.fechaVenta as Date);
    } else {
      fechaString = String(this.fechaVenta);
    }

    // Validar que tengamos una fecha válida
    if (!fechaString) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Fecha inválida',
        detail: 'Por favor seleccione una fecha válida'
      });
      return;
    }

    // Mostrar diálogo de confirmación
    this.confirmationService.confirm({
      message: `¿Está seguro de registrar la venta total del bono ${this.selectedInversion.id_inversion} con fecha ${fechaString}?`,
      header: 'Confirmar Registro de Venta',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.procesarVenta(fechaString);
      }
    });
  }

  procesarVenta(fechaVenta: string): void {
    // 1. Actualizar el registro de la inversión
    const inversionActualizada = {
      ...this.selectedInversion,
      activo: false,
      fecha_venta: fechaVenta,
      id_estado_inversion: 130 // VENDIDA_TOTAL
    };

    // Llamar al servicio para actualizar la inversión
    this.inversionService.update(this.selectedInversion.id_inversion, inversionActualizada).subscribe({
      next: (response) => {
        // 2. Actualizar los registros en amortizacion
        this.actualizarAmortizaciones(fechaVenta);
      },
      error: (error) => {
        console.error('Error al actualizar inversión:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al actualizar la inversión'
        });
      }
    });
  }

  actualizarAmortizaciones(fechaVenta: string): void {
    // Llamar al servicio de amortizaciones para desactivar registros
    this.amortizacionService.desactivarPorFechaInversion(this.selectedInversion.id_inversion, fechaVenta).subscribe({
      next: (response) => {
        this.mostrarExitoVenta();
      },
      error: (error) => {
        console.error('Error al actualizar amortizaciones:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al actualizar las amortizaciones'
        });
      }
    });
  }

  mostrarExitoVenta(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Venta Registrada',
      detail: `La venta del bono ${this.selectedInversion.id_inversion} ha sido registrada exitosamente`
    });

    // Cerrar el modal
    this.displayVentaDialog = false;

    // Recargar la lista de inversiones
    this.loadInversiones();
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
    this.recalcularTodos();
  }

  onPrecioCompraChange(): void {
    this.recalcularTodos();
  }

  onTasaInteresChange(): void {
    this.recalcularTodos();
  }

  onValorEfectivoChange(): void {
    this.recalcularTodos();
  }

  onComisionesChange(): void {
    this.recalcularTodos();
  }

  onInteresAcumuladoPrevioChange(): void {
    this.recalcularTodos();
  }

  recalcularTodos(): void {
    this.calcularValorSinComision();
    this.calcularInteresMensual();
    this.calcularTotalComisiones();
    this.calcularCapitalInvertido();
    this.calcularInteresPrimerMes();
    this.calcularValorConInteres();
    this.calcularTasaMensualReal();
    this.calcularPrecioNetoCompra();
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

  calcularCapitalInvertido(): void {
    const valorEfectivo = this.inversion.valor_efectivo || 0;
    const totalComisiones = this.inversion.total_comisiones || 0;
    this.inversion.capital_invertido = valorEfectivo + totalComisiones;
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
    } else {
      this.inversion.precio_neto_compra = 0;
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
    if (!value || value === '') {
      // Limpiar filtro
      this.table.filter('', field, 'equals');
      return;
    }

    // Si el valor tiene 10 caracteres (YYYY-MM-DD completo), usar equals
    // Si tiene menos de 10 caracteres, usar contains
    const useEquals = value.length === 10;

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
          console.error('Error al actualizar inversión:', error);
          const errorMessage = error.error?.message || error.error?.errors?.join(', ') || 'Error al actualizar inversión';
          this.messageService.add({ severity: 'error', summary: 'Error', detail: errorMessage });
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
          console.error('Error al crear inversión:', error);
          const errorMessage = error.error?.message || error.error?.errors?.join(', ') || 'Error al crear inversión';
          this.messageService.add({ severity: 'error', summary: 'Error', detail: errorMessage });
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

  onPageChange(event: any): void {
    this.rowsPerPage = event.rows;
    this.paginationService.setRowsPerPage('inversiones', this.rowsPerPage);
    // Actualizar totalRecords cuando cambia la página
    if (this.dt && this.dt.filteredValue) {
      this.totalRecords = this.dt.filteredValue.length;
    } else {
      this.totalRecords = this.inversiones.length;
    }
  }

  onFilter(event: any): void {
    // Actualizar totalRecords cuando se filtra la tabla
    if (event.filteredValue) {
      this.totalRecords = event.filteredValue.length;
    } else {
      this.totalRecords = this.inversiones.length;
    }
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
