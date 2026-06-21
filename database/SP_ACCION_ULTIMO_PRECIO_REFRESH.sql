CREATE DEFINER=`root`@`localhost` PROCEDURE `SP_ACCION_ULTIMO_PRECIO_REFRESH`()
BEGIN

    /*
      1. Crear emisores faltantes en catalogo_valor.
      Regla:
      catalogo_valor.id_catalogo_valor = inversion.shares.SHA_ISSUER_ID
      catalogo_valor.id_catalogo = 3
    */

    INSERT INTO sipro_desa.catalogo_valor
    (
        id_catalogo_valor,
        id_catalogo,
        codigo,
        nombre,
        descripcion,
        orden_visual,
        activo,
        fecha_creacion,
        fecha_actualizacion
    )
    SELECT
        S.SHA_ISSUER_ID AS id_catalogo_valor,
        3 AS id_catalogo,
        LEFT(UPPER(S.SHA_ISSUER), 10) AS codigo,
        S.SHA_ISSUER AS nombre,
        S.SHA_ISSUER AS descripcion,
        1 AS orden_visual,
        1 AS activo,
        NOW() AS fecha_creacion,
        NOW() AS fecha_actualizacion
    FROM
    (
        SELECT
            SHA_ISSUER_ID,
            MAX(SHA_ISSUER) AS SHA_ISSUER
        FROM inversion.shares
        WHERE SHA_ISSUER_ID IS NOT NULL
          AND SHA_ISSUER IS NOT NULL
          AND SHA_TYPE = 'ACCIONES'
          AND SHA_PRICE > 0
          AND SHA_NUMBER > 0
          AND SHA_CASH_VALUE > 0
        GROUP BY SHA_ISSUER_ID
    ) S
    LEFT JOIN sipro_desa.catalogo_valor C
        ON C.id_catalogo_valor = S.SHA_ISSUER_ID
       AND C.id_catalogo = 3
    WHERE C.id_catalogo_valor IS NULL;


    /*
      2. Refrescar tabla de último precio (ON DUPLICATE KEY UPDATE)
      Evita truncar la tabla para no dejarla vacía en consultas concurrentes.
    */

    INSERT INTO sipro_desa.accion_ultimo_precio
    (
        id_emisor,
        emisor,
        fecha_ultimo_precio,
        precio_ultimo,
        precio_minimo_dia,
        precio_maximo_dia,
        volumen_ultimo_dia,
        valor_ultimo_dia,
        transacciones_ultimo_dia,
        precio_minimo_30d,
        precio_maximo_30d,
        precio_promedio_30d,
        dias_sin_negociacion
    )
    SELECT
        M.id_emisor AS id_emisor,
        S.SHA_ISSUER AS emisor,
        S.SHA_DATE AS fecha_ultimo_precio,

        ROUND(SUM(S.SHA_CASH_VALUE) / NULLIF(SUM(S.SHA_NUMBER), 0), 6) AS precio_ultimo,
        ROUND(MIN(S.SHA_PRICE), 6) AS precio_minimo_dia,
        ROUND(MAX(S.SHA_PRICE), 6) AS precio_maximo_dia,

        SUM(S.SHA_NUMBER) AS volumen_ultimo_dia,
        ROUND(SUM(S.SHA_CASH_VALUE), 2) AS valor_ultimo_dia,
        COUNT(*) AS transacciones_ultimo_dia,

        NULL AS precio_minimo_30d,
        NULL AS precio_maximo_30d,
        NULL AS precio_promedio_30d,

        DATEDIFF(CURDATE(), S.SHA_DATE) AS dias_sin_negociacion

    FROM inversion.shares S
    INNER JOIN sipro_desa.map_emisor_legacy M
        ON M.id_emisor_legacy = S.SHA_ISSUER_ID
    INNER JOIN
    (
        SELECT
            SHA_ISSUER_ID,
            MAX(SHA_DATE) AS fecha_ultimo_precio
        FROM inversion.shares
        WHERE SHA_TYPE = 'ACCIONES'
          AND SHA_PRICE > 0
          AND SHA_NUMBER > 0
          AND SHA_CASH_VALUE > 0
        GROUP BY SHA_ISSUER_ID
    ) U
        ON U.SHA_ISSUER_ID = S.SHA_ISSUER_ID
       AND U.fecha_ultimo_precio = S.SHA_DATE

    WHERE S.SHA_TYPE = 'ACCIONES'
      AND S.SHA_PRICE > 0
      AND S.SHA_NUMBER > 0
      AND S.SHA_CASH_VALUE > 0

    GROUP BY
        M.id_emisor,
        S.SHA_ISSUER,
        S.SHA_DATE
    ON DUPLICATE KEY UPDATE
        emisor = VALUES(emisor),
        fecha_ultimo_precio = VALUES(fecha_ultimo_precio),
        precio_ultimo = VALUES(precio_ultimo),
        precio_minimo_dia = VALUES(precio_minimo_dia),
        precio_maximo_dia = VALUES(precio_maximo_dia),
        volumen_ultimo_dia = VALUES(volumen_ultimo_dia),
        valor_ultimo_dia = VALUES(valor_ultimo_dia),
        transacciones_ultimo_dia = VALUES(transacciones_ultimo_dia),
        precio_minimo_30d = VALUES(precio_minimo_30d),
        precio_maximo_30d = VALUES(precio_maximo_30d),
        precio_promedio_30d = VALUES(precio_promedio_30d),
        dias_sin_negociacion = VALUES(dias_sin_negociacion);


    /*
      3. Actualizar precio anterior y variaciones
    */

    UPDATE sipro_desa.accion_ultimo_precio A
    LEFT JOIN
    (
        SELECT
            M.id_emisor,
            ROUND(SUM(P.SHA_CASH_VALUE) / NULLIF(SUM(P.SHA_NUMBER), 0), 6) AS precio_anterior
        FROM inversion.shares P
        INNER JOIN sipro_desa.map_emisor_legacy M
            ON M.id_emisor_legacy = P.SHA_ISSUER_ID
        INNER JOIN
        (
            SELECT
                M2.id_emisor_legacy,
                MAX(X.SHA_DATE) AS fecha_anterior
            FROM inversion.shares X
            INNER JOIN sipro_desa.map_emisor_legacy M2
                ON M2.id_emisor_legacy = X.SHA_ISSUER_ID
            INNER JOIN sipro_desa.accion_ultimo_precio A2
                ON A2.id_emisor = M2.id_emisor
            WHERE X.SHA_TYPE = 'ACCIONES'
              AND X.SHA_PRICE > 0
              AND X.SHA_NUMBER > 0
              AND X.SHA_CASH_VALUE > 0
              AND X.SHA_DATE < A2.fecha_ultimo_precio
            GROUP BY M2.id_emisor_legacy
        ) UA
            ON UA.id_emisor_legacy = P.SHA_ISSUER_ID
           AND UA.fecha_anterior = P.SHA_DATE
        WHERE P.SHA_TYPE = 'ACCIONES'
          AND P.SHA_PRICE > 0
          AND P.SHA_NUMBER > 0
          AND P.SHA_CASH_VALUE > 0
        GROUP BY M.id_emisor
    ) B
        ON B.id_emisor = A.id_emisor
    SET
        A.precio_anterior = B.precio_anterior,
        A.variacion_precio =
            CASE
                WHEN B.precio_anterior IS NULL THEN NULL
                ELSE ROUND(A.precio_ultimo - B.precio_anterior, 6)
            END,
        A.variacion_porcentaje =
            CASE
                WHEN B.precio_anterior IS NULL OR B.precio_anterior = 0 THEN NULL
                ELSE ROUND(((A.precio_ultimo - B.precio_anterior) / B.precio_anterior) * 100, 6)
            END;


    /*
      4. Actualizar indicadores últimos 30 días
    */

    UPDATE sipro_desa.accion_ultimo_precio A
    LEFT JOIN
    (
        SELECT
            D.id_emisor,
            ROUND(MIN(D.precio_diario), 6) AS precio_minimo_30d,
            ROUND(MAX(D.precio_diario), 6) AS precio_maximo_30d,
            ROUND(AVG(D.precio_diario), 6) AS precio_promedio_30d
        FROM
        (
            SELECT
                M.id_emisor,
                S2.SHA_DATE,
                SUM(S2.SHA_CASH_VALUE) / NULLIF(SUM(S2.SHA_NUMBER), 0) AS precio_diario
            FROM inversion.shares S2
            INNER JOIN sipro_desa.map_emisor_legacy M
                ON M.id_emisor_legacy = S2.SHA_ISSUER_ID
            INNER JOIN sipro_desa.accion_ultimo_precio A3
                ON A3.id_emisor = M.id_emisor
            WHERE S2.SHA_TYPE = 'ACCIONES'
              AND S2.SHA_PRICE > 0
              AND S2.SHA_NUMBER > 0
              AND S2.SHA_CASH_VALUE > 0
              AND S2.SHA_DATE BETWEEN DATE_SUB(A3.fecha_ultimo_precio, INTERVAL 30 DAY)
                                  AND A3.fecha_ultimo_precio
            GROUP BY
                M.id_emisor,
                S2.SHA_DATE
        ) D
        GROUP BY D.id_emisor
    ) R
        ON R.id_emisor = A.id_emisor
    SET
        A.precio_minimo_30d = R.precio_minimo_30d,
        A.precio_maximo_30d = R.precio_maximo_30d,
        A.precio_promedio_30d = R.precio_promedio_30d;

END