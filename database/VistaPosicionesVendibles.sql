-- Vista consolidada para posiciones vendibles (Instrumento + Propietario)
-- Esta vista combina información de Instrumento, Inversión y Propietario
-- Cada fila representa una posición vendible única por instrumento y propietario

CREATE OR REPLACE VIEW `vw_posiciones_vendibles` AS
SELECT 
    i.id_instrumento,
    i.nombre AS nombre_instrumento,
    i.fecha_emision,
    i.fecha_vencimiento,
    i.tasa_referencial,
    i.activo AS instrumento_activo,
    
    e.id_emisor,
    e.nombre AS nombre_emisor,
    
    cv.id_catalogo_valor AS id_tipo_inversion,
    cv.nombre AS nombre_tipo_inversion,
    
    p.id_persona AS id_propietario,
    CONCAT(p.nombres, ' ', p.apellidos) AS nombre_propietario,
    
    -- Datos consolidados de inversiones por instrumento y propietario
    COUNT(inv.id_inversion) AS cantidad_inversiones,
    SUM(inv.valor_nominal) AS valor_nominal_total,
    SUM(inv.capital_invertido) AS capital_invertido_total,
    AVG(inv.rendimiento_efectivo) AS rendimiento_promedio,
    
    -- Fechas extremas
    MIN(inv.fecha_compra) AS fecha_compra_minima,
    MAX(inv.fecha_compra) AS fecha_compra_maxima,
    
    -- Liquidaciones (concatenadas)
    GROUP_CONCAT(DISTINCT inv.liquidacion ORDER BY inv.liquidacion SEPARATOR ', ') AS liquidaciones
    
FROM instrumento i
LEFT JOIN emisor e ON i.id_emisor = e.id_emisor
LEFT JOIN catalogo_valor cv ON i.id_tipo_inversion = cv.id_catalogo_valor
LEFT JOIN inversion inv ON i.id_instrumento = inv.id_instrumento AND inv.activo = 1
LEFT JOIN persona p ON inv.id_propietario = p.id_persona
LEFT JOIN catalogo_valor ei ON inv.id_estado_inversion = ei.id_catalogo_valor

WHERE i.activo = 1
  AND (inv.id_inversion IS NULL OR ei.codigo = 'ACTIVA')
  AND p.id_persona IS NOT NULL

GROUP BY 
    i.id_instrumento,
    i.nombre,
    i.fecha_emision,
    i.fecha_vencimiento,
    i.tasa_referencial,
    i.activo,
    e.id_emisor,
    e.nombre,
    cv.id_catalogo_valor,
    cv.nombre,
    p.id_persona,
    p.nombres,
    p.apellidos

HAVING cantidad_inversiones > 0

ORDER BY p.nombres, p.apellidos, i.nombre;
