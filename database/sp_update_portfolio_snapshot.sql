DELIMITER $$
DROP PROCEDURE IF EXISTS SP_ACTUALIZAR_SNAPSHOT_CARTERA $$
CREATE PROCEDURE sp_actualizar_snapshot_cartera()
BEGIN
    /* Cargar umbrales desde catalogo_valor (catalogo = 19) */
    DECLARE v_unreal_up   DECIMAL(6,2);
    DECLARE v_unreal_down DECIMAL(6,2);
    DECLARE v_daily_up    DECIMAL(6,2);
    DECLARE v_daily_down  DECIMAL(6,2);
    DECLARE v_vr_thr      DECIMAL(6,2);
    DECLARE v_rsi_up      INT;
    DECLARE v_rsi_down    INT;
    DECLARE v_days_no_tr  INT;

    SELECT CAST(descripcion AS DECIMAL(6,2)) INTO v_unreal_up   FROM catalogo_valor WHERE id_catalogo = 19 AND codigo = 'UNREALIZED_PCT_UP' LIMIT 1;
    SELECT CAST(descripcion AS DECIMAL(6,2)) INTO v_unreal_down FROM catalogo_valor WHERE id_catalogo = 19 AND codigo = 'UNREALIZED_PCT_DOWN' LIMIT 1;
    SELECT CAST(descripcion AS DECIMAL(6,2)) INTO v_daily_up    FROM catalogo_valor WHERE id_catalogo = 19 AND codigo = 'DAILY_VARIATION_UP' LIMIT 1;
    SELECT CAST(descripcion AS DECIMAL(6,2)) INTO v_daily_down  FROM catalogo_valor WHERE id_catalogo = 19 AND codigo = 'DAILY_VARIATION_DOWN' LIMIT 1;
    SELECT CAST(descripcion AS DECIMAL(6,2)) INTO v_vr_thr      FROM catalogo_valor WHERE id_catalogo = 19 AND codigo = 'VOLUME_RELATIVE' LIMIT 1;
    SELECT CAST(descripcion AS UNSIGNED)     INTO v_rsi_up      FROM catalogo_valor WHERE id_catalogo = 19 AND codigo = 'RSI_OVERBOUGHT' LIMIT 1;
    SELECT CAST(descripcion AS UNSIGNED)     INTO v_rsi_down    FROM catalogo_valor WHERE id_catalogo = 19 AND codigo = 'RSI_OVERSOLD' LIMIT 1;
    SELECT CAST(descripcion AS UNSIGNED)     INTO v_days_no_tr  FROM catalogo_valor WHERE id_catalogo = 19 AND codigo = 'DAYS_NO_TRADE' LIMIT 1;

    INSERT INTO snapshot_cartera_diaria (
        id_emisor,
        fecha,
        cantidad_posicion,
        costo_promedio,
        precio_mercado,
        valor_mercado,
        pl_no_realizado,
        porcentaje_no_realizado,
        sma_5,
        sma_20,
        vr,
        dias_sin_negociacion,
        alertas
    )
    SELECT
        i.id_emisor,
        CURDATE() AS fecha,
        SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad
                 WHEN ao.id_tipo_operacion IN (205,208) THEN -ao.cantidad ELSE 0 END) AS cantidad_posicion,
        CASE WHEN SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad END) = 0 THEN NULL
             ELSE ROUND(
                 SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario END) /
                 SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad END)
                ,6) END AS costo_promedio,
        ap.precio_ultimo AS precio_mercado,
        (SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad
                 WHEN ao.id_tipo_operacion IN (205,208) THEN -ao.cantidad ELSE 0 END) * IFNULL(ap.precio_ultimo,0)) AS valor_mercado,
        ( (SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad
                    WHEN ao.id_tipo_operacion IN (205,208) THEN -ao.cantidad ELSE 0 END) * IFNULL(ap.precio_ultimo,0))
          - SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario ELSE 0 END) ) AS pl_no_realizado,
        CASE WHEN SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario END) = 0 THEN NULL
             ELSE ROUND(
                 ( ( (SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad
                                WHEN ao.id_tipo_operacion IN (205,208) THEN -ao.cantidad ELSE 0 END) * IFNULL(ap.precio_ultimo,0))
                    - SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario ELSE 0 END) )
                   / SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario END) ) * 100,2) END AS porcentaje_no_realizado,
        AVG(ap.precio_ultimo) OVER (PARTITION BY i.id_emisor ORDER BY ap.fecha_ultimo_precio ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) AS sma_5,
        AVG(ap.precio_ultimo) OVER (PARTITION BY i.id_emisor ORDER BY ap.fecha_ultimo_precio ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS sma_20,
        ap.volumen_ultimo_dia /
        NULLIF( (SELECT AVG(volumen_ultimo_dia)
                 FROM accion_ultimo_precio a2
                 WHERE a2.id_emisor = i.id_emisor
                   AND a2.fecha_ultimo_precio BETWEEN CURDATE() - INTERVAL 30 DAY AND CURDATE()), 0) AS vr,
        ap.dias_sin_negociacion,
        CONCAT('[',
            CONCAT_WS(',',
                CASE WHEN 
                    ( (SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad WHEN ao.id_tipo_operacion IN (205,208) THEN -ao.cantidad ELSE 0 END) * IFNULL(ap.precio_ultimo,0))
                    - SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario ELSE 0 END) ) IS NOT NULL 
                    AND 
                    ( CASE WHEN SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario END) = 0 THEN NULL ELSE ROUND( ( ( (SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad WHEN ao.id_tipo_operacion IN (205,208) THEN -ao.cantidad ELSE 0 END) * IFNULL(ap.precio_ultimo,0)) - SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario ELSE 0 END) ) / SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario END) ) * 100,2) END ) > v_unreal_up   
                    THEN CONCAT('"', 'Unrealized > ', v_unreal_up, '%', '"') ELSE NULL END,
                CASE WHEN 
                    ( (SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad WHEN ao.id_tipo_operacion IN (205,208) THEN -ao.cantidad ELSE 0 END) * IFNULL(ap.precio_ultimo,0))
                    - SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario ELSE 0 END) ) IS NOT NULL 
                    AND 
                    ( CASE WHEN SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario END) = 0 THEN NULL ELSE ROUND( ( ( (SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad WHEN ao.id_tipo_operacion IN (205,208) THEN -ao.cantidad ELSE 0 END) * IFNULL(ap.precio_ultimo,0)) - SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario ELSE 0 END) ) / SUM(CASE WHEN ao.id_tipo_operacion IN (204,206,207,212) THEN ao.cantidad * ao.precio_unitario END) ) * 100,2) END ) < v_unreal_down 
                    THEN CONCAT('"', 'Unrealized < ', v_unreal_down, '%', '"') ELSE NULL END,
                CASE WHEN ap.variacion_porcentaje IS NOT NULL AND ap.variacion_porcentaje > v_daily_up   THEN CONCAT('"', 'Variación diaria > ', v_daily_up, '%', '"') ELSE NULL END,
                CASE WHEN ap.variacion_porcentaje IS NOT NULL AND ap.variacion_porcentaje < v_daily_down THEN CONCAT('"', 'Variación diaria < ', v_daily_down, '%', '"') ELSE NULL END,
                CASE WHEN (ap.volumen_ultimo_dia / NULLIF( (SELECT AVG(volumen_ultimo_dia) FROM accion_ultimo_precio a2 WHERE a2.id_emisor = i.id_emisor AND a2.fecha_ultimo_precio BETWEEN CURDATE() - INTERVAL 30 DAY AND CURDATE()), 0)) IS NOT NULL AND (ap.volumen_ultimo_dia / NULLIF( (SELECT AVG(volumen_ultimo_dia) FROM accion_ultimo_precio a2 WHERE a2.id_emisor = i.id_emisor AND a2.fecha_ultimo_precio BETWEEN CURDATE() - INTERVAL 30 DAY AND CURDATE()), 0)) > v_vr_thr THEN CONCAT('"', 'VR > ', v_vr_thr, '"') ELSE NULL END,
                CASE WHEN ap.dias_sin_negociacion IS NOT NULL AND ap.dias_sin_negociacion > v_days_no_tr THEN CONCAT('"', 'Sin negociación > ', v_days_no_tr, ' días', '"') ELSE NULL END
            ),
        ']') AS alertas
    FROM accion_operacion ao
    INNER JOIN instrumento i ON i.id_instrumento = ao.id_instrumento
    LEFT JOIN accion_ultimo_precio ap ON ap.id_emisor = i.id_emisor
    WHERE ao.activo = 1 AND ao.eliminado = 0 AND i.id_tipo_inversion IN (203,73)
    GROUP BY i.id_emisor;
END$$
DELIMITER ;
