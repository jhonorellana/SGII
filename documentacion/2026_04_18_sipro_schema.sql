-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 19-04-2026 a las 02:25:49
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
CREATE DATABASE IF NOT EXISTS `sipro_desa` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `sipro_desa`;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `acciones_his`
--

DROP TABLE IF EXISTS `acciones_his`;
CREATE TABLE `acciones_his` (
  `id_accion_his` int(11) NOT NULL,
  `id_emisor` int(11) DEFAULT NULL,
  `fecha` date NOT NULL,
  `emisor` varchar(50) NOT NULL,
  `accion_tipo` varchar(50) NOT NULL,
  `nominal` float NOT NULL,
  `precio` float NOT NULL,
  `cantidad` int(11) NOT NULL,
  `efectivo` float NOT NULL,
  `procedencia` char(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='Contiene el listado de acciones que se han negociado en la bolsa de valores desde enero de 2017 hasta la fecha';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `acciones_ultimas_transacciones`
--

DROP TABLE IF EXISTS `acciones_ultimas_transacciones`;
CREATE TABLE `acciones_ultimas_transacciones` (
  `id_accion_ultima_transaccion` bigint(20) NOT NULL,
  `fecha_corte` date NOT NULL,
  `emisor` varchar(200) NOT NULL,
  `fecha_ultima_transaccion` date DEFAULT NULL,
  `precio_maximo` decimal(18,8) DEFAULT NULL,
  `precio_minimo` decimal(18,8) DEFAULT NULL,
  `precio_promedio` decimal(18,8) DEFAULT NULL,
  `numero_transacciones` int(11) DEFAULT NULL,
  `numero_acciones` decimal(18,2) DEFAULT NULL,
  `valor_efectivo` decimal(18,2) DEFAULT NULL,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `amortizacion`
--

DROP TABLE IF EXISTS `amortizacion`;
CREATE TABLE `amortizacion` (
  `id_amortizacion` int(11) NOT NULL,
  `id_inversion` int(11) NOT NULL,
  `numero_cuota` int(11) DEFAULT NULL,
  `fecha_pago` date NOT NULL,
  `interes` decimal(18,2) DEFAULT NULL,
  `capital` decimal(18,2) DEFAULT NULL,
  `descuento` decimal(18,2) DEFAULT NULL,
  `total` decimal(18,2) DEFAULT NULL,
  `retencion` decimal(18,2) DEFAULT NULL,
  `id_estado_amortizacion` int(11) NOT NULL,
  `pagada` tinyint(1) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `eliminado` tinyint(1) NOT NULL DEFAULT 0,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `bonos_his`
--

DROP TABLE IF EXISTS `bonos_his`;
CREATE TABLE `bonos_his` (
  `id_bono_his` int(11) NOT NULL,
  `fecha` date DEFAULT NULL,
  `decreto` text DEFAULT NULL,
  `precio_porcentaje` double DEFAULT NULL,
  `rendimiento` double DEFAULT NULL,
  `dias_vencimiento` double DEFAULT NULL,
  `tasa` double DEFAULT NULL,
  `valor_nominal` double DEFAULT NULL,
  `valor_efectivo` double DEFAULT NULL,
  `fecha_emision` datetime DEFAULT NULL,
  `fecha_vencimiento` datetime DEFAULT NULL,
  `procedencia` text DEFAULT NULL,
  `tipo` text DEFAULT NULL,
  `tipo_mercado` double DEFAULT NULL,
  `tipo_mercado_1` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Esta tabla almacena la información historica de los bonos transaccionados en la bolsa de valores desde enero del año 2018 hasta la fecha actual';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `catalogo`
--

DROP TABLE IF EXISTS `catalogo`;
CREATE TABLE `catalogo` (
  `id_catalogo` int(11) NOT NULL,
  `codigo` varchar(100) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `catalogo_valor`
--

DROP TABLE IF EXISTS `catalogo_valor`;
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

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `consolidado_inversion`
--

DROP TABLE IF EXISTS `consolidado_inversion`;
CREATE TABLE `consolidado_inversion` (
  `id_consolidado_inversion` bigint(20) NOT NULL,
  `fecha_corte` date NOT NULL,
  `id_grupo_familiar` int(11) NOT NULL,
  `id_propietario` int(11) NOT NULL,
  `id_tipo_inversion` int(11) NOT NULL,
  `id_emisor` int(11) NOT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `tasa` decimal(18,8) DEFAULT NULL,
  `rendimiento` decimal(18,8) DEFAULT NULL,
  `capital` decimal(18,2) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `dividendos_his`
--

DROP TABLE IF EXISTS `dividendos_his`;
CREATE TABLE `dividendos_his` (
  `id_dividendo_his` bigint(20) NOT NULL,
  `fecha` date NOT NULL,
  `emisor` varchar(200) DEFAULT NULL,
  `periodo` varchar(100) DEFAULT NULL,
  `valor_dividendo` decimal(18,8) DEFAULT NULL,
  `observacion` varchar(255) DEFAULT NULL,
  `archivo_origen` varchar(255) DEFAULT NULL,
  `fecha_carga` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `documento_inversion`
--

DROP TABLE IF EXISTS `documento_inversion`;
CREATE TABLE `documento_inversion` (
  `id_documento_inversion` int(11) NOT NULL,
  `id_inversion` int(11) NOT NULL,
  `nombre_archivo` varchar(255) NOT NULL,
  `ruta_archivo` varchar(500) NOT NULL,
  `id_tipo_documento` int(11) DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `emisor`
--

DROP TABLE IF EXISTS `emisor`;
CREATE TABLE `emisor` (
  `id_emisor` int(11) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `sigla` varchar(100) DEFAULT NULL,
  `identificacion` varchar(50) DEFAULT NULL,
  `id_tipo_emisor` int(11) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `facturas_comerciales_his`
--

DROP TABLE IF EXISTS `facturas_comerciales_his`;
CREATE TABLE `facturas_comerciales_his` (
  `id_factura_comercial_his` int(11) NOT NULL,
  `fecha` date DEFAULT NULL,
  `emisor` varchar(60) DEFAULT NULL,
  `precio` double DEFAULT NULL,
  `valor_nominal` decimal(10,2) DEFAULT NULL,
  `valor_efectivo` decimal(10,2) DEFAULT NULL,
  `fecha_emision` date DEFAULT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `rendimiento` decimal(10,4) DEFAULT NULL,
  `procedencia` varchar(4) DEFAULT NULL,
  `observaciones` varchar(150) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci COMMENT='Contiene el listado de facturas comerciales que se han negociado en la bolsa de valores desde enero de 2018 hasta la fecha';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `grupo_familiar`
--

DROP TABLE IF EXISTS `grupo_familiar`;
CREATE TABLE `grupo_familiar` (
  `id_grupo_familiar` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `id_patriarca` int(11) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `grupo_familiar_persona`
--

DROP TABLE IF EXISTS `grupo_familiar_persona`;
CREATE TABLE `grupo_familiar_persona` (
  `id_grupo_familiar_persona` int(11) NOT NULL,
  `id_grupo_familiar` int(11) NOT NULL,
  `id_persona` int(11) NOT NULL,
  `id_tipo_relacion` int(11) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `instrumento`
--

DROP TABLE IF EXISTS `instrumento`;
CREATE TABLE `instrumento` (
  `id_instrumento` int(11) NOT NULL,
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
  `codigo_bce` varchar(10) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `inversion`
--

DROP TABLE IF EXISTS `inversion`;
CREATE TABLE `inversion` (
  `id_inversion` int(11) NOT NULL,
  `id_grupo_familiar` int(11) NOT NULL,
  `id_instrumento` int(11) DEFAULT NULL,
  `id_emisor` int(11) NOT NULL,
  `id_tipo_inversion` int(11) NOT NULL,
  `id_propietario` int(11) NOT NULL,
  `id_aportante` int(11) DEFAULT NULL,
  `id_estado_inversion` int(11) NOT NULL,
  `fecha_compra` date NOT NULL,
  `fecha_emision` date DEFAULT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `fecha_venta` date DEFAULT NULL,
  `valor_nominal` decimal(18,2) DEFAULT NULL,
  `capital_invertido` decimal(18,2) NOT NULL,
  `tasa_interes` decimal(18,8) DEFAULT NULL,
  `rendimiento_nominal` decimal(18,8) DEFAULT NULL,
  `rendimiento_efectivo` decimal(18,8) DEFAULT NULL,
  `valor_efectivo` decimal(18,2) DEFAULT NULL,
  `interes_mensual` decimal(18,2) DEFAULT NULL,
  `interes_primer_mes` decimal(18,2) DEFAULT NULL,
  `fecha_primer_pago` date DEFAULT NULL,
  `precio_compra` decimal(18,8) DEFAULT NULL,
  `precio_neto_compra` decimal(18,8) DEFAULT NULL,
  `comision_bolsa` decimal(18,2) DEFAULT NULL,
  `comision_casa_valores` decimal(18,2) DEFAULT NULL,
  `retencion_fuente` decimal(18,2) DEFAULT NULL,
  `codigo_seb` varchar(100) DEFAULT NULL,
  `codigo_bce` varchar(100) DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `eliminado` tinyint(1) NOT NULL DEFAULT 0,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `obligaciones_his`
--

DROP TABLE IF EXISTS `obligaciones_his`;
CREATE TABLE `obligaciones_his` (
  `id_obligacion_his` int(11) NOT NULL,
  `fecha` date DEFAULT NULL,
  `emisor` varchar(60) DEFAULT NULL,
  `precio` double DEFAULT NULL,
  `rendimiento` double DEFAULT NULL,
  `plazo_dias` int(11) DEFAULT NULL,
  `interes` decimal(8,6) DEFAULT NULL,
  `valor_nominal` decimal(12,2) DEFAULT NULL,
  `valor_efectivo` decimal(12,2) DEFAULT NULL,
  `emision` date DEFAULT NULL,
  `vencimiento` date DEFAULT NULL,
  `procedencia` text DEFAULT NULL,
  `tipo_mercado` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci COMMENT='Contiene el listado de obligaciones que se han negociado en la bolsa de valores desde enero de 2018 hasta la fecha';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `otro_valor`
--

DROP TABLE IF EXISTS `otro_valor`;
CREATE TABLE `otro_valor` (
  `id_otro_valor` int(11) NOT NULL,
  `id_grupo_familiar` int(11) NOT NULL,
  `id_propietario` int(11) DEFAULT NULL,
  `id_tipo_otro_valor` int(11) NOT NULL,
  `descripcion` varchar(255) NOT NULL,
  `valor` decimal(18,2) NOT NULL,
  `fecha_desde` date DEFAULT NULL,
  `fecha_hasta` date DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `eliminado` tinyint(1) NOT NULL DEFAULT 0,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `papeles_comerciales_his`
--

DROP TABLE IF EXISTS `papeles_comerciales_his`;
CREATE TABLE `papeles_comerciales_his` (
  `id_papel_comercial_his` int(11) NOT NULL,
  `fecha` text DEFAULT NULL,
  `emisor` varchar(60) DEFAULT NULL,
  `precio` double DEFAULT NULL,
  `rendimiento` decimal(8,6) DEFAULT NULL,
  `plazo_dias` int(11) DEFAULT NULL,
  `descuento` double DEFAULT NULL,
  `interes` decimal(8,2) DEFAULT NULL,
  `valor_nominal` decimal(12,2) DEFAULT NULL,
  `valor_efectivo` decimal(12,2) DEFAULT NULL,
  `emision` date DEFAULT NULL,
  `vencimiento` date DEFAULT NULL,
  `procedencia` varchar(4) DEFAULT NULL,
  `mercado` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci COMMENT='Contiene el listado de papeles comerciales que se han negociado en la bolsa de valores desde enero de 2018 hasta la fecha';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `persona`
--

DROP TABLE IF EXISTS `persona`;
CREATE TABLE `persona` (
  `id_persona` int(11) NOT NULL,
  `nombres` varchar(150) NOT NULL,
  `apellidos` varchar(150) NOT NULL,
  `identificacion` varchar(50) DEFAULT NULL,
  `correo` varchar(150) DEFAULT NULL,
  `telefono` varchar(50) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `rendimientos_his`
--

DROP TABLE IF EXISTS `rendimientos_his`;
CREATE TABLE `rendimientos_his` (
  `id_rendimiento_his` bigint(20) NOT NULL,
  `fecha` date NOT NULL,
  `emisor` varchar(200) DEFAULT NULL,
  `instrumento` varchar(200) DEFAULT NULL,
  `rendimiento` decimal(18,8) DEFAULT NULL,
  `observacion` varchar(255) DEFAULT NULL,
  `archivo_origen` varchar(255) DEFAULT NULL,
  `fecha_carga` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `rol`
--

DROP TABLE IF EXISTS `rol`;
CREATE TABLE `rol` (
  `id_rol` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `titularizaciones_his`
--

DROP TABLE IF EXISTS `titularizaciones_his`;
CREATE TABLE `titularizaciones_his` (
  `id_titularizacion_his` int(11) NOT NULL,
  `fecha` date DEFAULT NULL,
  `emisor` varchar(60) DEFAULT NULL,
  `precio` double DEFAULT NULL,
  `rendimiento` decimal(8,4) DEFAULT NULL,
  `plazo_dias` int(11) DEFAULT NULL,
  `interes` decimal(8,4) DEFAULT NULL,
  `valor_nominal` decimal(10,2) DEFAULT NULL,
  `emision` date DEFAULT NULL,
  `valor_efectivo` decimal(10,2) DEFAULT NULL,
  `vencimiento` date DEFAULT NULL,
  `procedencia` varchar(4) DEFAULT NULL,
  `mercado` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci COMMENT='Contiene el listado de titularizaciones que se han negociado en la bolsa de valores desde enero de 2018 hasta la fecha';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario`
--

DROP TABLE IF EXISTS `usuario`;
CREATE TABLE `usuario` (
  `id_usuario` int(11) NOT NULL,
  `id_rol` int(11) NOT NULL,
  `id_persona` int(11) NOT NULL,
  `nombre_usuario` varchar(100) NOT NULL,
  `clave_hash` varchar(255) NOT NULL,
  `correo` varchar(150) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `ultimo_acceso` datetime DEFAULT NULL,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `valores_genericos_his`
--

DROP TABLE IF EXISTS `valores_genericos_his`;
CREATE TABLE `valores_genericos_his` (
  `id_valor_generico_his` int(11) NOT NULL,
  `fecha` date DEFAULT NULL,
  `emisor` varchar(60) DEFAULT NULL,
  `precio` double DEFAULT NULL,
  `rendimiento` decimal(8,4) DEFAULT NULL,
  `plazo_dias` int(11) DEFAULT NULL,
  `interes` decimal(8,4) DEFAULT NULL,
  `valor_nominal` decimal(10,2) DEFAULT NULL,
  `valor_efectivo` decimal(10,2) DEFAULT NULL,
  `emision` date DEFAULT NULL,
  `vencimiento` date DEFAULT NULL,
  `procedencia` varchar(4) DEFAULT NULL,
  `titulo` varchar(40) DEFAULT NULL,
  `mercado` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci COMMENT='Contiene el listado de certificados de inversion a largo plazo emitidos por entidades bancarias o cooperativas que se han negociado en la bolsa de valores desde enero de 2018 hasta la fecha';

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `variacion_capital`
--

DROP TABLE IF EXISTS `variacion_capital`;
CREATE TABLE `variacion_capital` (
  `id_variacion_capital` bigint(20) NOT NULL,
  `fecha_corte` date NOT NULL,
  `id_grupo_familiar` int(11) NOT NULL,
  `capital_total` decimal(18,2) NOT NULL,
  `capital_propio` decimal(18,2) DEFAULT NULL,
  `observacion` varchar(255) DEFAULT NULL,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `variacion_capital_detalle`
--

DROP TABLE IF EXISTS `variacion_capital_detalle`;
CREATE TABLE `variacion_capital_detalle` (
  `id_variacion_capital_detalle` bigint(20) NOT NULL,
  `id_variacion_capital` bigint(20) NOT NULL,
  `id_persona` int(11) NOT NULL,
  `capital_persona` decimal(18,2) NOT NULL,
  `id_tipo_participacion` int(11) DEFAULT NULL,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `venta_inversion`
--

DROP TABLE IF EXISTS `venta_inversion`;
CREATE TABLE `venta_inversion` (
  `id_venta_inversion` int(11) NOT NULL,
  `id_inversion` int(11) NOT NULL,
  `id_tipo_venta` int(11) NOT NULL,
  `fecha_venta` date NOT NULL,
  `porcentaje_vendido` decimal(10,4) DEFAULT NULL,
  `valor_nominal_vendido` decimal(18,2) DEFAULT NULL,
  `valor_efectivo_vendido` decimal(18,2) DEFAULT NULL,
  `precio_venta` decimal(18,8) DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `acciones_his`
--
ALTER TABLE `acciones_his`
  ADD PRIMARY KEY (`id_accion_his`);

--
-- Indices de la tabla `acciones_ultimas_transacciones`
--
ALTER TABLE `acciones_ultimas_transacciones`
  ADD PRIMARY KEY (`id_accion_ultima_transaccion`),
  ADD KEY `idx_acciones_ultimas_transacciones_corte` (`fecha_corte`),
  ADD KEY `idx_acciones_ultimas_transacciones_emisor` (`emisor`);

--
-- Indices de la tabla `amortizacion`
--
ALTER TABLE `amortizacion`
  ADD PRIMARY KEY (`id_amortizacion`),
  ADD KEY `idx_amortizacion_inversion` (`id_inversion`),
  ADD KEY `idx_amortizacion_fecha_pago` (`fecha_pago`),
  ADD KEY `idx_amortizacion_estado` (`id_estado_amortizacion`);

--
-- Indices de la tabla `bonos_his`
--
ALTER TABLE `bonos_his`
  ADD PRIMARY KEY (`id_bono_his`);

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
-- Indices de la tabla `consolidado_inversion`
--
ALTER TABLE `consolidado_inversion`
  ADD PRIMARY KEY (`id_consolidado_inversion`),
  ADD KEY `fk_consolidado_inversion_grupo` (`id_grupo_familiar`),
  ADD KEY `fk_consolidado_inversion_propietario` (`id_propietario`),
  ADD KEY `fk_consolidado_inversion_tipo` (`id_tipo_inversion`),
  ADD KEY `fk_consolidado_inversion_emisor` (`id_emisor`),
  ADD KEY `idx_consolidado_inversion_corte` (`fecha_corte`),
  ADD KEY `idx_consolidado_inversion_principal` (`fecha_corte`,`id_propietario`,`id_tipo_inversion`);

--
-- Indices de la tabla `dividendos_his`
--
ALTER TABLE `dividendos_his`
  ADD PRIMARY KEY (`id_dividendo_his`),
  ADD KEY `idx_dividendos_his_fecha` (`fecha`),
  ADD KEY `idx_dividendos_his_emisor` (`emisor`);

--
-- Indices de la tabla `documento_inversion`
--
ALTER TABLE `documento_inversion`
  ADD PRIMARY KEY (`id_documento_inversion`),
  ADD KEY `fk_documento_inversion_tipo` (`id_tipo_documento`),
  ADD KEY `idx_documento_inversion_inversion` (`id_inversion`);

--
-- Indices de la tabla `emisor`
--
ALTER TABLE `emisor`
  ADD PRIMARY KEY (`id_emisor`),
  ADD UNIQUE KEY `uq_emisor_nombre` (`nombre`),
  ADD KEY `fk_emisor_tipo` (`id_tipo_emisor`),
  ADD KEY `idx_emisor_sigla` (`sigla`);

--
-- Indices de la tabla `facturas_comerciales_his`
--
ALTER TABLE `facturas_comerciales_his`
  ADD PRIMARY KEY (`id_factura_comercial_his`);

--
-- Indices de la tabla `grupo_familiar`
--
ALTER TABLE `grupo_familiar`
  ADD PRIMARY KEY (`id_grupo_familiar`),
  ADD UNIQUE KEY `uq_grupo_familiar_nombre` (`nombre`),
  ADD KEY `fk_grupo_familiar_patriarca` (`id_patriarca`);

--
-- Indices de la tabla `grupo_familiar_persona`
--
ALTER TABLE `grupo_familiar_persona`
  ADD PRIMARY KEY (`id_grupo_familiar_persona`),
  ADD UNIQUE KEY `uq_gfp` (`id_grupo_familiar`,`id_persona`,`id_tipo_relacion`),
  ADD KEY `idx_gfp_persona` (`id_persona`),
  ADD KEY `idx_gfp_tipo_relacion` (`id_tipo_relacion`);

--
-- Indices de la tabla `instrumento`
--
ALTER TABLE `instrumento`
  ADD PRIMARY KEY (`id_instrumento`),
  ADD KEY `idx_instrumento_emisor` (`id_emisor`),
  ADD KEY `idx_instrumento_tipo_inversion` (`id_tipo_inversion`),
  ADD KEY `idx_instrumento_codigo_titulo` (`codigo_titulo`),
  ADD KEY `idx_instrumento_vencimiento` (`fecha_vencimiento`);

--
-- Indices de la tabla `inversion`
--
ALTER TABLE `inversion`
  ADD PRIMARY KEY (`id_inversion`),
  ADD KEY `fk_inversion_instrumento` (`id_instrumento`),
  ADD KEY `idx_inversion_grupo_familiar` (`id_grupo_familiar`),
  ADD KEY `idx_inversion_tipo_inversion` (`id_tipo_inversion`),
  ADD KEY `idx_inversion_propietario` (`id_propietario`),
  ADD KEY `idx_inversion_aportante` (`id_aportante`),
  ADD KEY `idx_inversion_estado` (`id_estado_inversion`),
  ADD KEY `idx_inversion_emisor` (`id_emisor`),
  ADD KEY `idx_inversion_fecha_vencimiento` (`fecha_vencimiento`),
  ADD KEY `idx_inversion_fecha_compra` (`fecha_compra`);

--
-- Indices de la tabla `obligaciones_his`
--
ALTER TABLE `obligaciones_his`
  ADD PRIMARY KEY (`id_obligacion_his`);

--
-- Indices de la tabla `otro_valor`
--
ALTER TABLE `otro_valor`
  ADD PRIMARY KEY (`id_otro_valor`),
  ADD KEY `idx_otro_valor_grupo_familiar` (`id_grupo_familiar`),
  ADD KEY `idx_otro_valor_propietario` (`id_propietario`),
  ADD KEY `idx_otro_valor_tipo` (`id_tipo_otro_valor`),
  ADD KEY `idx_otro_valor_fechas` (`fecha_desde`,`fecha_hasta`);

--
-- Indices de la tabla `papeles_comerciales_his`
--
ALTER TABLE `papeles_comerciales_his`
  ADD PRIMARY KEY (`id_papel_comercial_his`);

--
-- Indices de la tabla `persona`
--
ALTER TABLE `persona`
  ADD PRIMARY KEY (`id_persona`),
  ADD KEY `idx_persona_identificacion` (`identificacion`),
  ADD KEY `idx_persona_apellidos_nombres` (`apellidos`,`nombres`);

--
-- Indices de la tabla `rendimientos_his`
--
ALTER TABLE `rendimientos_his`
  ADD PRIMARY KEY (`id_rendimiento_his`),
  ADD KEY `idx_rendimientos_his_fecha` (`fecha`),
  ADD KEY `idx_rendimientos_his_emisor` (`emisor`);

--
-- Indices de la tabla `rol`
--
ALTER TABLE `rol`
  ADD PRIMARY KEY (`id_rol`),
  ADD UNIQUE KEY `uq_rol_nombre` (`nombre`);

--
-- Indices de la tabla `titularizaciones_his`
--
ALTER TABLE `titularizaciones_his`
  ADD PRIMARY KEY (`id_titularizacion_his`);

--
-- Indices de la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD PRIMARY KEY (`id_usuario`),
  ADD UNIQUE KEY `uq_usuario_nombre_usuario` (`nombre_usuario`),
  ADD UNIQUE KEY `uq_usuario_id_persona` (`id_persona`),
  ADD KEY `idx_usuario_rol` (`id_rol`);

--
-- Indices de la tabla `valores_genericos_his`
--
ALTER TABLE `valores_genericos_his`
  ADD PRIMARY KEY (`id_valor_generico_his`);

--
-- Indices de la tabla `variacion_capital`
--
ALTER TABLE `variacion_capital`
  ADD PRIMARY KEY (`id_variacion_capital`),
  ADD UNIQUE KEY `uq_variacion_capital` (`fecha_corte`,`id_grupo_familiar`),
  ADD KEY `fk_variacion_capital_grupo` (`id_grupo_familiar`),
  ADD KEY `idx_variacion_capital_corte` (`fecha_corte`);

--
-- Indices de la tabla `variacion_capital_detalle`
--
ALTER TABLE `variacion_capital_detalle`
  ADD PRIMARY KEY (`id_variacion_capital_detalle`),
  ADD UNIQUE KEY `uq_variacion_detalle` (`id_variacion_capital`,`id_persona`),
  ADD KEY `fk_variacion_detalle_tipo_participacion` (`id_tipo_participacion`),
  ADD KEY `idx_variacion_detalle_persona` (`id_persona`);

--
-- Indices de la tabla `venta_inversion`
--
ALTER TABLE `venta_inversion`
  ADD PRIMARY KEY (`id_venta_inversion`),
  ADD KEY `fk_venta_inversion_tipo` (`id_tipo_venta`),
  ADD KEY `idx_venta_inversion_inversion` (`id_inversion`),
  ADD KEY `idx_venta_inversion_fecha` (`fecha_venta`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `acciones_his`
--
ALTER TABLE `acciones_his`
  MODIFY `id_accion_his` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `acciones_ultimas_transacciones`
--
ALTER TABLE `acciones_ultimas_transacciones`
  MODIFY `id_accion_ultima_transaccion` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `amortizacion`
--
ALTER TABLE `amortizacion`
  MODIFY `id_amortizacion` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `bonos_his`
--
ALTER TABLE `bonos_his`
  MODIFY `id_bono_his` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `catalogo`
--
ALTER TABLE `catalogo`
  MODIFY `id_catalogo` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `catalogo_valor`
--
ALTER TABLE `catalogo_valor`
  MODIFY `id_catalogo_valor` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `consolidado_inversion`
--
ALTER TABLE `consolidado_inversion`
  MODIFY `id_consolidado_inversion` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `dividendos_his`
--
ALTER TABLE `dividendos_his`
  MODIFY `id_dividendo_his` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `documento_inversion`
--
ALTER TABLE `documento_inversion`
  MODIFY `id_documento_inversion` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `emisor`
--
ALTER TABLE `emisor`
  MODIFY `id_emisor` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `facturas_comerciales_his`
--
ALTER TABLE `facturas_comerciales_his`
  MODIFY `id_factura_comercial_his` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `grupo_familiar`
--
ALTER TABLE `grupo_familiar`
  MODIFY `id_grupo_familiar` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `grupo_familiar_persona`
--
ALTER TABLE `grupo_familiar_persona`
  MODIFY `id_grupo_familiar_persona` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `instrumento`
--
ALTER TABLE `instrumento`
  MODIFY `id_instrumento` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `inversion`
--
ALTER TABLE `inversion`
  MODIFY `id_inversion` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `obligaciones_his`
--
ALTER TABLE `obligaciones_his`
  MODIFY `id_obligacion_his` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `otro_valor`
--
ALTER TABLE `otro_valor`
  MODIFY `id_otro_valor` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `papeles_comerciales_his`
--
ALTER TABLE `papeles_comerciales_his`
  MODIFY `id_papel_comercial_his` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `persona`
--
ALTER TABLE `persona`
  MODIFY `id_persona` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `rendimientos_his`
--
ALTER TABLE `rendimientos_his`
  MODIFY `id_rendimiento_his` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `rol`
--
ALTER TABLE `rol`
  MODIFY `id_rol` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `titularizaciones_his`
--
ALTER TABLE `titularizaciones_his`
  MODIFY `id_titularizacion_his` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuario`
--
ALTER TABLE `usuario`
  MODIFY `id_usuario` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `valores_genericos_his`
--
ALTER TABLE `valores_genericos_his`
  MODIFY `id_valor_generico_his` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `variacion_capital`
--
ALTER TABLE `variacion_capital`
  MODIFY `id_variacion_capital` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `variacion_capital_detalle`
--
ALTER TABLE `variacion_capital_detalle`
  MODIFY `id_variacion_capital_detalle` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `venta_inversion`
--
ALTER TABLE `venta_inversion`
  MODIFY `id_venta_inversion` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `amortizacion`
--
ALTER TABLE `amortizacion`
  ADD CONSTRAINT `fk_amortizacion_estado` FOREIGN KEY (`id_estado_amortizacion`) REFERENCES `catalogo_valor` (`id_catalogo_valor`),
  ADD CONSTRAINT `fk_amortizacion_inversion` FOREIGN KEY (`id_inversion`) REFERENCES `inversion` (`id_inversion`);

--
-- Filtros para la tabla `catalogo_valor`
--
ALTER TABLE `catalogo_valor`
  ADD CONSTRAINT `fk_catalogo_valor_catalogo` FOREIGN KEY (`id_catalogo`) REFERENCES `catalogo` (`id_catalogo`);

--
-- Filtros para la tabla `consolidado_inversion`
--
ALTER TABLE `consolidado_inversion`
  ADD CONSTRAINT `fk_consolidado_inversion_emisor` FOREIGN KEY (`id_emisor`) REFERENCES `emisor` (`id_emisor`),
  ADD CONSTRAINT `fk_consolidado_inversion_grupo` FOREIGN KEY (`id_grupo_familiar`) REFERENCES `grupo_familiar` (`id_grupo_familiar`),
  ADD CONSTRAINT `fk_consolidado_inversion_propietario` FOREIGN KEY (`id_propietario`) REFERENCES `persona` (`id_persona`),
  ADD CONSTRAINT `fk_consolidado_inversion_tipo` FOREIGN KEY (`id_tipo_inversion`) REFERENCES `catalogo_valor` (`id_catalogo_valor`);

--
-- Filtros para la tabla `documento_inversion`
--
ALTER TABLE `documento_inversion`
  ADD CONSTRAINT `fk_documento_inversion_inversion` FOREIGN KEY (`id_inversion`) REFERENCES `inversion` (`id_inversion`),
  ADD CONSTRAINT `fk_documento_inversion_tipo` FOREIGN KEY (`id_tipo_documento`) REFERENCES `catalogo_valor` (`id_catalogo_valor`);

--
-- Filtros para la tabla `emisor`
--
ALTER TABLE `emisor`
  ADD CONSTRAINT `fk_emisor_tipo` FOREIGN KEY (`id_tipo_emisor`) REFERENCES `catalogo_valor` (`id_catalogo_valor`);

--
-- Filtros para la tabla `grupo_familiar`
--
ALTER TABLE `grupo_familiar`
  ADD CONSTRAINT `fk_grupo_familiar_patriarca` FOREIGN KEY (`id_patriarca`) REFERENCES `persona` (`id_persona`);

--
-- Filtros para la tabla `grupo_familiar_persona`
--
ALTER TABLE `grupo_familiar_persona`
  ADD CONSTRAINT `fk_gfp_grupo_familiar` FOREIGN KEY (`id_grupo_familiar`) REFERENCES `grupo_familiar` (`id_grupo_familiar`),
  ADD CONSTRAINT `fk_gfp_persona` FOREIGN KEY (`id_persona`) REFERENCES `persona` (`id_persona`),
  ADD CONSTRAINT `fk_gfp_tipo_relacion` FOREIGN KEY (`id_tipo_relacion`) REFERENCES `catalogo_valor` (`id_catalogo_valor`);

--
-- Filtros para la tabla `instrumento`
--
ALTER TABLE `instrumento`
  ADD CONSTRAINT `fk_instrumento_emisor` FOREIGN KEY (`id_emisor`) REFERENCES `emisor` (`id_emisor`),
  ADD CONSTRAINT `fk_instrumento_tipo_inversion` FOREIGN KEY (`id_tipo_inversion`) REFERENCES `catalogo_valor` (`id_catalogo_valor`);

--
-- Filtros para la tabla `inversion`
--
ALTER TABLE `inversion`
  ADD CONSTRAINT `fk_inversion_aportante` FOREIGN KEY (`id_aportante`) REFERENCES `persona` (`id_persona`),
  ADD CONSTRAINT `fk_inversion_emisor` FOREIGN KEY (`id_emisor`) REFERENCES `emisor` (`id_emisor`),
  ADD CONSTRAINT `fk_inversion_estado` FOREIGN KEY (`id_estado_inversion`) REFERENCES `catalogo_valor` (`id_catalogo_valor`),
  ADD CONSTRAINT `fk_inversion_grupo_familiar` FOREIGN KEY (`id_grupo_familiar`) REFERENCES `grupo_familiar` (`id_grupo_familiar`),
  ADD CONSTRAINT `fk_inversion_instrumento` FOREIGN KEY (`id_instrumento`) REFERENCES `instrumento` (`id_instrumento`),
  ADD CONSTRAINT `fk_inversion_propietario` FOREIGN KEY (`id_propietario`) REFERENCES `persona` (`id_persona`),
  ADD CONSTRAINT `fk_inversion_tipo_inversion` FOREIGN KEY (`id_tipo_inversion`) REFERENCES `catalogo_valor` (`id_catalogo_valor`);

--
-- Filtros para la tabla `otro_valor`
--
ALTER TABLE `otro_valor`
  ADD CONSTRAINT `fk_otro_valor_grupo_familiar` FOREIGN KEY (`id_grupo_familiar`) REFERENCES `grupo_familiar` (`id_grupo_familiar`),
  ADD CONSTRAINT `fk_otro_valor_propietario` FOREIGN KEY (`id_propietario`) REFERENCES `persona` (`id_persona`),
  ADD CONSTRAINT `fk_otro_valor_tipo` FOREIGN KEY (`id_tipo_otro_valor`) REFERENCES `catalogo_valor` (`id_catalogo_valor`);

--
-- Filtros para la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD CONSTRAINT `fk_usuario_persona` FOREIGN KEY (`id_persona`) REFERENCES `persona` (`id_persona`),
  ADD CONSTRAINT `fk_usuario_rol` FOREIGN KEY (`id_rol`) REFERENCES `rol` (`id_rol`);

--
-- Filtros para la tabla `variacion_capital`
--
ALTER TABLE `variacion_capital`
  ADD CONSTRAINT `fk_variacion_capital_grupo` FOREIGN KEY (`id_grupo_familiar`) REFERENCES `grupo_familiar` (`id_grupo_familiar`);

--
-- Filtros para la tabla `variacion_capital_detalle`
--
ALTER TABLE `variacion_capital_detalle`
  ADD CONSTRAINT `fk_variacion_detalle_persona` FOREIGN KEY (`id_persona`) REFERENCES `persona` (`id_persona`),
  ADD CONSTRAINT `fk_variacion_detalle_tipo_participacion` FOREIGN KEY (`id_tipo_participacion`) REFERENCES `catalogo_valor` (`id_catalogo_valor`),
  ADD CONSTRAINT `fk_variacion_detalle_variacion` FOREIGN KEY (`id_variacion_capital`) REFERENCES `variacion_capital` (`id_variacion_capital`);

--
-- Filtros para la tabla `venta_inversion`
--
ALTER TABLE `venta_inversion`
  ADD CONSTRAINT `fk_venta_inversion_inversion` FOREIGN KEY (`id_inversion`) REFERENCES `inversion` (`id_inversion`),
  ADD CONSTRAINT `fk_venta_inversion_tipo` FOREIGN KEY (`id_tipo_venta`) REFERENCES `catalogo_valor` (`id_catalogo_valor`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
