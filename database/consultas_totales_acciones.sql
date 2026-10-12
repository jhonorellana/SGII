-- =========================================================================================
-- SCRIPT: consultas_totales_acciones.sql
-- BASE DE DATOS: sipro_desa
-- TABLA: accion_operacion
-- DESCRIPCIÓN: Consultas SQL para auditar y verificar manualmente los totales de
--              adquisiciones (compras, suscripciones, dividendos en acciones),
--              ventas y la diferencia neta entre ambos.
-- =========================================================================================

USE sipro_desa;

-- -----------------------------------------------------------------------------------------
-- CONSULTA 1: RESUMEN AGRUPADO POR TIPO DE OPERACIÓN
-- Muestra el total de operaciones y el monto neto por cada categoría en accion_operacion
-- -----------------------------------------------------------------------------------------
SELECT 
    ao.id_tipo_operacion,
    cv.nombre AS tipo_operacion,
    cv.codigo,
    COUNT(*) AS total_transacciones,
    SUM(ao.cantidad) AS total_acciones,
    SUM(ao.valor_neto) AS suma_valor_neto
FROM sipro_desa.accion_operacion ao
LEFT JOIN sipro_desa.catalogo_valor cv 
    ON cv.id_catalogo_valor = ao.id_tipo_operacion
WHERE ao.activo = 1 
  AND ao.eliminado = 0
GROUP BY 
    ao.id_tipo_operacion, 
    cv.nombre, 
    cv.codigo
ORDER BY 
    ao.id_tipo_operacion ASC;


-- -----------------------------------------------------------------------------------------
-- CONSULTA 2: CUADRO GENERAL CONSOLIDADOR (ADQUISICIONES, VENTAS Y DIFERENCIAS)
-- Realiza el cálculo directo en una sola fila con todas las comparativas
-- -----------------------------------------------------------------------------------------
SELECT 
    -- 1. Compras (Tipo 204)
    SUM(CASE WHEN ao.id_tipo_operacion = 204 THEN ao.valor_neto ELSE 0 END) AS total_compras,

    -- 2. Suscripciones (Tipo 232)
    SUM(CASE WHEN ao.id_tipo_operacion = 232 THEN ao.valor_neto ELSE 0 END) AS total_suscripciones,

    -- 3. Total Desembolsado en Adquisiciones Directas (Compras + Suscripciones)
    SUM(CASE WHEN ao.id_tipo_operacion IN (204, 232) THEN ao.valor_neto ELSE 0 END) AS total_adquisiciones_efectivo,

    -- 4. Dividendos en Acciones (Tipo 206)
    SUM(CASE WHEN ao.id_tipo_operacion = 206 THEN ao.valor_neto ELSE 0 END) AS total_dividendos_acciones,

    -- 5. Total Adquisiciones Completo (Compras + Suscripciones + Dividendos en Acciones)
    SUM(CASE WHEN ao.id_tipo_operacion IN (204, 206, 232) THEN ao.valor_neto ELSE 0 END) AS total_adquisiciones_completo,

    -- 6. Ventas de Acciones (Tipo 205)
    SUM(CASE WHEN ao.id_tipo_operacion = 205 THEN ao.valor_neto ELSE 0 END) AS total_ventas_cobradas,

    -- 7. Diferencia A: Sin Dividendos (Compras + Suscripciones - Ventas)
    (
        SUM(CASE WHEN ao.id_tipo_operacion IN (204, 232) THEN ao.valor_neto ELSE 0 END) -
        SUM(CASE WHEN ao.id_tipo_operacion = 205 THEN ao.valor_neto ELSE 0 END)
    ) AS diferencia_sin_dividendos,

    -- 8. Diferencia B: Con Dividendos (Total Adquiridas - Ventas)
    (
        SUM(CASE WHEN ao.id_tipo_operacion IN (204, 206, 232) THEN ao.valor_neto ELSE 0 END) -
        SUM(CASE WHEN ao.id_tipo_operacion = 205 THEN ao.valor_neto ELSE 0 END)
    ) AS diferencia_con_dividendos

FROM sipro_desa.accion_operacion ao
WHERE ao.activo = 1 
  AND ao.eliminado = 0;


-- -----------------------------------------------------------------------------------------
-- CONSULTA 3: DETALLE ÍNTEGRO DE TODAS LAS VENTAS DE ACCIONES (TIPO 205)
-- Muestra cada operación de venta registrada con su emisor, comisiones y valor neto
-- -----------------------------------------------------------------------------------------
SELECT 
    ao.id_accion_operacion,
    ao.fecha_operacion,
    e.nombre AS emisor,
    i.nombre AS instrumento,
    ao.cantidad AS acciones_vendidas,
    ao.precio_unitario,
    ao.valor_bruto,
    ao.total_comisiones,
    ao.valor_neto AS valor_neto_cobrado,
    ao.liquidacion,
    ao.observacion
FROM sipro_desa.accion_operacion ao
JOIN sipro_desa.instrumento i 
    ON i.id_instrumento = ao.id_instrumento
JOIN sipro_desa.emisor e 
    ON e.id_emisor = i.id_emisor
WHERE ao.id_tipo_operacion = 205
  AND ao.activo = 1 
  AND ao.eliminado = 0
ORDER BY ao.fecha_operacion ASC, ao.id_accion_operacion ASC;


-- -----------------------------------------------------------------------------------------
-- CONSULTA 4: ADQUISICIONES AGRUPADAS POR EMISOR (COMPRAS + SUSCRIPCIONES)
-- Permite ver el capital invertido desembolsado por cada empresa
-- -----------------------------------------------------------------------------------------
SELECT 
    e.id_emisor,
    e.nombre AS emisor,
    COUNT(*) AS total_compras,
    SUM(ao.cantidad) AS total_acciones_adquiridas,
    SUM(ao.valor_neto) AS total_valor_neto_invertido
FROM sipro_desa.accion_operacion ao
JOIN sipro_desa.instrumento i 
    ON i.id_instrumento = ao.id_instrumento
JOIN sipro_desa.emisor e 
    ON e.id_emisor = i.id_emisor
WHERE ao.id_tipo_operacion IN (204, 232)
  AND ao.activo = 1 
  AND ao.eliminado = 0
GROUP BY e.id_emisor, e.nombre
ORDER BY total_valor_neto_invertido DESC;


-- -----------------------------------------------------------------------------------------
-- CONSULTA 5: DIVIDENDOS EN ACCIONES AGRUPADOS POR EMISOR (TIPO 206)
-- Muestra el valor acumulado recibido como dividendo en acciones
-- -----------------------------------------------------------------------------------------
SELECT 
    e.id_emisor,
    e.nombre AS emisor,
    COUNT(*) AS total_entregas,
    SUM(ao.cantidad) AS acciones_recibidas,
    SUM(ao.valor_neto) AS valor_nominal_dividendos
FROM sipro_desa.accion_operacion ao
JOIN sipro_desa.instrumento i 
    ON i.id_instrumento = ao.id_instrumento
JOIN sipro_desa.emisor e 
    ON e.id_emisor = i.id_emisor
WHERE ao.id_tipo_operacion = 206
  AND ao.activo = 1 
  AND ao.eliminado = 0
GROUP BY e.id_emisor, e.nombre
ORDER BY valor_nominal_dividendos DESC;
