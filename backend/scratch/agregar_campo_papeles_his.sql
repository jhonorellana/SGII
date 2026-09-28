-- Script SQL para añadir el campo faltante a la tabla 'papeles_his' en la base de datos 'inversion'
-- Ejecutar en el cliente MySQL (DBeaver, HeidiSQL, phpMyAdmin, Workbench, etc.)

-- Seleccionar la base de datos correspondiente si es necesario
-- USE `sipro_inversiones`;

ALTER TABLE `papeles_his` 
ADD COLUMN IF NOT EXISTS `TIR_TEA` DECIMAL(18,4) NULL AFTER `RENDIMIENTO`;
