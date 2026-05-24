USE sipro_desa;
ALTER TABLE amortizacion
  MODIFY id_amortizacion INT(11) NOT NULL AUTO_INCREMENT,
  ADD KEY idx_amortizacion_inversion (id_inversion),
  ADD KEY idx_amortizacion_fecha_pago (fecha_pago),
  ADD KEY idx_amortizacion_estado (id_estado_amortizacion),
  ADD CONSTRAINT fk_amortizacion_inversion
    FOREIGN KEY (id_inversion) REFERENCES inversion(id_inversion),
  ADD CONSTRAINT fk_amortizacion_estado
    FOREIGN KEY (id_estado_amortizacion) REFERENCES catalogo_valor(id_catalogo_valor);
    
    
ALTER TABLE cuenta_bancaria
  ADD KEY idx_cuenta_bancaria_persona (id_persona),
  ADD KEY idx_cuenta_bancaria_banco (id_banco),
  ADD KEY idx_cuenta_bancaria_tipo_cuenta (id_tipo_cuenta),
  ADD CONSTRAINT fk_cuenta_bancaria_persona
    FOREIGN KEY (id_persona) REFERENCES persona(id_persona),
  ADD CONSTRAINT fk_cuenta_bancaria_banco
    FOREIGN KEY (id_banco) REFERENCES catalogo_valor(id_catalogo_valor),
  ADD CONSTRAINT fk_cuenta_bancaria_tipo_cuenta
    FOREIGN KEY (id_tipo_cuenta) REFERENCES catalogo_valor(id_catalogo_valor);
    
ALTER TABLE inversion
  MODIFY monto_a_negociar DECIMAL(18,2) DEFAULT NULL,
  MODIFY valor_sin_comision DECIMAL(18,2) DEFAULT NULL,
  MODIFY valor_con_interes DECIMAL(18,2) DEFAULT NULL,
  MODIFY interes_acumulado_previo DECIMAL(18,2) DEFAULT NULL,
  MODIFY total_comisiones DECIMAL(18,2) DEFAULT NULL;
  
  
ALTER TABLE movimiento_capital
  MODIFY monto DECIMAL(18,2) DEFAULT NULL,
  MODIFY descripcion VARCHAR(255) DEFAULT NULL;  
  
  
ALTER TABLE venta_inversion
  MODIFY interes_previo_venta DECIMAL(18,2) DEFAULT 0.00,
  MODIFY valor_venta_sin_comision DECIMAL(18,2) DEFAULT 0.00,
  MODIFY comision_operador DECIMAL(18,2) DEFAULT 0.00,
  MODIFY comision_bolsa DECIMAL(18,2) DEFAULT 0.00,
  MODIFY valor_venta_con_comision DECIMAL(18,2) DEFAULT 0.00,
  MODIFY utilidad_sin_comision DECIMAL(18,2) DEFAULT 0.00,
  MODIFY utilidad_con_comision DECIMAL(18,2) DEFAULT 0.00,
  MODIFY ganancia_perdida DECIMAL(18,2) DEFAULT 0.00,
  MODIFY comisiones_santa_fe DECIMAL(18,2) DEFAULT 0.00,
  MODIFY retenciones DECIMAL(18,2) DEFAULT 0.00;  
  
  
ALTER TABLE venta_inversion
  MODIFY precio_venta DECIMAL(18,8) DEFAULT 0.00000000,
  MODIFY precio_neto_venta DECIMAL(18,8) DEFAULT 0.00000000,
  MODIFY rendimiento_total DECIMAL(18,8) DEFAULT 0.00000000,
  MODIFY roi DECIMAL(18,8) DEFAULT 0.00000000,
  MODIFY ganancia_anual DECIMAL(18,8) DEFAULT 0.00000000;
  
  
ALTER TABLE cuenta_bancaria
  MODIFY fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE movimiento_capital
  MODIFY fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE venta_inversion
  MODIFY fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;