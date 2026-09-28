-- Script SQL para añadir los nuevos campos a la tabla 'obligaciones_his' en la base de datos 'inversion'
-- Ejecutar en el cliente MySQL (DBeaver, HeidiSQL, phpMyAdmin, Workbench, etc.)

-- Seleccionar la base de datos correspondiente si es necesario
-- USE `sipro_inversiones`;

ALTER TABLE `obligaciones_his` 
ADD COLUMN IF NOT EXISTS `TIR_TEA` DECIMAL(18,4) NULL AFTER `INTERES`,
ADD COLUMN IF NOT EXISTS `VALOR_NOMINAL_ORIGINAL` DECIMAL(18,4) NULL AFTER `TIR_TEA`,
ADD COLUMN IF NOT EXISTS `NOMBRE_TITULO` VARCHAR(200) NULL AFTER `VENCIMIENTO`;
