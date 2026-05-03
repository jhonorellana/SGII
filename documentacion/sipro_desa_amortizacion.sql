-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-05-2026 a las 04:11:39
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
  `int_parcial` decimal(18,2) DEFAULT NULL,
  `retencion` decimal(18,2) DEFAULT NULL,
  `id_estado_amortizacion` int(11) NOT NULL,
  `pagada` tinyint(1) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `eliminado` tinyint(1) NOT NULL DEFAULT 0,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
