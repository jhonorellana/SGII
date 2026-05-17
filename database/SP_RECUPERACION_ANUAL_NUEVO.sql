CREATE DEFINER=`root`@`localhost` PROCEDURE `SP_RECUPERACION_ANUAL`(IN `_historico` INT)
BEGIN
   IF _historico = 0 THEN    -- SE BUSCA TODA LA INFORMACION PERO SOLO DE FECHAS FUTURAS
       SELECT CAST(YEAR(A.fecha_pago) AS CHAR) AS anio, 
              SUM(A.capital) AS capital, 
              SUM(A.interes) AS interes, 
              SUM(A.capital) + SUM(A.interes) AS total
       FROM amortizacion A, inversion I
       WHERE 
                   I.fecha_venta IS NULL
		          and A.eliminado = 0
                  and I.eliminado = 0
                  and A.id_inversion = I.id_inversion
           AND A.fecha_pago > CURDATE()
       GROUP BY anio 
       ORDER BY anio ASC;
   ELSE   -- SE NECESITA SOLO EL INTERES PERO DE TODOS LOS AÑOS PREVIOS
   
       SELECT CAST(YEAR(A.fecha_pago) AS CHAR) AS anio, 
              SUM(A.capital) AS capital, 
              SUM(A.interes) AS interes, 
              SUM(A.capital) + SUM(A.interes) AS total
       FROM amortizacion A, inversion I
       WHERE 
		   A.eliminado = 0
           and I.eliminado = 0
           and A.id_inversion = I.id_inversion
		   and (A.activo = 1 OR I.fecha_venta IS NULL)
       GROUP BY anio 
       ORDER BY anio ASC;
       
       
   END IF;

        
END
