-- =========================================================
-- Nombre corto: SIPRO
-- Nombre completo:
-- SIPRO – Sistema de Inversiones y Patrimonio
-- Descripción:
-- Sistema integral para la administración, control y análisis de inversiones y patrimonio familiar, incluyendo gestión de instrumentos financieros, amortizaciones, flujos de capital, consolidación patrimonial y análisis histórico.

-- Esquema base MySQL 8.x
-- =========================================================

CREATE DATABASE IF NOT EXISTS sipro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sipro;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================
-- 1. SEGURIDAD Y ACCESO
-- =========================================================

CREATE TABLE rol (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_rol_nombre UNIQUE (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE persona (
    id_persona INT AUTO_INCREMENT PRIMARY KEY,
    nombres VARCHAR(150) NOT NULL,
    apellidos VARCHAR(150) NOT NULL,
    identificacion VARCHAR(50) NULL,
    correo VARCHAR(150) NULL,
    telefono VARCHAR(50) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_persona_identificacion (identificacion),
    INDEX idx_persona_apellidos_nombres (apellidos, nombres)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_rol INT NOT NULL,
    id_persona INT NOT NULL,
    nombre_usuario VARCHAR(100) NOT NULL,
    clave_hash VARCHAR(255) NOT NULL,
    correo VARCHAR(150) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    ultimo_acceso DATETIME NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_usuario_nombre_usuario UNIQUE (nombre_usuario),
    CONSTRAINT uq_usuario_id_persona UNIQUE (id_persona),
    CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES rol(id_rol),
    CONSTRAINT fk_usuario_persona FOREIGN KEY (id_persona) REFERENCES persona(id_persona),
    INDEX idx_usuario_rol (id_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 2. CATÁLOGOS
-- =========================================================

CREATE TABLE catalogo (
    id_catalogo INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(100) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion VARCHAR(255) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_catalogo_codigo UNIQUE (codigo),
    CONSTRAINT uq_catalogo_nombre UNIQUE (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE catalogo_valor (
    id_catalogo_valor INT AUTO_INCREMENT PRIMARY KEY,
    id_catalogo INT NOT NULL,
    codigo VARCHAR(100) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion VARCHAR(255) NULL,
    orden_visual INT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_catalogo_valor_catalogo FOREIGN KEY (id_catalogo) REFERENCES catalogo(id_catalogo),
    CONSTRAINT uq_catalogo_valor UNIQUE (id_catalogo, codigo),
    INDEX idx_catalogo_valor_catalogo (id_catalogo),
    INDEX idx_catalogo_valor_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 3. ESTRUCTURA FAMILIAR
-- =========================================================

CREATE TABLE grupo_familiar (
    id_grupo_familiar INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion VARCHAR(255) NULL,
    id_patriarca INT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_grupo_familiar_nombre UNIQUE (nombre),
    CONSTRAINT fk_grupo_familiar_patriarca FOREIGN KEY (id_patriarca) REFERENCES persona(id_persona)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grupo_familiar_persona (
    id_grupo_familiar_persona INT AUTO_INCREMENT PRIMARY KEY,
    id_grupo_familiar INT NOT NULL,
    id_persona INT NOT NULL,
    id_tipo_relacion INT NOT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_gfp_grupo_familiar FOREIGN KEY (id_grupo_familiar) REFERENCES grupo_familiar(id_grupo_familiar),
    CONSTRAINT fk_gfp_persona FOREIGN KEY (id_persona) REFERENCES persona(id_persona),
    CONSTRAINT fk_gfp_tipo_relacion FOREIGN KEY (id_tipo_relacion) REFERENCES catalogo_valor(id_catalogo_valor),
    CONSTRAINT uq_gfp UNIQUE (id_grupo_familiar, id_persona, id_tipo_relacion),
    INDEX idx_gfp_persona (id_persona),
    INDEX idx_gfp_tipo_relacion (id_tipo_relacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 4. MAESTROS DE NEGOCIO
-- =========================================================

CREATE TABLE emisor (
    id_emisor INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    sigla VARCHAR(100) NULL,
    identificacion VARCHAR(50) NULL,
    id_tipo_emisor INT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_emisor_tipo FOREIGN KEY (id_tipo_emisor) REFERENCES catalogo_valor(id_catalogo_valor),
    CONSTRAINT uq_emisor_nombre UNIQUE (nombre),
    INDEX idx_emisor_sigla (sigla)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE instrumento (
    id_instrumento INT AUTO_INCREMENT PRIMARY KEY,
    id_emisor INT NOT NULL,
    id_tipo_inversion INT NOT NULL,
    codigo_titulo VARCHAR(100) NULL,
    nombre VARCHAR(200) NOT NULL,
    fecha_emision DATE NULL,
    fecha_vencimiento DATE NULL,
    tasa_referencial DECIMAL(18,8) NULL,
    rendimiento_nominal DECIMAL(18,8) NULL,
    codigo_seb varchar(10) DEFAULT NULL,
    codigo_bce varchar(10) DEFAULT NULL,
    fechas_recuperacion varchar(60) DEFAULT NULL,
    vector_precio varchar(45) DEFAULT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_instrumento_emisor FOREIGN KEY (id_emisor) REFERENCES emisor(id_emisor),
    CONSTRAINT fk_instrumento_tipo_inversion FOREIGN KEY (id_tipo_inversion) REFERENCES catalogo_valor(id_catalogo_valor),
    INDEX idx_instrumento_emisor (id_emisor),
    INDEX idx_instrumento_tipo_inversion (id_tipo_inversion),
    INDEX idx_instrumento_codigo_titulo (codigo_titulo),
    INDEX idx_instrumento_vencimiento (fecha_vencimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 5. NÚCLEO DEL PORTAFOLIO
-- =========================================================

CREATE TABLE inversion (
    id_inversion INT AUTO_INCREMENT PRIMARY KEY,
    id_grupo_familiar INT NOT NULL,
    id_instrumento INT NULL,
    id_emisor INT NOT NULL,
    id_tipo_inversion INT NOT NULL,
    id_propietario INT NOT NULL,
    id_aportante INT NULL,
    id_estado_inversion INT NOT NULL,
    fecha_compra DATE NOT NULL,
    fecha_emision DATE NULL,
    fecha_vencimiento DATE NULL,
    fecha_venta DATE NULL,
    valor_nominal DECIMAL(18,2) NULL,
    capital_invertido DECIMAL(18,2) NOT NULL,
    tasa_interes DECIMAL(18,8) NULL,
    rendimiento_nominal DECIMAL(18,8) NULL,
    rendimiento_efectivo DECIMAL(18,8) NULL,
    valor_efectivo DECIMAL(18,2) NULL,
    interes_mensual DECIMAL(18,2) NULL,
    interes_primer_mes DECIMAL(18,2) NULL,
    fecha_primer_pago DATE NULL,
    precio_compra DECIMAL(18,8) NULL,
    precio_neto_compra DECIMAL(18,8) NULL,
    comision_bolsa DECIMAL(18,2) NULL,
    comision_casa_valores DECIMAL(18,2) NULL,
    retencion_fuente DECIMAL(18,2) NULL,
    codigo_seb VARCHAR(100) NULL,
    codigo_bce VARCHAR(100) NULL,
    observacion TEXT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    eliminado TINYINT(1) NOT NULL DEFAULT 0,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_inversion_grupo_familiar FOREIGN KEY (id_grupo_familiar) REFERENCES grupo_familiar(id_grupo_familiar),
    CONSTRAINT fk_inversion_instrumento FOREIGN KEY (id_instrumento) REFERENCES instrumento(id_instrumento),
    CONSTRAINT fk_inversion_emisor FOREIGN KEY (id_emisor) REFERENCES emisor(id_emisor),
    CONSTRAINT fk_inversion_tipo_inversion FOREIGN KEY (id_tipo_inversion) REFERENCES catalogo_valor(id_catalogo_valor),
    CONSTRAINT fk_inversion_propietario FOREIGN KEY (id_propietario) REFERENCES persona(id_persona),
    CONSTRAINT fk_inversion_aportante FOREIGN KEY (id_aportante) REFERENCES persona(id_persona),
    CONSTRAINT fk_inversion_estado FOREIGN KEY (id_estado_inversion) REFERENCES catalogo_valor(id_catalogo_valor),
    INDEX idx_inversion_grupo_familiar (id_grupo_familiar),
    INDEX idx_inversion_tipo_inversion (id_tipo_inversion),
    INDEX idx_inversion_propietario (id_propietario),
    INDEX idx_inversion_aportante (id_aportante),
    INDEX idx_inversion_estado (id_estado_inversion),
    INDEX idx_inversion_emisor (id_emisor),
    INDEX idx_inversion_fecha_vencimiento (fecha_vencimiento),
    INDEX idx_inversion_fecha_compra (fecha_compra)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE amortizacion (
    id_amortizacion INT AUTO_INCREMENT PRIMARY KEY,
    id_inversion INT NOT NULL,
    numero_cuota INT NULL,
    fecha_pago DATE NOT NULL,
    interes DECIMAL(18,2) NULL,
    capital DECIMAL(18,2) NULL,
    descuento DECIMAL(18,2) NULL,
    total DECIMAL(18,2) NULL,
    retencion DECIMAL(18,2) NULL,
    id_estado_amortizacion INT NOT NULL,
    pagada TINYINT(1) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    eliminado TINYINT(1) NOT NULL DEFAULT 0,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_amortizacion_inversion FOREIGN KEY (id_inversion) REFERENCES inversion(id_inversion),
    CONSTRAINT fk_amortizacion_estado FOREIGN KEY (id_estado_amortizacion) REFERENCES catalogo_valor(id_catalogo_valor),
    INDEX idx_amortizacion_inversion (id_inversion),
    INDEX idx_amortizacion_fecha_pago (fecha_pago),
    INDEX idx_amortizacion_estado (id_estado_amortizacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE venta_inversion (
    id_venta_inversion INT AUTO_INCREMENT PRIMARY KEY,
    id_inversion INT NOT NULL,
    id_tipo_venta INT NOT NULL,
    fecha_venta DATE NOT NULL,
    porcentaje_vendido DECIMAL(10,4) NULL,
    valor_nominal_vendido DECIMAL(18,2) NULL,
    valor_efectivo_vendido DECIMAL(18,2) NULL,
    precio_venta DECIMAL(18,8) NULL,
    observacion TEXT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_venta_inversion_inversion FOREIGN KEY (id_inversion) REFERENCES inversion(id_inversion),
    CONSTRAINT fk_venta_inversion_tipo FOREIGN KEY (id_tipo_venta) REFERENCES catalogo_valor(id_catalogo_valor),
    INDEX idx_venta_inversion_inversion (id_inversion),
    INDEX idx_venta_inversion_fecha (fecha_venta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE documento_inversion (
    id_documento_inversion INT AUTO_INCREMENT PRIMARY KEY,
    id_inversion INT NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    id_tipo_documento INT NULL,
    observacion TEXT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_documento_inversion_inversion FOREIGN KEY (id_inversion) REFERENCES inversion(id_inversion),
    CONSTRAINT fk_documento_inversion_tipo FOREIGN KEY (id_tipo_documento) REFERENCES catalogo_valor(id_catalogo_valor),
    INDEX idx_documento_inversion_inversion (id_inversion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE otro_valor (
    id_otro_valor INT AUTO_INCREMENT PRIMARY KEY,
    id_grupo_familiar INT NOT NULL,
    id_propietario INT NULL,
    id_tipo_otro_valor INT NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    valor DECIMAL(18,2) NOT NULL,
    fecha_desde DATE NULL,
    fecha_hasta DATE NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    eliminado TINYINT(1) NOT NULL DEFAULT 0,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_otro_valor_grupo_familiar FOREIGN KEY (id_grupo_familiar) REFERENCES grupo_familiar(id_grupo_familiar),
    CONSTRAINT fk_otro_valor_propietario FOREIGN KEY (id_propietario) REFERENCES persona(id_persona),
    CONSTRAINT fk_otro_valor_tipo FOREIGN KEY (id_tipo_otro_valor) REFERENCES catalogo_valor(id_catalogo_valor),
    INDEX idx_otro_valor_grupo_familiar (id_grupo_familiar),
    INDEX idx_otro_valor_propietario (id_propietario),
    INDEX idx_otro_valor_tipo (id_tipo_otro_valor),
    INDEX idx_otro_valor_fechas (fecha_desde, fecha_hasta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 6. SNAPSHOTS Y TABLAS DERIVADAS
-- =========================================================

CREATE TABLE consolidado_inversion (
    id_consolidado_inversion BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha_corte DATE NOT NULL,
    id_grupo_familiar INT NOT NULL,
    id_propietario INT NOT NULL,
    id_tipo_inversion INT NOT NULL,
    id_emisor INT NOT NULL,
    fecha_vencimiento DATE NULL,
    tasa DECIMAL(18,8) NULL,
    rendimiento DECIMAL(18,8) NULL,
    capital DECIMAL(18,2) NOT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_consolidado_inversion_grupo FOREIGN KEY (id_grupo_familiar) REFERENCES grupo_familiar(id_grupo_familiar),
    CONSTRAINT fk_consolidado_inversion_propietario FOREIGN KEY (id_propietario) REFERENCES persona(id_persona),
    CONSTRAINT fk_consolidado_inversion_tipo FOREIGN KEY (id_tipo_inversion) REFERENCES catalogo_valor(id_catalogo_valor),
    CONSTRAINT fk_consolidado_inversion_emisor FOREIGN KEY (id_emisor) REFERENCES emisor(id_emisor),
    INDEX idx_consolidado_inversion_corte (fecha_corte),
    INDEX idx_consolidado_inversion_principal (fecha_corte, id_propietario, id_tipo_inversion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE variacion_capital (
    id_variacion_capital BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha_corte DATE NOT NULL,
    id_grupo_familiar INT NOT NULL,
    capital_total DECIMAL(18,2) NOT NULL,
    capital_propio DECIMAL(18,2) NULL,
    observacion VARCHAR(255) NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_variacion_capital_grupo FOREIGN KEY (id_grupo_familiar) REFERENCES grupo_familiar(id_grupo_familiar),
    CONSTRAINT uq_variacion_capital UNIQUE (fecha_corte, id_grupo_familiar),
    INDEX idx_variacion_capital_corte (fecha_corte)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE variacion_capital_detalle (
    id_variacion_capital_detalle BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_variacion_capital BIGINT NOT NULL,
    id_persona INT NOT NULL,
    capital_persona DECIMAL(18,2) NOT NULL,
    id_tipo_participacion INT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_variacion_detalle_variacion FOREIGN KEY (id_variacion_capital) REFERENCES variacion_capital(id_variacion_capital),
    CONSTRAINT fk_variacion_detalle_persona FOREIGN KEY (id_persona) REFERENCES persona(id_persona),
    CONSTRAINT fk_variacion_detalle_tipo_participacion FOREIGN KEY (id_tipo_participacion) REFERENCES catalogo_valor(id_catalogo_valor),
    CONSTRAINT uq_variacion_detalle UNIQUE (id_variacion_capital, id_persona),
    INDEX idx_variacion_detalle_persona (id_persona)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE acciones_ultimas_transacciones (
    id_accion_ultima_transaccion BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha_corte DATE NOT NULL,
    emisor VARCHAR(200) NOT NULL,
    fecha_ultima_transaccion DATE NULL,
    precio_maximo DECIMAL(18,8) NULL,
    precio_minimo DECIMAL(18,8) NULL,
    precio_promedio DECIMAL(18,8) NULL,
    numero_transacciones INT NULL,
    numero_acciones DECIMAL(18,2) NULL,
    valor_efectivo DECIMAL(18,2) NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_acciones_ultimas_transacciones_corte (fecha_corte),
    INDEX idx_acciones_ultimas_transacciones_emisor (emisor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 7. HISTÓRICOS DE MERCADO
-- NOTA: estas tablas deben ajustarse a la estructura exacta de la
-- fuente externa cuando se complete el mapeo definitivo.
-- =========================================================

CREATE TABLE acciones_his (
    id_accion_his BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    emisor VARCHAR(200) NOT NULL,
    nominal DECIMAL(18,2) NULL,
    precio DECIMAL(18,8) NULL,
    cantidad DECIMAL(18,2) NULL,
    efectivo DECIMAL(18,2) NULL,
    procedencia VARCHAR(100) NULL,
    archivo_origen VARCHAR(255) NULL,
    fecha_carga DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_acciones_his_fecha (fecha),
    INDEX idx_acciones_his_emisor (emisor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bonos_his (
    id_bono_his BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    decreto VARCHAR(100) NULL,
    emisor VARCHAR(200) NULL,
    precio_porcentaje DECIMAL(18,8) NULL,
    rendimiento DECIMAL(18,8) NULL,
    dias_vencimiento INT NULL,
    anios_vencimiento DECIMAL(18,4) NULL,
    tasa DECIMAL(18,8) NULL,
    valor_nominal DECIMAL(18,2) NULL,
    valor_efectivo DECIMAL(18,2) NULL,
    fecha_emision DATE NULL,
    fecha_vencimiento DATE NULL,
    tipo VARCHAR(100) NULL,
    mercado VARCHAR(100) NULL,
    archivo_origen VARCHAR(255) NULL,
    fecha_carga DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bonos_his_fecha (fecha),
    INDEX idx_bonos_his_emisor (emisor),
    INDEX idx_bonos_his_vencimiento (fecha_vencimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE obligaciones_his (
    id_obligacion_his BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    emisor VARCHAR(200) NULL,
    serie VARCHAR(100) NULL,
    rendimiento DECIMAL(18,8) NULL,
    tasa DECIMAL(18,8) NULL,
    dias_vencimiento INT NULL,
    valor_nominal DECIMAL(18,2) NULL,
    valor_efectivo DECIMAL(18,2) NULL,
    fecha_emision DATE NULL,
    fecha_vencimiento DATE NULL,
    mercado VARCHAR(100) NULL,
    archivo_origen VARCHAR(255) NULL,
    fecha_carga DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_obligaciones_his_fecha (fecha),
    INDEX idx_obligaciones_his_emisor (emisor),
    INDEX idx_obligaciones_his_vencimiento (fecha_vencimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE papeles_comerciales_his (
    id_papel_comercial_his BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    emisor VARCHAR(200) NULL,
    serie VARCHAR(100) NULL,
    descuento DECIMAL(18,8) NULL,
    tasa DECIMAL(18,8) NULL,
    valor_nominal DECIMAL(18,2) NULL,
    valor_efectivo DECIMAL(18,2) NULL,
    fecha_emision DATE NULL,
    fecha_vencimiento DATE NULL,
    archivo_origen VARCHAR(255) NULL,
    fecha_carga DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_papeles_his_fecha (fecha),
    INDEX idx_papeles_his_emisor (emisor),
    INDEX idx_papeles_his_vencimiento (fecha_vencimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE facturas_comerciales_his (
    id_factura_comercial_his BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    emisor VARCHAR(200) NULL,
    aceptante VARCHAR(200) NULL,
    precio DECIMAL(18,8) NULL,
    rendimiento DECIMAL(18,8) NULL,
    valor_nominal DECIMAL(18,2) NULL,
    valor_efectivo DECIMAL(18,2) NULL,
    fecha_emision DATE NULL,
    fecha_vencimiento DATE NULL,
    archivo_origen VARCHAR(255) NULL,
    fecha_carga DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_facturas_his_fecha (fecha),
    INDEX idx_facturas_his_emisor (emisor),
    INDEX idx_facturas_his_aceptante (aceptante),
    INDEX idx_facturas_his_vencimiento (fecha_vencimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE valores_genericos_his (
    id_valor_generico_his BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    emisor VARCHAR(200) NULL,
    titulo VARCHAR(200) NULL,
    tasa DECIMAL(18,8) NULL,
    rendimiento DECIMAL(18,8) NULL,
    valor_nominal DECIMAL(18,2) NULL,
    valor_efectivo DECIMAL(18,2) NULL,
    fecha_emision DATE NULL,
    fecha_vencimiento DATE NULL,
    archivo_origen VARCHAR(255) NULL,
    fecha_carga DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_genericos_his_fecha (fecha),
    INDEX idx_genericos_his_emisor (emisor),
    INDEX idx_genericos_his_vencimiento (fecha_vencimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE titularizaciones_his (
    id_titularizacion_his BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    emisor VARCHAR(200) NULL,
    serie VARCHAR(100) NULL,
    tasa DECIMAL(18,8) NULL,
    rendimiento DECIMAL(18,8) NULL,
    valor_nominal DECIMAL(18,2) NULL,
    valor_efectivo DECIMAL(18,2) NULL,
    fecha_emision DATE NULL,
    fecha_vencimiento DATE NULL,
    archivo_origen VARCHAR(255) NULL,
    fecha_carga DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_titularizaciones_his_fecha (fecha),
    INDEX idx_titularizaciones_his_emisor (emisor),
    INDEX idx_titularizaciones_his_vencimiento (fecha_vencimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dividendos_his (
    id_dividendo_his BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    emisor VARCHAR(200) NULL,
    periodo VARCHAR(100) NULL,
    valor_dividendo DECIMAL(18,8) NULL,
    observacion VARCHAR(255) NULL,
    archivo_origen VARCHAR(255) NULL,
    fecha_carga DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dividendos_his_fecha (fecha),
    INDEX idx_dividendos_his_emisor (emisor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rendimientos_his (
    id_rendimiento_his BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    emisor VARCHAR(200) NULL,
    instrumento VARCHAR(200) NULL,
    rendimiento DECIMAL(18,8) NULL,
    observacion VARCHAR(255) NULL,
    archivo_origen VARCHAR(255) NULL,
    fecha_carga DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rendimientos_his_fecha (fecha),
    INDEX idx_rendimientos_his_emisor (emisor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================
-- 8. DATOS BASE RECOMENDADOS PARA CATÁLOGOS
-- =========================================================

INSERT INTO rol (nombre, descripcion) VALUES
('Administrador', 'Acceso completo al sistema'),
('Patriarca', 'Administra las inversiones del grupo familiar'),
('Integrante familiar', 'Consulta información según permisos');

INSERT INTO catalogo (codigo, nombre, descripcion) VALUES
('TIPO_INVERSION', 'Tipo de inversión', 'Clasifica el tipo de inversión'),
('ESTADO_INVERSION', 'Estado de inversión', 'Estados posibles de una inversión'),
('ESTADO_AMORTIZACION', 'Estado de amortización', 'Estados posibles de una amortización'),
('TIPO_RELACION_FAMILIAR', 'Tipo de relación familiar', 'Relación entre persona y grupo familiar'),
('TIPO_OTRO_VALOR', 'Tipo de otro valor', 'Clasificación de otros activos y pasivos'),
('TIPO_VENTA', 'Tipo de venta', 'Clasificación de venta de inversiones'),
('TIPO_DOCUMENTO', 'Tipo de documento', 'Tipos de documentos adjuntos'),
('TIPO_EMISOR', 'Tipo de emisor', 'Clasificación de emisores'),
('TIPO_PARTICIPACION', 'Tipo de participación', 'Participación en snapshots de variación');

-- TIPO_INVERSION
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'BONO', 'Bono', 1 FROM catalogo WHERE codigo = 'TIPO_INVERSION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'OBLIGACION', 'Obligación', 2 FROM catalogo WHERE codigo = 'TIPO_INVERSION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'PAPEL_COMERCIAL', 'Papel comercial', 3 FROM catalogo WHERE codigo = 'TIPO_INVERSION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'FACTURA_COMERCIAL', 'Factura comercial', 4 FROM catalogo WHERE codigo = 'TIPO_INVERSION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'TITULARIZACION', 'Titularización', 5 FROM catalogo WHERE codigo = 'TIPO_INVERSION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'ACCION', 'Acción', 6 FROM catalogo WHERE codigo = 'TIPO_INVERSION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'VALOR_GENERICO', 'Valor genérico', 7 FROM catalogo WHERE codigo = 'TIPO_INVERSION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'OTRA_INVERSION', 'Otra inversión', 8 FROM catalogo WHERE codigo = 'TIPO_INVERSION';

-- ESTADO_INVERSION
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'ACTIVA', 'Activa', 1 FROM catalogo WHERE codigo = 'ESTADO_INVERSION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'VENDIDA_PARCIAL', 'Vendida parcialmente', 2 FROM catalogo WHERE codigo = 'ESTADO_INVERSION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'VENDIDA_TOTAL', 'Vendida totalmente', 3 FROM catalogo WHERE codigo = 'ESTADO_INVERSION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'VENCIDA', 'Vencida', 4 FROM catalogo WHERE codigo = 'ESTADO_INVERSION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'CANCELADA', 'Cancelada', 5 FROM catalogo WHERE codigo = 'ESTADO_INVERSION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'EN_RIESGO', 'En riesgo', 6 FROM catalogo WHERE codigo = 'ESTADO_INVERSION';

-- ESTADO_AMORTIZACION
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'PENDIENTE', 'Pendiente', 1 FROM catalogo WHERE codigo = 'ESTADO_AMORTIZACION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'PAGADA', 'Pagada', 2 FROM catalogo WHERE codigo = 'ESTADO_AMORTIZACION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'MOROSA', 'Morosa', 3 FROM catalogo WHERE codigo = 'ESTADO_AMORTIZACION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'ANULADA', 'Anulada', 4 FROM catalogo WHERE codigo = 'ESTADO_AMORTIZACION';

-- TIPO_RELACION_FAMILIAR
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'PATRIARCA', 'Patriarca', 1 FROM catalogo WHERE codigo = 'TIPO_RELACION_FAMILIAR';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'INTEGRANTE', 'Integrante', 2 FROM catalogo WHERE codigo = 'TIPO_RELACION_FAMILIAR';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'APORTANTE', 'Aportante', 3 FROM catalogo WHERE codigo = 'TIPO_RELACION_FAMILIAR';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'BENEFICIARIO', 'Beneficiario', 4 FROM catalogo WHERE codigo = 'TIPO_RELACION_FAMILIAR';

-- TIPO_OTRO_VALOR
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'CUENTA_BANCARIA', 'Cuenta bancaria', 1 FROM catalogo WHERE codigo = 'TIPO_OTRO_VALOR';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'DEUDA', 'Deuda', 2 FROM catalogo WHERE codigo = 'TIPO_OTRO_VALOR';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'CASA_VALORES', 'Saldo en casa de valores', 3 FROM catalogo WHERE codigo = 'TIPO_OTRO_VALOR';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'OTRO_ACTIVO', 'Otro activo', 4 FROM catalogo WHERE codigo = 'TIPO_OTRO_VALOR';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'OTRO_PASIVO', 'Otro pasivo', 5 FROM catalogo WHERE codigo = 'TIPO_OTRO_VALOR';

-- TIPO_VENTA
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'PARCIAL', 'Parcial', 1 FROM catalogo WHERE codigo = 'TIPO_VENTA';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'TOTAL', 'Total', 2 FROM catalogo WHERE codigo = 'TIPO_VENTA';

-- TIPO_DOCUMENTO
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'LIQUIDACION', 'Liquidación', 1 FROM catalogo WHERE codigo = 'TIPO_DOCUMENTO';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'AMORTIZACION', 'Tabla de amortización', 2 FROM catalogo WHERE codigo = 'TIPO_DOCUMENTO';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'COMPROBANTE', 'Comprobante', 3 FROM catalogo WHERE codigo = 'TIPO_DOCUMENTO';

-- TIPO_PARTICIPACION
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'PROPIO', 'Propio', 1 FROM catalogo WHERE codigo = 'TIPO_PARTICIPACION';
INSERT INTO catalogo_valor (id_catalogo, codigo, nombre, orden_visual)
SELECT id_catalogo, 'TERCERO', 'Tercero', 2 FROM catalogo WHERE codigo = 'TIPO_PARTICIPACION';

