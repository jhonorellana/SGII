CREATE DEFINER=`root`@`localhost` PROCEDURE `SP_AMORTIZATION_SUMMARY_BY_MONTH`(IN `OPC` INT, IN `_year` INT, IN `_month` INT)
BEGIN
    SELECT
        YEAR(am_fecha_pago) AS anio,
        CASE
            WHEN MONTH(am_fecha_pago) = 1 THEN 'Enero'
            WHEN MONTH(am_fecha_pago) = 2 THEN 'Febrero'
            WHEN MONTH(am_fecha_pago) = 3 THEN 'Marzo'
            WHEN MONTH(am_fecha_pago) = 4 THEN 'Abril'
            WHEN MONTH(am_fecha_pago) = 5 THEN 'Mayo'
            WHEN MONTH(am_fecha_pago) = 6 THEN 'Junio'
            WHEN MONTH(am_fecha_pago) = 7 THEN 'Julio'
            WHEN MONTH(am_fecha_pago) = 8 THEN 'Agosto'
            WHEN MONTH(am_fecha_pago) = 9 THEN 'Septiembre'
            WHEN MONTH(am_fecha_pago) = 10 THEN 'Octubre'
            WHEN MONTH(am_fecha_pago) = 11 THEN 'Noviembre'
            WHEN MONTH(am_fecha_pago) = 12 THEN 'Diciembre'
        END AS mes,
        SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_interes ELSE 0 END) AS interes,
		SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_capital ELSE 0 END) AS capital,
		SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_descuento ELSE 0 END) AS descuento,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_interes ELSE 0 END) AS interes_moroso,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_capital ELSE 0 END) AS capital_moroso,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_descuento ELSE 0 END) AS descuento_moroso,
        SUM(am_interes) + SUM(am_capital) AS total
    FROM amortizacion A, inversion I
    WHERE (am_fecha_pago AND MONTH(am_fecha_pago) = _month AND YEAR(am_fecha_pago) = _year)
       OR (_month = 0 AND YEAR(am_fecha_pago) = _year)
      -- and is_active = 1
	   -- and A.is_active = 1
       and (A.is_active = 1 OR  I.inv_fecha_venta IS NULL)
       and A.is_deleted = 0
       and I.is_deleted = 0
       and A.inv_id = I.id
       -- and inv_fecha_venta is null
    GROUP BY YEAR(am_fecha_pago), MONTH(am_fecha_pago)
	UNION
    SELECT
        _year AS anio,
        'ANUAL TOTAL' AS mes,
        SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_interes ELSE 0 END) AS interes,
		SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_capital ELSE 0 END) AS capital,
		SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_descuento ELSE 0 END) AS descuento,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_interes ELSE 0 END) AS interes_moroso,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_capital ELSE 0 END) AS capital_moroso,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_descuento ELSE 0 END) AS descuento_moroso,
        SUM(am_interes) + SUM(am_capital) AS total
    FROM amortizacion A, inversion I
    WHERE (am_fecha_pago AND YEAR(am_fecha_pago) = _year)
       -- and is_active = 1
	   -- and A.is_active = 1
       and (A.is_active = 1 OR  I.inv_fecha_venta IS NULL)
       and A.is_deleted = 0
       and I.is_deleted = 0
       and A.inv_id = I.id
       -- and inv_fecha_venta is null
    UNION
    SELECT
        _year AS anio,
        'ANUAL EJECUTADO' AS mes,
        SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_interes ELSE 0 END) AS interes,
		SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_capital ELSE 0 END) AS capital,
		SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_descuento ELSE 0 END) AS descuento,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_interes ELSE 0 END) AS interes_moroso,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_capital ELSE 0 END) AS capital_moroso,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_descuento ELSE 0 END) AS descuento_moroso,
        SUM(am_interes) + SUM(am_capital) AS total
    FROM amortizacion A, inversion I
    WHERE (am_fecha_pago AND YEAR(am_fecha_pago) = _year)
       -- and is_active = 1
	   and A.is_active = 1
       and A.is_deleted = 0
       and I.is_deleted = 0
       and A.inv_id = I.id
       and am_fecha_pago <= curdate()
       -- and inv_fecha_venta is null
    UNION
    SELECT
        _year AS anio,
        'ANUAL PENDIENTE' AS mes,
        SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_interes ELSE 0 END) AS interes,
		SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_capital ELSE 0 END) AS capital,
		SUM(CASE WHEN A.am_pagada IN (1,0) THEN am_descuento ELSE 0 END) AS descuento,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_interes ELSE 0 END) AS interes_moroso,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_capital ELSE 0 END) AS capital_moroso,
		SUM(CASE WHEN A.am_pagada = 2 THEN am_descuento ELSE 0 END) AS descuento_moroso,
        SUM(am_interes) + SUM(am_capital) AS total
    FROM amortizacion A, inversion I
    WHERE (am_fecha_pago AND YEAR(am_fecha_pago) = _year)
       -- and is_active = 1
	   -- and A.is_active = 1
       and (A.is_active = 1 OR  I.inv_fecha_venta IS NULL)
       and A.is_deleted = 0
       and I.is_deleted = 0
       and A.inv_id = I.id
       and am_fecha_pago > curdate() 
       -- and inv_fecha_venta is null
       ;

END