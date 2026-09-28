-- Script SQL para añadir los nuevos campos a la tabla 'titularizaciones_his' en la base de datos 'inversion'
-- Ejecutar en el cliente MySQL (DBeaver, HeidiSQL, phpMyAdmin, Workbench, etc.)

-- Seleccionar la base de datos correspondiente si es necesario
-- USE `sipro_inversiones`;

ALTER TABLE `titularizaciones_his` 
ADD COLUMN IF NOT EXISTS `TIR_TEA` DECIMAL(18,4) NULL AFTER `INTERES`,
ADD COLUMN IF NOT EXISTS `VALOR_NOMINAL_ORIGINAL` DECIMAL(18,4) NULL AFTER `TIR_TEA`;
