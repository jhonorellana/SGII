CREATE DEFINER=`root`@`localhost` PROCEDURE `SP_PATRIMONIO_CONSOLIDADO`(
    IN p_fecha_inicio VARCHAR(10),
    IN p_fecha_fin VARCHAR(10),
    IN p_id_grupo_familiar INT,
    IN p_id_propietario INT
)
BEGIN
    -- Intereses esperados
    SELECT 'Intereses esperados' as detalle,
           COALESCE(SUM(A.interes), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND A.fecha_pago <= p_fecha_fin
      AND I.fecha_venta IS NULL
      AND A.activo = 1
      AND A.eliminado = 0
      AND I.eliminado = 0

    UNION ALL

    -- Capital bonos (usando activo para vencimiento próximo)
    SELECT 'Capital bonos' as detalle,
           COALESCE(SUM(I.capital_invertido), 0) as valor
    FROM inversion I
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE I.activo = 1
      AND I.eliminado = 0
      AND INS.id_tipo_inversion = 4
      AND INS.fecha_vencimiento > p_fecha_inicio
      AND I.fecha_venta is null

    UNION ALL

    -- Bonos vencimiento próximo (activo controla esto)
    SELECT 'Bonos vencimiento próximo' as detalle,
           COALESCE(SUM(A.capital), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND I.fecha_venta IS NULL
      AND A.activo = 1
      AND A.eliminado = 0
      AND I.eliminado = 0
      AND INS.id_tipo_inversion = 4

    UNION ALL

    -- Obligaciones
    SELECT 'Obligaciones' as detalle,
           COALESCE(SUM(A.capital), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND I.fecha_venta IS NULL
      AND A.activo = 1
      AND A.eliminado = 0
      AND I.eliminado = 0
      AND INS.id_tipo_inversion = 5

    UNION ALL

    -- Papeles Comerciales
    SELECT 'Papeles Comerciales' as detalle,
           COALESCE(SUM(A.capital), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND I.fecha_venta IS NULL
      AND A.activo = 1
      AND A.eliminado = 0
      AND I.eliminado = 0
      AND INS.id_tipo_inversion = 3

    UNION ALL

    -- Notas Crédito
    SELECT 'Notas Crédito' as detalle,
           COALESCE(SUM(A.capital), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND I.fecha_venta IS NULL
      AND A.activo = 1
      AND A.eliminado = 0
      AND I.eliminado = 0
      AND INS.id_tipo_inversion = 91

    UNION ALL

    -- Acciones
    SELECT 'Acciones' as detalle,
           COALESCE(SUM(A.capital), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND I.fecha_venta IS NULL
      AND A.activo = 1
      AND A.eliminado = 0
      AND I.eliminado = 0
      AND INS.id_tipo_inversion = 73

    UNION ALL

    -- Titularizaciones
    SELECT 'Titularizaciones' as detalle,
           COALESCE(SUM(A.capital), 0) as valor
    FROM amortizacion A
    JOIN inversion I ON A.id_inversion = I.id_inversion
    JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
    WHERE A.fecha_pago > p_fecha_inicio
      AND I.fecha_venta IS NULL
      AND A.activo = 1
      AND A.eliminado = 0
      AND I.eliminado = 0
      AND INS.id_tipo_inversion = 75

    UNION ALL

    -- Otros Valores (con filtros de grupo y propietario)
    SELECT 'Total Corriente' as detalle,
           COALESCE(SUM(ov.valor), 0) as valor
    FROM otro_valor ov
    WHERE ov.activo = 1
      AND ov.eliminado = 0
--      AND (ov.fecha_desde IS NULL OR ov.fecha_desde <= p_fecha_fin)
--      AND (ov.fecha_hasta IS NULL OR ov.fecha_hasta >= p_fecha_inicio)
      AND (p_id_grupo_familiar IS NULL OR ov.id_grupo_familiar = p_id_grupo_familiar)
      AND (p_id_propietario IS NULL OR ov.id_propietario = p_id_propietario)

    UNION ALL

    -- TOTAL (calculo de suma de todas las categorías)
    SELECT 'TOTAL' as detalle,
           (
               SELECT COALESCE(SUM(A.interes), 0)
               FROM amortizacion A
               JOIN inversion I ON A.id_inversion = I.id_inversion
               JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
               WHERE A.fecha_pago > p_fecha_inicio
                 AND A.fecha_pago <= p_fecha_fin
                 AND I.fecha_venta IS NULL
                 AND A.activo = 1
                 AND A.eliminado = 0
                 AND I.eliminado = 0
           ) +
           (
               SELECT COALESCE(SUM(I.capital_invertido), 0)
               FROM inversion I
               JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
               WHERE I.activo = 1
                 AND I.eliminado = 0
                 AND INS.id_tipo_inversion = 4
                 AND INS.fecha_vencimiento > p_fecha_inicio
           ) +
           (
               SELECT COALESCE(SUM(A.capital), 0)
               FROM amortizacion A
               JOIN inversion I ON A.id_inversion = I.id_inversion
               JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
               WHERE A.fecha_pago > p_fecha_inicio
                 AND I.fecha_venta IS NULL
                 AND A.activo = 1
                 AND A.eliminado = 0
                 AND I.eliminado = 0
                 AND INS.id_tipo_inversion = 4
				 AND I.fecha_venta is null
           ) +
           (
               SELECT COALESCE(SUM(A.capital), 0)
               FROM amortizacion A
               JOIN inversion I ON A.id_inversion = I.id_inversion
               JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
               WHERE A.fecha_pago > p_fecha_inicio
                 AND I.fecha_venta IS NULL
                 AND A.activo = 1
                 AND A.eliminado = 0
                 AND I.eliminado = 0
                 AND INS.id_tipo_inversion = 5
           ) +
           (
               SELECT COALESCE(SUM(A.capital), 0)
               FROM amortizacion A
               JOIN inversion I ON A.id_inversion = I.id_inversion
               JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
               WHERE A.fecha_pago > p_fecha_inicio
                 AND I.fecha_venta IS NULL
                 AND A.activo = 1
                 AND A.eliminado = 0
                 AND I.eliminado = 0
                 AND INS.id_tipo_inversion = 3
           ) +
           (
               SELECT COALESCE(SUM(A.capital), 0)
               FROM amortizacion A
               JOIN inversion I ON A.id_inversion = I.id_inversion
               JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
               WHERE A.fecha_pago > p_fecha_inicio
                 AND I.fecha_venta IS NULL
                 AND A.activo = 1
                 AND A.eliminado = 0
                 AND I.eliminado = 0
                 AND INS.id_tipo_inversion = 91
           ) +
           (
               SELECT COALESCE(SUM(A.capital), 0)
               FROM amortizacion A
               JOIN inversion I ON A.id_inversion = I.id_inversion
               JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
               WHERE A.fecha_pago > p_fecha_inicio
                 AND I.fecha_venta IS NULL
                 AND A.activo = 1
                 AND A.eliminado = 0
                 AND I.eliminado = 0
                 AND INS.id_tipo_inversion = 73
           ) +
           (
               SELECT COALESCE(SUM(A.capital), 0)
               FROM amortizacion A
               JOIN inversion I ON A.id_inversion = I.id_inversion
               JOIN instrumento INS ON I.id_instrumento = INS.id_instrumento
               WHERE A.fecha_pago > p_fecha_inicio
                 AND I.fecha_venta IS NULL
                 AND A.activo = 1
                 AND A.eliminado = 0
                 AND I.eliminado = 0
                 AND INS.id_tipo_inversion = 75
           ) +
           (
               SELECT COALESCE(SUM(ov.valor), 0)
               FROM otro_valor ov
               WHERE ov.activo = 1
                 AND ov.eliminado = 0
--                 AND (ov.fecha_desde IS NULL OR ov.fecha_desde <= p_fecha_fin)
--                 AND (ov.fecha_hasta IS NULL OR ov.fecha_hasta >= p_fecha_inicio)
                 AND (p_id_grupo_familiar IS NULL OR ov.id_grupo_familiar = p_id_grupo_familiar)
                 AND (p_id_propietario IS NULL OR ov.id_propietario = p_id_propietario)
           ) as valor;
END