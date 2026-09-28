-- Script SQL para agregar el campo faltante a la tabla genericos_his
-- Ejecutar en el cliente MySQL (DBeaver, HeidiSQL, phpMyAdmin, Workbench, etc.)

-- Seleccionar la base de datos correspondiente (ej. sipro_inversiones o mysql_inversion)
-- USE sipro_inversiones;

ALTER TABLE genericos_his 
ADD COLUMN IF NOT EXISTS TIR_TEA VARCHAR(100) NULL AFTER RENDIMIENTO;
