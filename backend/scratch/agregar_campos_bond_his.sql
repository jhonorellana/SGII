-- Script SQL para añadir los nuevos campos a la tabla 'bond_his' en la base de datos 'inversion'

USE `inversion`;

-- 1. Añadir columna TIR_TEA (Tasa Interna de Retorno / Tasa Efectiva Anual)
ALTER TABLE `bond_his` 
ADD COLUMN `TIR_TEA` DOUBLE NULL AFTER `RENDIMIENTO_PORC`;

-- 2. Añadir columna VALOR_NOMINAL_ORIGINAL (Valor nominal de emisión original)
ALTER TABLE `bond_his` 
ADD COLUMN `VALOR_NOMINAL_ORIGINAL` DOUBLE NULL AFTER `TASA_INTERES`;

-- 3. Añadir columna CLASE (Clasificación de emisión del papel)
ALTER TABLE `bond_his` 
ADD COLUMN `CLASE` VARCHAR(50) NULL AFTER `TIPO`;
