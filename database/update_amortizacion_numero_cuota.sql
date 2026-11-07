-- Script de migración / actualización: Asignación de numero_cuota en amortizaciones históricas
-- Fecha: 2026-11-07
-- Descripción:
--   Asigna un numero_cuota entero correlativo ascendente (1, 2, 3...) agrupado por id_inversion
--   y ordenado cronológicamente por fecha_pago ASC, id_amortizacion ASC, exclusivamente
--   para las amortizaciones que se encontraban en NULL o 0.
--   Las cuotas preexistentes no son alteradas.

-- 1. Respaldo preventivo
CREATE TABLE IF NOT EXISTS amortizacion_backup_cuotas_20261107 AS 
SELECT id_amortizacion, id_inversion, numero_cuota, fecha_pago 
FROM amortizacion;

-- 2. Actualización en transacción
START TRANSACTION;

UPDATE amortizacion a
JOIN (
    SELECT 
        id_amortizacion,
        ROW_NUMBER() OVER (
            PARTITION BY id_inversion 
            ORDER BY fecha_pago ASC, id_amortizacion ASC
        ) AS cuota_calculada
    FROM amortizacion
    WHERE id_inversion IN (
        SELECT id_inversion 
        FROM (SELECT DISTINCT id_inversion FROM amortizacion WHERE numero_cuota IS NULL OR numero_cuota = 0) t
    )
) sub ON a.id_amortizacion = sub.id_amortizacion
SET a.numero_cuota = sub.cuota_calculada
WHERE a.numero_cuota IS NULL OR a.numero_cuota = 0;

-- 3. Verificación
SELECT 
    COUNT(*) as total_amortizaciones,
    SUM(CASE WHEN numero_cuota IS NULL OR numero_cuota = 0 THEN 1 ELSE 0 END) as sin_cuota,
    SUM(CASE WHEN numero_cuota IS NOT NULL AND numero_cuota > 0 THEN 1 ELSE 0 END) as con_cuota,
    MIN(numero_cuota) as min_cuota,
    MAX(numero_cuota) as max_cuota
FROM amortizacion;

COMMIT;

