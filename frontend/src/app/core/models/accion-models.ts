export interface AccionOperacion {
  id_accion_operacion?: number;
  id_inversion?: number;
  id_instrumento: number;
  id_persona: number;
  id_tipo_operacion: number;
  id_movimiento_capital?: number;
  fecha_operacion: string;
  liquidacion?: string;
  cantidad: number;
  precio_unitario: number;
  valor_bruto: number;
  comision_bolsa: number;
  comision_operador: number;
  total_comisiones: number;
  valor_neto: number;
  costo_promedio_unitario?: number;
  utilidad_perdida?: number;
  observacion?: string;
  activo: boolean;
  eliminado?: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;

  // Relaciones opcionales
  instrumento?: any;
  persona?: any;
  tipo_operacion?: any;
  tipoOperacion?: any;
  movimiento_capital?: any;
}

export interface AccionDividendo {
  id_accion_dividendo?: number;
  id_persona: number;
  id_instrumento: number;
  id_tipo_dividendo: number;
  fecha_declaracion?: string;
  fecha_corte?: string;
  fecha_pago: string;
  cantidad_acciones_base: number;
  dividendo_por_accion: number;
  valor_bruto: number;
  retencion: number;
  valor_neto: number;
  acciones_recibidas?: number;
  factor_acciones?: number;
  precio_referencial_accion?: number;
  valor_referencial_acciones?: number;
  id_cuenta_bancaria?: number;
  id_movimiento_capital?: number;
  observacion?: string;
  activo: boolean;
  eliminado?: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;

  // Relaciones opcionales
  persona?: any;
  instrumento?: any;
  tipo_dividendo?: any;
  tipoDividendo?: any;
  cuenta_bancaria?: any;
  movimiento_capital?: any;
}

export interface AccionPosicion {
  id_persona: number;
  persona?: string;
  id_instrumento: number;
  instrumento?: string;
  id_emisor?: number;
  fecha_primera_operacion?: string;
  fecha_ultima_operacion?: string;
  cantidad_actual: number;
  precio_ultimo?: number;
  fecha_ultimo_precio?: string;
  valor_mercado?: number;
  costo_promedio_unitario?: number;
  capital_invertido?: number;
  utilidad_perdida_no_realizada?: number;
}
