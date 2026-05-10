CREATE DEFINER=`root`@`localhost` PROCEDURE `SP_AMORTIZATION_SUMMARY_BY_DATES`(IN `_initialDate` DATE, IN `_finalDate` DATE)
BEGIN
    SELECT
        am_fecha_pago AS fecha, 
        inv_propietario AS propietario,
        LEFT(inv_emisor, LENGTH(inv_emisor) - 10) AS empresa,
        SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_interes ELSE 0 END) AS interes,
		SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_capital ELSE 0 END) AS capital,
        SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_descuento ELSE 0 END) AS descuento,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_interes ELSE 0 END) AS interes_moroso,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_capital ELSE 0 END) AS capital_moroso,
        SUM(CASE WHEN A.am_pagada = 2 THEN am_descuento ELSE 0 END) AS descuento_moroso,
        sum(am_interes + am_capital) AS total
    FROM amortizacion A, inversion I
    WHERE am_fecha_pago between _initialDate and _finalDate
       -- and is_active = 1
       -- and inv_fecha_venta is null
       and A.is_active = 1
       and A.is_deleted = 0
	   and I.is_deleted = 0
       and A.inv_id = I.id
	GROUP by fecha, propietario, empresa
    
            UNION
    SELECT
        "X" AS fecha,
        "" AS propietario,
        "TOTAL" AS empresa,
        SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_interes ELSE 0 END) AS interes,
		SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_capital ELSE 0 END) AS capital,
        SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_descuento ELSE 0 END) AS descuento,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_interes ELSE 0 END) AS interes_moroso,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_capital ELSE 0 END) AS capital_moroso,
        SUM(CASE WHEN A.am_pagada = 2 THEN am_descuento ELSE 0 END) AS descuento_moroso,
        SUM(am_interes) + SUM(am_capital) AS total
    FROM amortizacion A, inversion I
    WHERE am_fecha_pago between _initialDate and _finalDate
       -- and is_active = 1
       and A.is_active = 1
       and A.is_deleted = 0
	   and I.is_deleted = 0
       and A.inv_id = I.id
       -- and inv_fecha_venta is null    
    ORDER BY FECHA, PROPIETARIO;


END