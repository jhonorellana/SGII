-- Migración: Renombrar campo comisiones_santa_fe a comisiones_operador
-- Fecha: 2026-05-31
-- Descripción: Cambiar nombre del campo para ser más genérico y no depender del nombre del operador actual

USE sipro_db;

-- Renombrar la columna en la tabla venta_inversion
ALTER TABLE venta_inversion 
CHANGE COLUMN comisiones_santa_fe comisiones_operador DECIMAL(15,2) NULL DEFAULT NULL;

-- Verificar el cambio
DESCRIBE venta_inversion;
