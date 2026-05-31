-- Script para insertar valores de catálogo necesarios para venta de inversiones
-- Este script verifica si los valores existen antes de insertarlos

-- Insertar estado de inversión VENDIDA_TOTAL si no existe
INSERT IGNORE INTO catalogo_valor
(id_catalogo, codigo, nombre, descripcion, orden_visual, activo)
SELECT 
    (SELECT id_catalogo FROM catalogo WHERE codigo = 'ESTADO_INVERSION'),
    'VENDIDA_TOTAL',
    'Vendida Total',
    'Inversión vendida en su totalidad',
    5,
    1
WHERE NOT EXISTS (
    SELECT 1 FROM catalogo_valor 
    WHERE codigo = 'VENDIDA_TOTAL'
    AND id_catalogo = (SELECT id_catalogo FROM catalogo WHERE codigo = 'ESTADO_INVERSION')
);

-- Insertar estado de inversión ACTIVA si no existe
INSERT IGNORE INTO catalogo_valor
(id_catalogo, codigo, nombre, descripcion, orden_visual, activo)
SELECT 
    (SELECT id_catalogo FROM catalogo WHERE codigo = 'ESTADO_INVERSION'),
    'ACTIVA',
    'Activa',
    'Inversión activa y vigente',
    1,
    1
WHERE NOT EXISTS (
    SELECT 1 FROM catalogo_valor 
    WHERE codigo = 'ACTIVA'
    AND id_catalogo = (SELECT id_catalogo FROM catalogo WHERE codigo = 'ESTADO_INVERSION')
);

-- Nota: PARTE_VEND y PARTE_RESTANTE ya fueron insertados en TablasParaVentaInversion.sql
-- Estos se usan como tipo de relación en inversion_relacion_venta
