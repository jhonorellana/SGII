CREATE TABLE `inversion` (
  `id_inversion` int(11) NOT NULL AUTO_INCREMENT,
  `id_grupo_familiar` int(11) NOT NULL,
  `id_instrumento` int(11) DEFAULT NULL,
  `id_propietario` int(11) NOT NULL,
  `id_aportante` int(11) DEFAULT NULL,
  `liquidacion` varchar(15) DEFAULT NULL,
  `id_estado_inversion` int(11) NOT NULL,
  `fecha_compra` date NOT NULL,
  `fecha_venta` date DEFAULT NULL,
  `valor_nominal` decimal(18,2) DEFAULT NULL,
  `monto_a_negociar` decimal(8,2) DEFAULT NULL,
  `capital_invertido` decimal(18,2) NOT NULL,
  `tasa_interes` decimal(18,8) DEFAULT NULL,
  `rendimiento_nominal` decimal(18,8) DEFAULT NULL,
  `rendimiento_efectivo` decimal(18,8) DEFAULT NULL,
  `valor_efectivo` decimal(18,2) DEFAULT NULL,
  `valor_sin_comision` decimal(8,2) DEFAULT NULL,
  `valor_con_interes` decimal(8,2) DEFAULT NULL,
  `interes_acumulado_previo` decimal(8,2) DEFAULT NULL,
  `interes_mensual` decimal(18,2) DEFAULT NULL,
  `interes_primer_mes` decimal(18,2) DEFAULT NULL,
  `total_comisiones` decimal(8,2) DEFAULT NULL,
  `tasa_mensual_real` decimal(8,2) DEFAULT NULL,
  `fecha_primer_pago` date DEFAULT NULL,
  `precio_compra` decimal(18,8) DEFAULT NULL,
  `precio_neto_compra` decimal(18,8) DEFAULT NULL,
  `comision_bolsa` decimal(18,2) DEFAULT NULL,
  `comision_casa_valores` decimal(18,2) DEFAULT NULL,
  `retencion_fuente` decimal(18,2) DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `expirado` tinyint(1) DEFAULT 0,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `eliminado` tinyint(1) NOT NULL DEFAULT 0,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_inversion`),
  KEY `fk_inversion_instrumento` (`id_instrumento`),
  KEY `idx_inversion_grupo_familiar` (`id_grupo_familiar`),
  KEY `idx_inversion_propietario` (`id_propietario`),
  KEY `idx_inversion_aportante` (`id_aportante`),
  KEY `idx_inversion_estado` (`id_estado_inversion`),
  KEY `idx_inversion_fecha_compra` (`fecha_compra`),
  KEY `idx_inversion_fecha_venta` (`fecha_venta`),
  KEY `idx_inversion_fecha_primer_pago` (`fecha_primer_pago`),
  CONSTRAINT `fk_inversion_aportante` FOREIGN KEY (`id_aportante`) REFERENCES `persona` (`id_persona`),
  CONSTRAINT `fk_inversion_estado` FOREIGN KEY (`id_estado_inversion`) REFERENCES `catalogo_valor` (`id_catalogo_valor`),
  CONSTRAINT `fk_inversion_grupo_familiar` FOREIGN KEY (`id_grupo_familiar`) REFERENCES `grupo_familiar` (`id_grupo_familiar`),
  CONSTRAINT `fk_inversion_instrumento` FOREIGN KEY (`id_instrumento`) REFERENCES `instrumento` (`id_instrumento`),
  CONSTRAINT `fk_inversion_propietario` FOREIGN KEY (`id_propietario`) REFERENCES `persona` (`id_persona`)
) ENGINE=InnoDB AUTO_INCREMENT=432 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `amortizacion` (
  `id_amortizacion` int(11) NOT NULL,
  `id_inversion` int(11) NOT NULL,
  `numero_cuota` int(11) DEFAULT NULL,
  `fecha_pago` date NOT NULL,
  `interes` decimal(18,2) DEFAULT NULL,
  `capital` decimal(18,2) DEFAULT NULL,
  `descuento` decimal(18,2) DEFAULT NULL,
  `total` decimal(18,2) DEFAULT NULL,
  `int_parcial` decimal(18,2) DEFAULT NULL,
  `retencion` decimal(18,2) DEFAULT NULL,
  `id_estado_amortizacion` int(11) NOT NULL,
  `pagada` tinyint(1) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `eliminado` tinyint(1) NOT NULL DEFAULT 0,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `instrumento` (
  `id_instrumento` int(11) NOT NULL AUTO_INCREMENT,
  `id_emisor` int(11) NOT NULL,
  `id_tipo_inversion` int(11) NOT NULL,
  `codigo_titulo` varchar(100) DEFAULT NULL,
  `nombre` varchar(200) NOT NULL,
  `fecha_emision` date DEFAULT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `tasa_referencial` decimal(18,8) DEFAULT NULL,
  `fechas_recuperacion` varchar(60) DEFAULT NULL,
  `codigo_titulo_vector` varchar(100) DEFAULT NULL,
  `codigo_seb` varchar(10) DEFAULT NULL,
  `codigo_bce` varchar(50) DEFAULT NULL,
  `calificacion_riesgo` varchar(6) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_instrumento`),
  KEY `idx_instrumento_emisor` (`id_emisor`),
  KEY `idx_instrumento_tipo_inversion` (`id_tipo_inversion`),
  KEY `idx_instrumento_codigo_titulo` (`codigo_titulo`),
  KEY `idx_instrumento_vencimiento` (`fecha_vencimiento`),
  CONSTRAINT `fk_instrumento_emisor` FOREIGN KEY (`id_emisor`) REFERENCES `emisor` (`id_emisor`),
  CONSTRAINT `fk_instrumento_tipo_inversion` FOREIGN KEY (`id_tipo_inversion`) REFERENCES `catalogo_valor` (`id_catalogo_valor`)
) ENGINE=InnoDB AUTO_INCREMENT=227 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `emisor` (
  `id_emisor` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(200) NOT NULL,
  `sigla` varchar(100) DEFAULT NULL,
  `identificacion` varchar(50) DEFAULT NULL,
  `id_tipo_emisor` int(11) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_emisor`),
  UNIQUE KEY `uq_emisor_nombre` (`nombre`),
  KEY `fk_emisor_tipo` (`id_tipo_emisor`),
  KEY `idx_emisor_sigla` (`sigla`),
  CONSTRAINT `fk_emisor_tipo` FOREIGN KEY (`id_tipo_emisor`) REFERENCES `catalogo_valor` (`id_catalogo_valor`)
) ENGINE=InnoDB AUTO_INCREMENT=154 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `persona` (
  `id_persona` int(11) NOT NULL AUTO_INCREMENT,
  `nombres` varchar(150) NOT NULL,
  `apellidos` varchar(150) NOT NULL,
  `identificacion` varchar(50) DEFAULT NULL,
  `correo` varchar(150) DEFAULT NULL,
  `telefono` varchar(50) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_persona`),
  KEY `idx_persona_identificacion` (`identificacion`),
  KEY `idx_persona_apellidos_nombres` (`apellidos`,`nombres`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `grupo_familiar` (
  `id_grupo_familiar` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `id_patriarca` int(11) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_grupo_familiar`),
  UNIQUE KEY `uq_grupo_familiar_nombre` (`nombre`),
  KEY `fk_grupo_familiar_patriarca` (`id_patriarca`),
  CONSTRAINT `fk_grupo_familiar_patriarca` FOREIGN KEY (`id_patriarca`) REFERENCES `persona` (`id_persona`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `grupo_familiar_persona` (
  `id_grupo_familiar_persona` int(11) NOT NULL AUTO_INCREMENT,
  `id_grupo_familiar` int(11) NOT NULL,
  `id_persona` int(11) NOT NULL,
  `id_tipo_relacion` int(11) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_grupo_familiar_persona`),
  UNIQUE KEY `uq_gfp` (`id_grupo_familiar`,`id_persona`,`id_tipo_relacion`),
  KEY `idx_gfp_persona` (`id_persona`),
  KEY `idx_gfp_tipo_relacion` (`id_tipo_relacion`),
  CONSTRAINT `fk_gfp_grupo_familiar` FOREIGN KEY (`id_grupo_familiar`) REFERENCES `grupo_familiar` (`id_grupo_familiar`),
  CONSTRAINT `fk_gfp_persona` FOREIGN KEY (`id_persona`) REFERENCES `persona` (`id_persona`),
  CONSTRAINT `fk_gfp_tipo_relacion` FOREIGN KEY (`id_tipo_relacion`) REFERENCES `catalogo_valor` (`id_catalogo_valor`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
