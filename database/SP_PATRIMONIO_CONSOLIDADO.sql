-- =========================================================================================
-- PROCEDIMIENTO ALMACENADO: SP_PATRIMONIO_CONSOLIDADO
-- =========================================================================================
DROP PROCEDURE IF EXISTS `SP_PATRIMONIO_CONSOLIDADO`;
DELIMITER $$
CREATE PROCEDURE `SP_PATRIMONIO_CONSOLIDADO`(
    IN `p_fecha_inicio` VARCHAR(10), 
    IN `p_fecha_fin` VARCHAR(10), 
    IN `p_id_grupo_familiar` INT, 
    IN `p_id_propietario` INT, 
    IN `p_incluir_dividendos` TINYINT(1), 
    IN `p_incluir_plusvalia` TINYINT(1)
)
BEGIN
    -- Crear tabla temporal para almacenar resultados intermedios sin re-evaluar subconsultas
    CREATE TEMPORARY TABLE IF NOT EXISTS temp_patrimonio_resultado (
        id INT AUTO_INCREMENT PRIMARY KEY,
        detalle VARCHAR(100),
        valor DECIMAL(18, 2)
    ) ENGINE=InnoDB;

    -- Limpiar la tabla por si fue creada previamente en la misma sesión
    TRUNCATE TABLE temp_patrimonio_resultado;

    -- Llenar la tabla temporal con los 12 rubros
    INSERT INTO temp_patrimonio_resultado (detalle, valor)
    -- 1. Intereses esperados (RANGO DE FECHAS PROYECTADO: p_fecha_inicio a p_fecha_fin)
    SELECT 'Intereses esperados' as detalle,
           COALESCE(SUM(A.interes), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND A.fecha_pago <= p_fecha_fin
      AND I.fecha_venta IS NULL
      AND A.id_estado_amortizacion IN (134, 135, 136)
      AND A.eliminado = 0
      AND I.eliminado = 0
      AND (p_id_grupo_familiar IS NULL OR I.id_grupo_familiar = p_id_grupo_familiar)
      AND (p_id_propietario IS NULL OR I.id_propietario = p_id_propietario)

    UNION ALL

    -- 2. Capital bonos (Capital Largo Plazo: Total Capital Invertido menos Bonos vencimiento próximo posteriores a la primera cuota)
    SELECT 'Capital bonos' as detalle,
           GREATEST(0, COALESCE(SUM(I.capital_invertido), 0) - (
               SELECT COALESCE(SUM(A2.capital), 0)
               FROM amortizacion A2
               JOIN inversion I2 ON A2.id_inversion = I2.id_inversion
               JOIN instrumento INS2 ON I2.id_instrumento = INS2.id_instrumento
               WHERE A2.fecha_pago > p_fecha_inicio
                 AND A2.fecha_pago <= LAST_DAY(DATE_ADD(STR_TO_DATE(p_fecha_inicio, '%Y-%m-%d'), INTERVAL 11 MONTH))
                 AND I2.fecha_venta IS NULL
                 AND A2.id_estado_amortizacion IN (134, 135, 136)
                 AND A2.eliminado = 0
                 AND I2.eliminado = 0
                 AND (p_id_grupo_familiar IS NULL OR I2.id_grupo_familiar = p_id_grupo_familiar)
                 AND (p_id_propietario IS NULL OR I2.id_propietario = p_id_propietario)
                 AND INS2.id_tipo_inversion = 4
                 AND A2.fecha_pago > (
                     SELECT MIN(A3.fecha_pago)
                     FROM amortizacion A3
                     WHERE A3.id_inversion = A2.id_inversion
                       AND A3.eliminado = 0
                 )
           )) as valor
    FROM inversion I
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE I.id_estado_inversion = 128
      AND I.eliminado = 0
      AND (p_id_grupo_familiar IS NULL OR I.id_grupo_familiar = p_id_grupo_familiar)
      AND (p_id_propietario IS NULL OR I.id_propietario = p_id_propietario)
      AND INS.id_tipo_inversion = 4
      AND INS.fecha_vencimiento > p_fecha_inicio
      AND I.fecha_venta IS NULL

    UNION ALL

    -- 3. Bonos vencimiento próximo (Capital hasta el último día del mes 11 desde fecha_inicio)
    SELECT 'Bonos vencimiento próximo' as detalle,
           COALESCE(SUM(A.capital), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND A.fecha_pago <= LAST_DAY(DATE_ADD(STR_TO_DATE(p_fecha_inicio, '%Y-%m-%d'), INTERVAL 11 MONTH))
      AND I.fecha_venta IS NULL
      AND A.id_estado_amortizacion IN (134, 135, 136)
      AND A.eliminado = 0
      AND I.eliminado = 0
      AND (p_id_grupo_familiar IS NULL OR I.id_grupo_familiar = p_id_grupo_familiar)
      AND (p_id_propietario IS NULL OR I.id_propietario = p_id_propietario)
      AND INS.id_tipo_inversion = 4

    UNION ALL

    -- 4. Obligaciones
    SELECT 'Obligaciones' as detalle,
           COALESCE(SUM(A.capital), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND I.fecha_venta IS NULL
      AND A.id_estado_amortizacion IN (134, 135, 136)
      AND A.eliminado = 0
      AND I.eliminado = 0
      AND (p_id_grupo_familiar IS NULL OR I.id_grupo_familiar = p_id_grupo_familiar)
      AND (p_id_propietario IS NULL OR I.id_propietario = p_id_propietario)
      AND INS.id_tipo_inversion = 5

    UNION ALL

    -- 5. Papeles Comerciales
    SELECT 'Papeles Comerciales' as detalle,
           COALESCE(SUM(A.capital), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND I.fecha_venta IS NULL
      AND A.id_estado_amortizacion IN (134, 135, 136)
      AND A.eliminado = 0
      AND I.eliminado = 0
      AND (p_id_grupo_familiar IS NULL OR I.id_grupo_familiar = p_id_grupo_familiar)
      AND (p_id_propietario IS NULL OR I.id_propietario = p_id_propietario)
      AND INS.id_tipo_inversion = 3

    UNION ALL

    -- 6. Notas Crédito (Consulta directa a Inversión sin requerir Amortización)
    SELECT 'Notas Crédito' as detalle,
           COALESCE(SUM(I.capital_invertido), 0) as valor
    FROM inversion I
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE I.fecha_venta IS NULL
      AND I.id_estado_inversion = 128
      AND I.eliminado = 0
      AND (p_id_grupo_familiar IS NULL OR I.id_grupo_familiar = p_id_grupo_familiar)
      AND (p_id_propietario IS NULL OR I.id_propietario = p_id_propietario)
      AND INS.id_tipo_inversion = 91

    UNION ALL

    -- 7. Acciones Pago Interes
    SELECT 'Acciones Pago Interes' as detalle,
           COALESCE(SUM(A.capital), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND I.fecha_venta IS NULL
      AND A.id_estado_amortizacion IN (134, 135, 136)
      AND A.eliminado = 0
      AND I.eliminado = 0
      AND (p_id_grupo_familiar IS NULL OR I.id_grupo_familiar = p_id_grupo_familiar)
      AND (p_id_propietario IS NULL OR I.id_propietario = p_id_propietario)
      AND INS.id_tipo_inversion = 73

    UNION ALL

    -- 8. Acciones Sin Interés (Calculado con costo base remanente exacto)
    SELECT 'Acciones Sin Interés' as detalle,
           FN_ACCION_COSTO_INVERTIDO(p_id_propietario, p_id_grupo_familiar) as valor

    UNION ALL

    -- 9. Dividendos en Acciones
    SELECT 'Dividendos en Acciones' as detalle,
           COALESCE(SUM(ao.valor_neto), 0) as valor
    FROM sipro_desa.accion_operacion ao
    WHERE ao.activo = 1
      AND ao.eliminado = 0
      AND p_incluir_dividendos = 1
      AND ao.id_tipo_operacion IN (206, 207)
      AND (p_id_propietario IS NULL OR ao.id_persona = p_id_propietario)
      AND (p_id_grupo_familiar IS NULL OR ao.id_persona IN (
          SELECT gfp.id_persona 
          FROM sipro_desa.grupo_familiar_persona gfp 
          WHERE gfp.id_grupo_familiar = p_id_grupo_familiar
      ))

    UNION ALL

    -- 10. Plusvalía Acciones (Valor de mercado remanente menos costo base menos dividendos)
    SELECT 'Plusvalía Acciones' as detalle,
           CASE 
               WHEN p_incluir_plusvalia = 1 THEN
                   GREATEST(0, COALESCE((
                       SELECT SUM(
                           (pe.cantidad_actual * IFNULL(aup.precio_ultimo, 0))
                       )
                       FROM sipro_desa.vw_accion_posicion pe
                       LEFT JOIN sipro_desa.accion_ultimo_precio aup ON aup.id_emisor = pe.id_emisor
                       WHERE (p_id_propietario IS NULL OR pe.id_persona = p_id_propietario)
                         AND (p_id_grupo_familiar IS NULL OR pe.id_persona IN (
                             SELECT gfp.id_persona FROM sipro_desa.grupo_familiar_persona gfp WHERE gfp.id_grupo_familiar = p_id_grupo_familiar
                         ))
                   ), 0) 
                   - FN_ACCION_COSTO_INVERTIDO(p_id_propietario, p_id_grupo_familiar)
                   - (CASE WHEN p_incluir_dividendos = 1 THEN (
                       SELECT COALESCE(SUM(ao.valor_neto), 0)
                       FROM sipro_desa.accion_operacion ao
                       WHERE ao.activo = 1 AND ao.eliminado = 0 AND ao.id_tipo_operacion IN (206, 207)
                         AND (p_id_propietario IS NULL OR ao.id_persona = p_id_propietario)
                         AND (p_id_grupo_familiar IS NULL OR ao.id_persona IN (
                             SELECT gfp.id_persona FROM sipro_desa.grupo_familiar_persona gfp WHERE gfp.id_grupo_familiar = p_id_grupo_familiar
                         ))
                   ) ELSE 0 END))
               ELSE 0
           END as valor

    UNION ALL

    -- 11. Titularizaciones
    SELECT 'Titularizaciones' as detalle,
           COALESCE(SUM(A.capital), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND I.fecha_venta IS NULL
      AND A.id_estado_amortizacion IN (134, 135, 136)
      AND A.eliminado = 0
      AND I.eliminado = 0
      AND (p_id_grupo_familiar IS NULL OR I.id_grupo_familiar = p_id_grupo_familiar)
      AND (p_id_propietario IS NULL OR I.id_propietario = p_id_propietario)
      AND INS.id_tipo_inversion = 75

    UNION ALL

    -- 12. Total Corriente
    SELECT 'Total Corriente' as detalle,
           COALESCE(SUM(ov.valor), 0) as valor
    FROM otro_valor ov
    WHERE ov.activo = 1
      AND ov.eliminado = 0
      AND (p_id_grupo_familiar IS NULL OR ov.id_grupo_familiar = p_id_grupo_familiar)
      AND (p_id_propietario IS NULL OR ov.id_propietario = p_id_propietario);

    -- RETORNAR TODOS LOS RUBROS MÁS EL TOTAL CALCULADO DIRECTAMENTE DE LA TABLA TEMPORAL
    SELECT detalle, valor FROM temp_patrimonio_resultado
    UNION ALL
    SELECT 'TOTAL' as detalle, COALESCE(SUM(valor), 0) as valor FROM temp_patrimonio_resultado;

    -- Eliminar la tabla temporal de la sesión
    DROP TEMPORARY TABLE IF EXISTS temp_patrimonio_resultado;
END$$
DELIMITER ;
