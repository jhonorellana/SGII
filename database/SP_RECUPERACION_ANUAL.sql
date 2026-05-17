CREATE DEFINER=`root`@`localhost` PROCEDURE `SP_RECUPERACION_ANUAL`(IN `_historico` INT)
BEGIN
   IF _historico = 0 THEN    -- SE BUSCA TODA LA INFORMACION PERO SOLO DE FECHAS FUTURAS
       SELECT CAST(YEAR(A.am_fecha_pago) AS CHAR) AS anio, 
              SUM(A.am_capital) AS capital, 
              SUM(A.am_interes) AS interes, 
              SUM(A.am_capital) + SUM(A.am_interes) AS total
       FROM amortizacion A, inversion I
       WHERE 
                   I.inv_fecha_venta IS NULL
		          and A.is_deleted = 0
                  and I.is_deleted = 0
                  and A.inv_id = I.id
           AND A.am_fecha_pago > CURDATE()
       GROUP BY anio 
       ORDER BY anio ASC;
   ELSE   -- SE NECESITA SOLO EL INTERES PERO DE TODOS LOS AÑOS PREVIOS
   
       SELECT CAST(YEAR(A.am_fecha_pago) AS CHAR) AS anio, 
              SUM(A.am_capital) AS capital, 
              SUM(A.am_interes) AS interes, 
              SUM(A.am_capital) + SUM(A.am_interes) AS total
       FROM amortizacion A, inversion I
       WHERE 
		   A.is_deleted = 0
           and I.is_deleted = 0
           and A.inv_id = I.id
           -- and A.is_active = 1
		   and (A.is_active = 1 OR  I.inv_fecha_venta IS NULL)
       GROUP BY anio 
       ORDER BY anio ASC;
       
       
   END IF;

        
END