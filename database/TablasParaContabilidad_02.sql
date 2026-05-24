-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 21-05-2026 a las 13:31:13
-- Versión del servidor: 10.4.28-MariaDB
-- Versión de PHP: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `sipro_desa`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `catalogo`
--

CREATE TABLE `catalogo` (
  `id_catalogo` int(11) NOT NULL,
  `codigo` varchar(100) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `catalogo`
--

INSERT INTO `catalogo` (`id_catalogo`, `codigo`, `nombre`, `descripcion`, `activo`, `fecha_creacion`, `fecha_actualizacion`) VALUES
(12, 'BANCO', 'Banco', 'Banco para transferencias y depósitos', 1, '2026-04-19 23:52:08', '2026-05-19 19:11:39'),
(13, 'TIPO_CUENTA', 'Tipo de cuenta', 'Tipo de cuenta bancaria', 1, '2026-04-19 23:59:57', '2026-05-20 00:23:25'),
(14, 'TIPO_MOVIMIENTO', 'Tipo de movimiento', 'Tipo de movimiento financiero', 1, '2026-05-20 06:42:42', '2026-05-20 06:49:14'),


-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `catalogo_valor`
--

CREATE TABLE `catalogo_valor` (
  `id_catalogo_valor` int(11) NOT NULL,
  `id_catalogo` int(11) NOT NULL,
  `codigo` varchar(100) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `orden_visual` int(11) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `catalogo_valor`
--
/*
> SELECT id_catalogo_valor, id_catalogo, nombre, orden_visual, activo FROM sipro_desa.catalogo_valor where id_catalogo = 14 order by id_catalogo_valor

+ ---------------------- + ---------------- + ----------- + ----------------- + ----------- +
| id_catalogo_valor      | id_catalogo      | nombre      | orden_visual      | activo      |
+ ---------------------- + ---------------- + ----------- + ----------------- + ----------- +
| 179                    | 14               | Venta Bonos | 1                 | 1           |
| 180                    | 14               | TRANSFERENCIA_CASA_VALORES | 2                 | 1           |
| 181                    | 14               | COMPRA_INVERSION | 3                 | 1           |
| 182                    | 14               | VENTA_INVERSION | 4                 | 1           |
| 183                    | 14               | INTERES_RECIBIDO | 5                 | 1           |
| 184                    | 14               | CAPITAL_RECUPERADO | 6                 | 1           |
| 185                    | 14               | COMISION    | 7                 | 1           |
| 186                    | 14               | RETENCION   | 8                 | 1           |
| 187                    | 14               | AJUSTE_POSITIVO | 9                 | 1           |
| 188                    | 14               | AJUSTE_NEGATIVO | 10                | 1           |
| 189                    | 14               | DEVOLUCION_SALDO | 11                | 1           |
| NULL                   | NULL             | NULL        | NULL              | NULL        |
+ ---------------------- + ---------------- + ----------- + ----------------- + ----------- +
12 rows
-- --------------------------------------------------------

*/
--
-- Estructura de tabla para la tabla `cuenta_bancaria`
--


CREATE TABLE `cuenta_bancaria` (
  `id_cuenta_bancaria` int(11) NOT NULL,
  `id_persona` int(11) NOT NULL,
  `id_banco` int(11) NOT NULL,
  `id_tipo_cuenta` int(11) DEFAULT NULL,
  `numero_cuenta` varchar(20) DEFAULT NULL,
  `activo` tinyint(4) DEFAULT 1,
  `eliminado` tinyint(4) DEFAULT 0,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `cuenta_bancaria`
--

INSERT INTO `cuenta_bancaria` (`id_cuenta_bancaria`, `id_persona`, `id_banco`, `id_tipo_cuenta`, `numero_cuenta`, `activo`, `eliminado`, `fecha_creacion`, `fecha_actualizacion`) VALUES
(1, 1, 175, 177, '105 679 5327', 1, 0, '2026-05-20 05:31:53', '2026-05-20 11:30:38'),
(2, 1, 174, 177, '4093433100', 1, 0, '2026-05-20 05:32:05', '2026-05-20 11:30:10'),
(3, 1, 176, 177, '20002549407', 1, 0, '2026-05-20 05:32:07', '2026-05-20 11:31:09'),
(4, 3, 175, 177, '103 938 0211', 1, 0, '2026-05-20 05:32:08', '2026-05-20 11:31:35'),
(5, 2, 175, 177, '105 682 8691', 1, 0, '2026-05-20 05:32:09', '2026-05-20 11:32:17'),
(6, 1, 176, 177, '8888', 0, 1, '2026-05-20 05:41:16', '2026-05-20 11:32:46');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `movimiento_capital`
--

CREATE TABLE `movimiento_capital` (
  `id_movimiento_capital` int(11) NOT NULL,
  `fecha_movimiento` date NOT NULL,
  `id_tipo_movimiento` int(11) NOT NULL,
  `id_signo` int(11) NOT NULL,
  `monto` decimal(8,2) DEFAULT NULL,
  `id_inversion` int(11) DEFAULT NULL,
  `id_venta_inversion` int(11) DEFAULT NULL,
  `id_cuenta_bancaria` int(11) DEFAULT NULL,
  `descripcion` varchar(100) DEFAULT NULL,
  `conciliado` tinyint(4) DEFAULT 0,
  `fecha_conciliacion` date DEFAULT NULL,
  `activo` tinyint(4) DEFAULT 1,
  `eliminado` tinyint(4) DEFAULT 0,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `venta_inversion`
--

CREATE TABLE `venta_inversion` (
  `id_venta_inversion` int(11) NOT NULL,
  `id_inversion` int(11) NOT NULL,
  `id_instrumento` int(11) DEFAULT NULL,
  `id_tipo_venta` int(11) DEFAULT NULL,
  `porcentaje_vendido` decimal(8,2) DEFAULT 0.00,
  `fecha_venta` date NOT NULL,
  `liquidacion_venta` varchar(50) DEFAULT NULL,
  `precio_venta` decimal(8,8) DEFAULT 0.00000000,
  `precio_neto_venta` decimal(8,8) DEFAULT 0.00000000,
  `interes_previo_venta` decimal(8,2) DEFAULT 0.00,
  `valor_venta_sin_comision` decimal(8,2) DEFAULT 0.00,
  `comision_operador` decimal(8,2) DEFAULT 0.00,
  `comision_bolsa` decimal(8,2) DEFAULT 0.00,
  `valor_venta_con_comision` decimal(8,2) DEFAULT 0.00,
  `utilidad_sin_comision` decimal(8,2) DEFAULT 0.00,
  `utilidad_con_comision` decimal(8,2) DEFAULT 0.00,
  `ganancia_perdida` decimal(8,2) DEFAULT 0.00,
  `rendimiento_total` decimal(8,2) DEFAULT 0.00,
  `dias_transcurridos` decimal(8,2) DEFAULT 0.00,
  `roi` decimal(8,2) DEFAULT 0.00,
  `ganancia_anual` decimal(8,2) DEFAULT 0.00,
  `comisiones_santa_fe` decimal(8,2) DEFAULT 0.00,
  `retenciones` decimal(8,2) DEFAULT 0.00,
  `observacion` text DEFAULT NULL,
  `activo` tinyint(4) DEFAULT 1,
  `eliminado` tinyint(4) DEFAULT 0,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `catalogo`
--
ALTER TABLE `catalogo`
  ADD PRIMARY KEY (`id_catalogo`),
  ADD UNIQUE KEY `uq_catalogo_codigo` (`codigo`),
  ADD UNIQUE KEY `uq_catalogo_nombre` (`nombre`);

--
-- Indices de la tabla `catalogo_valor`
--
ALTER TABLE `catalogo_valor`
  ADD PRIMARY KEY (`id_catalogo_valor`),
  ADD UNIQUE KEY `uq_catalogo_valor` (`id_catalogo`,`codigo`),
  ADD KEY `idx_catalogo_valor_catalogo` (`id_catalogo`),
  ADD KEY `idx_catalogo_valor_nombre` (`nombre`);

--
-- Indices de la tabla `cuenta_bancaria`
--
ALTER TABLE `cuenta_bancaria`
  ADD PRIMARY KEY (`id_cuenta_bancaria`);

--
-- Indices de la tabla `movimiento_capital`
--
ALTER TABLE `movimiento_capital`
  ADD PRIMARY KEY (`id_movimiento_capital`),
  ADD KEY `fk_movimiento_inversion` (`id_inversion`),
  ADD KEY `fk_movimiento_venta` (`id_venta_inversion`),
  ADD KEY `fk_movimiento_cuenta` (`id_cuenta_bancaria`),
  ADD KEY `fk_movimiento_capital_signo` (`id_signo`),
  ADD KEY `fk_movimiento_tipo` (`id_tipo_movimiento`);

--
-- Indices de la tabla `venta_inversion`
--
ALTER TABLE `venta_inversion`
  ADD PRIMARY KEY (`id_venta_inversion`),
  ADD KEY `fk_venta_inversion_inversion` (`id_inversion`),
  ADD KEY `fk_venta_inversion_tipo` (`id_tipo_venta`),
  ADD KEY `fk_venta_inversion_instrumento` (`id_instrumento`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `catalogo`
--
ALTER TABLE `catalogo`
  MODIFY `id_catalogo` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT de la tabla `catalogo_valor`
--
ALTER TABLE `catalogo_valor`
  MODIFY `id_catalogo_valor` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=199;

--
-- AUTO_INCREMENT de la tabla `cuenta_bancaria`
--
ALTER TABLE `cuenta_bancaria`
  MODIFY `id_cuenta_bancaria` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `movimiento_capital`
--
ALTER TABLE `movimiento_capital`
  MODIFY `id_movimiento_capital` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `venta_inversion`
--
ALTER TABLE `venta_inversion`
  MODIFY `id_venta_inversion` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `catalogo_valor`
--
ALTER TABLE `catalogo_valor`
  ADD CONSTRAINT `fk_catalogo_valor_catalogo` FOREIGN KEY (`id_catalogo`) REFERENCES `catalogo` (`id_catalogo`);

--
-- Filtros para la tabla `movimiento_capital`
--
ALTER TABLE `movimiento_capital`
  ADD CONSTRAINT `fk_movimiento_capital_signo` FOREIGN KEY (`id_signo`) REFERENCES `catalogo_valor` (`id_catalogo_valor`),
  ADD CONSTRAINT `fk_movimiento_cuenta` FOREIGN KEY (`id_cuenta_bancaria`) REFERENCES `cuenta_bancaria` (`id_cuenta_bancaria`),
  ADD CONSTRAINT `fk_movimiento_inversion` FOREIGN KEY (`id_inversion`) REFERENCES `inversion` (`id_inversion`),
  ADD CONSTRAINT `fk_movimiento_tipo` FOREIGN KEY (`id_tipo_movimiento`) REFERENCES `catalogo_valor` (`id_catalogo_valor`),
  ADD CONSTRAINT `fk_movimiento_venta` FOREIGN KEY (`id_venta_inversion`) REFERENCES `venta_inversion` (`id_venta_inversion`);

--
-- Filtros para la tabla `venta_inversion`
--
ALTER TABLE `venta_inversion`
  ADD CONSTRAINT `fk_venta_inversion_instrumento` FOREIGN KEY (`id_instrumento`) REFERENCES `instrumento` (`id_instrumento`),
  ADD CONSTRAINT `fk_venta_inversion_inversion` FOREIGN KEY (`id_inversion`) REFERENCES `inversion` (`id_inversion`),
  ADD CONSTRAINT `fk_venta_inversion_tipo` FOREIGN KEY (`id_tipo_venta`) REFERENCES `catalogo_valor` (`id_catalogo_valor`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;


CREATE TABLE venta_inversion_detalle (
  id_venta_inversion_detalle INT NOT NULL AUTO_INCREMENT,
  id_venta_inversion INT NOT NULL,
  id_inversion INT NOT NULL,

  valor_nominal DECIMAL(18,2) NOT NULL,
  valor_compra DECIMAL(18,2) NOT NULL,
  porcentaje_compra DECIMAL(18,8) DEFAULT NULL,

  valor_venta_asignado DECIMAL(18,2) NOT NULL,
  porcentaje_venta DECIMAL(18,8) DEFAULT NULL,

  utilidad DECIMAL(18,2) DEFAULT 0.00,
  rendimiento DECIMAL(18,8) DEFAULT 0.00000000,

  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id_venta_inversion_detalle),

  KEY idx_venta_detalle_venta (id_venta_inversion),
  KEY idx_venta_detalle_inversion (id_inversion),

  CONSTRAINT fk_venta_detalle_venta
    FOREIGN KEY (id_venta_inversion)
    REFERENCES venta_inversion(id_venta_inversion),

  CONSTRAINT fk_venta_detalle_inversion
    FOREIGN KEY (id_inversion)
    REFERENCES inversion(id_inversion)
);