INSERT INTO catalogo_valor
(id_catalogo, codigo, nombre, descripcion, orden_visual, activo)
VALUES
(16, 'PARTE_VEND', 'PARTE_VENDIDA', 'Inversión generada representa la parte vendida de una inversión original', 1, 1),
(16, 'PARTE_RESTANTE', 'PARTE_REMANENTE', 'Inversión generada representa la parte que continúa activa después de una venta parcial', 2, 1);

CREATE TABLE `inversion_relacion_venta` (
  `id_inversion_relacion_venta` int(11) NOT NULL AUTO_INCREMENT,

  `id_inversion_original` int(11) NOT NULL,
  `id_inversion_generada` int(11) NOT NULL,
  `id_venta_inversion` int(11) DEFAULT NULL,

  `id_tipo_relacion` int(11) NOT NULL,
  -- Ejemplo catálogo:
  -- PARTE_VENDIDA
  -- PARTE_REMANENTE

  `porcentaje_asignado` decimal(8,4) DEFAULT 0.0000,
  `valor_nominal_asignado` decimal(18,2) DEFAULT 0.00,

  `observacion` text DEFAULT NULL,

  `activo` tinyint(4) DEFAULT 1,
  `eliminado` tinyint(4) DEFAULT 0,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),

  PRIMARY KEY (`id_inversion_relacion_venta`),

  KEY `idx_inv_rel_original` (`id_inversion_original`),
  KEY `idx_inv_rel_generada` (`id_inversion_generada`),
  KEY `idx_inv_rel_venta` (`id_venta_inversion`),
  KEY `idx_inv_rel_tipo` (`id_tipo_relacion`),

  CONSTRAINT `fk_inv_rel_original`
    FOREIGN KEY (`id_inversion_original`)
    REFERENCES `inversion` (`id_inversion`),

  CONSTRAINT `fk_inv_rel_generada`
    FOREIGN KEY (`id_inversion_generada`)
    REFERENCES `inversion` (`id_inversion`),

  CONSTRAINT `fk_inv_rel_venta`
    FOREIGN KEY (`id_venta_inversion`)
    REFERENCES `venta_inversion` (`id_venta_inversion`),

  CONSTRAINT `fk_inv_rel_tipo`
    FOREIGN KEY (`id_tipo_relacion`)
    REFERENCES `catalogo_valor` (`id_catalogo_valor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;