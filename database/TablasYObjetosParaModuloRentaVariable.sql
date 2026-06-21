CREATE TABLE `acciones_ultimas_transacciones` (
  `id_accion_ultima_transaccion` bigint(20) NOT NULL,
  `fecha_corte` date NOT NULL,
  `emisor` varchar(200) NOT NULL,
  `fecha_ultima_transaccion` date DEFAULT NULL,
  `precio_maximo` decimal(18,8) DEFAULT NULL,
  `precio_minimo` decimal(18,8) DEFAULT NULL,
  `precio_promedio` decimal(18,8) DEFAULT NULL,
  `numero_transacciones` int(11) DEFAULT NULL,
  `numero_acciones` decimal(18,2) DEFAULT NULL,
  `valor_efectivo` decimal(18,2) DEFAULT NULL,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `accion_ultimo_precio` (
  `id_accion_ultimo_precio` int(11) NOT NULL AUTO_INCREMENT,
  `id_emisor` int(11) NOT NULL,
  `emisor` varchar(150) NOT NULL,
  `fecha_ultimo_precio` date NOT NULL,
  `precio_ultimo` decimal(18,6) NOT NULL,
  `precio_anterior` decimal(18,6) DEFAULT NULL,
  `variacion_precio` decimal(18,6) DEFAULT NULL,
  `variacion_porcentaje` decimal(18,6) DEFAULT NULL,
  `precio_minimo_dia` decimal(18,6) DEFAULT NULL,
  `precio_maximo_dia` decimal(18,6) DEFAULT NULL,
  `volumen_ultimo_dia` bigint(20) DEFAULT NULL,
  `valor_ultimo_dia` decimal(18,2) DEFAULT NULL,
  `transacciones_ultimo_dia` int(11) DEFAULT NULL,
  `precio_minimo_30d` decimal(18,6) DEFAULT NULL,
  `precio_maximo_30d` decimal(18,6) DEFAULT NULL,
  `precio_promedio_30d` decimal(18,6) DEFAULT NULL,
  `dias_sin_negociacion` int(11) DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_accion_ultimo_precio`),
  UNIQUE KEY `uk_accion_ultimo_precio_emisor` (`id_emisor`),
  KEY `idx_emisor` (`id_emisor`),
  KEY `idx_fecha_ultimo_precio` (`fecha_ultimo_precio`)
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



CREATE TABLE `accion_dividendo` (
  `id_accion_dividendo` int(11) NOT NULL AUTO_INCREMENT,
  `id_persona` int(11) NOT NULL,
  `id_instrumento` int(11) NOT NULL,
  `id_tipo_dividendo` int(11) NOT NULL,
  `fecha_declaracion` date DEFAULT NULL,
  `fecha_corte` date DEFAULT NULL,
  `fecha_pago` date NOT NULL,
  `cantidad_acciones_base` decimal(18,6) NOT NULL,
  `dividendo_por_accion` decimal(18,6) DEFAULT NULL,
  `valor_bruto` decimal(18,2) DEFAULT 0.00,
  `retencion` decimal(18,2) DEFAULT 0.00,
  `valor_neto` decimal(18,2) DEFAULT 0.00,
  `acciones_recibidas` decimal(18,6) DEFAULT 0.000000,
  `factor_acciones` decimal(18,6) DEFAULT NULL,
  `precio_referencial_accion` decimal(18,6) DEFAULT NULL,
  `valor_referencial_acciones` decimal(18,2) DEFAULT NULL,
  `id_cuenta_bancaria` int(11) DEFAULT NULL,
  `observacion` varchar(500) DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `eliminado` tinyint(1) DEFAULT 0,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_accion_dividendo`),
  KEY `idx_accion_dividendo_persona` (`id_persona`),
  KEY `idx_accion_dividendo_instrumento` (`id_instrumento`),
  KEY `idx_accion_dividendo_fecha_pago` (`fecha_pago`),
  KEY `idx_accion_dividendo_tipo` (`id_tipo_dividendo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



CREATE TABLE `accion_operacion` (
  `id_accion_operacion` int(11) NOT NULL AUTO_INCREMENT,
  `id_inversion` int(11) DEFAULT NULL,
  `id_instrumento` int(11) NOT NULL,
  `id_persona` int(11) NOT NULL,
  `id_tipo_operacion` int(11) NOT NULL,
  `id_movimiento_capital` int(11) DEFAULT NULL,
  `fecha_operacion` date NOT NULL,
  `liquidacion` varchar(50) DEFAULT NULL,
  `cantidad` decimal(18,6) NOT NULL,
  `precio_unitario` decimal(18,6) NOT NULL,
  `valor_bruto` decimal(18,2) NOT NULL,
  `comision_bolsa` decimal(18,2) DEFAULT 0.00,
  `comision_operador` decimal(18,2) DEFAULT 0.00,
  `total_comisiones` decimal(18,2) DEFAULT 0.00,
  `valor_neto` decimal(18,2) NOT NULL,
  `costo_promedio_unitario` decimal(18,6) DEFAULT NULL,
  `utilidad_perdida` decimal(18,2) DEFAULT NULL,
  `observacion` varchar(500) DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `eliminado` tinyint(1) DEFAULT 0,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_accion_operacion`),
  KEY `idx_accion_operacion_inversion` (`id_inversion`),
  KEY `idx_accion_operacion_instrumento` (`id_instrumento`),
  KEY `idx_accion_operacion_persona` (`id_persona`),
  KEY `idx_accion_operacion_fecha` (`fecha_operacion`),
  KEY `idx_accion_operacion_tipo` (`id_tipo_operacion`),
  KEY `idx_accion_operacion_movimiento_capital` (`id_movimiento_capital`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



CREATE 
    ALGORITHM = UNDEFINED 
    DEFINER = `root`@`localhost` 
    SQL SECURITY DEFINER
VIEW `vw_accion_posicion` AS
    SELECT 
        `ao`.`id_persona` AS `id_persona`,
        CONCAT(`p`.`nombres`, ' ', `p`.`apellidos`) AS `persona`,
        `ao`.`id_instrumento` AS `id_instrumento`,
        `i`.`nombre` AS `instrumento`,
        `i`.`id_emisor` AS `id_emisor`,
        MIN(`ao`.`fecha_operacion`) AS `fecha_primera_operacion`,
        MAX(`ao`.`fecha_operacion`) AS `fecha_ultima_operacion`,
        SUM(CASE
            WHEN `ao`.`id_tipo_operacion` IN (204 , 206, 207, 212) THEN `ao`.`cantidad`
            WHEN `ao`.`id_tipo_operacion` IN (205 , 208) THEN - `ao`.`cantidad`
            ELSE 0
        END) AS `cantidad_actual`,
        `aup`.`precio_ultimo` AS `precio_ultimo`,
        `aup`.`fecha_ultimo_precio` AS `fecha_ultimo_precio`,
        ROUND(SUM(CASE
                    WHEN `ao`.`id_tipo_operacion` IN (204 , 206, 207, 212) THEN `ao`.`cantidad`
                    WHEN `ao`.`id_tipo_operacion` IN (205 , 208) THEN - `ao`.`cantidad`
                    ELSE 0
                END) * IFNULL(`aup`.`precio_ultimo`, 0),
                2) AS `valor_mercado`
    FROM
        (((`accion_operacion` `ao`
        JOIN `persona` `p` ON (`p`.`id_persona` = `ao`.`id_persona`))
        JOIN `instrumento` `i` ON (`i`.`id_instrumento` = `ao`.`id_instrumento`))
        LEFT JOIN `accion_ultimo_precio` `aup` ON (`aup`.`id_emisor` = `i`.`id_emisor`))
    WHERE
        `ao`.`activo` = 1
            AND `ao`.`eliminado` = 0
    GROUP BY `ao`.`id_persona` , `p`.`nombres` , `p`.`apellidos` , `ao`.`id_instrumento` , `i`.`nombre` , `i`.`id_emisor` , `aup`.`precio_ultimo` , `aup`.`fecha_ultimo_precio`
    HAVING `cantidad_actual` <> 0





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


Execute:
> select * from catalogo where id_catalogo in (17, 18)

+ ---------------- + ----------- + ----------- + ---------------- + ----------- + ------------------- + ------------------------ +
| id_catalogo      | codigo      | nombre      | descripcion      | activo      | fecha_creacion      | fecha_actualizacion      |
+ ---------------- + ----------- + ----------- + ---------------- + ----------- + ------------------- + ------------------------ +
| 17               | TIPO_OPERACION_ACCION | Tipo de operaciones con acciones | Tipo de operaciones con acciones | 1           | 2026-06-20 12:53:24 | 2026-06-20 12:53:24      |
| 18               | TIPO_DIVIDENDO | Tipo de dividendo recibido por acciones | Tipo de dividendo recibido por acciones | 1           | 2026-06-20 12:53:24 | 2026-06-20 12:53:24      |
| NULL             | NULL        | NULL        | NULL             | NULL        | NULL                | NULL                     |
+ ---------------- + ----------- + ----------- + ---------------- + ----------- + ------------------- + ------------------------ +
3 rows

Execute:
> select * from catalogo_valor where id_catalogo in (17, 18)

+ ---------------------- + ---------------- + ----------- + ----------- + ---------------- + ----------------- + ----------- + ------------------- + ------------------------ +
| id_catalogo_valor      | id_catalogo      | codigo      | nombre      | descripcion      | orden_visual      | activo      | fecha_creacion      | fecha_actualizacion      |
+ ---------------------- + ---------------- + ----------- + ----------- + ---------------- + ----------------- + ----------- + ------------------- + ------------------------ +
| 204                    | 17               | COMPRA_ACCION | Compra de Acciones | Compra de Acciones | 1                 | 1           | 2026-06-20 13:00:38 | 2026-06-20 13:00:38      |
| 205                    | 17               | VENTA_ACCION | Venta de Acciones | Venta de Acciones | 2                 | 1           | 2026-06-20 13:00:38 | 2026-06-20 13:00:38      |
| 206                    | 17               | BONIF_ACCIONES | Dividendo Acciones | Dividendo Acciones | 3                 | 1           | 2026-06-20 13:00:38 | 2026-06-20 13:02:51      |
| 207                    | 17               | AJUS_POS_ACC | Ajuste Positivo acciones | Ajuste Positivo acciones | 4                 | 1           | 2026-06-20 13:00:38 | 2026-06-20 13:00:38      |
| 208                    | 17               | AJUS_NEG_ACC | Ajuste Negativo Acciones | Ajuste Negativo Acciones | 5                 | 1           | 2026-06-20 13:00:38 | 2026-06-20 13:00:38      |
| 212                    | 17               | SPLIT_ACCION | Split de acciones | Split de acciones | 6                 | 1           | 2026-06-20 13:03:52 | 2026-06-20 13:07:36      |
| 209                    | 18               | DIV_EFECTIVO | Dividendo en efectivo | Dividendo en efectivo | 1                 | 1           | 2026-06-20 13:00:38 | 2026-06-20 13:00:38      |
| 210                    | 18               | DIV_ACCIONES | Dividendo en acciones | Dividendo en acciones | 2                 | 1           | 2026-06-20 13:00:38 | 2026-06-20 13:00:38      |
| 211                    | 18               | DIV_MIXTO   | Dividendo mixto | Dividendo mixto  | 3                 | 1           | 2026-06-20 13:00:38 | 2026-06-20 13:00:38      |
| NULL                   | NULL             | NULL        | NULL        | NULL             | NULL              | NULL        | NULL                | NULL                     |
+ ---------------------- + ---------------- + ----------- + ----------- + ---------------- + ----------------- + ----------- + ------------------- + ------------------------ +
10 rows

