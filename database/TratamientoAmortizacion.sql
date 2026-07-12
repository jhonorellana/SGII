select id_catalogo_valor, descripcion from catalogo_valor where id_catalogo = 5
select * from catalogo_valor where id_catalogo = 5 ORDER BY id_catalogo_valor

+ ---------------------- + ----------- +
| id_catalogo_valor      | codigo      |
+ ---------------------- + ----------- +
| 137                    | ANULADA     |
| 136                    | MOROSA      |
| 135                    | PAGADA      |
| 134                    | PEND_PAGO   |
| 200                    | VENTPARCIAL |
| 227                    | VENTANTICIPADA |
| NULL                   | NULL        |
+ ---------------------- + ----------- +
6 rows

SELECT 
    inversion.*,
    (
        -- Subconsulta para calcular el Saldo de Capital (withSum)
        SELECT SUM(capital) 
        FROM amortizacion 
        WHERE amortizacion.id_inversion = inversion.id_inversion 
          AND amortizacion.activo = 1 
          AND amortizacion.eliminado = 0 
          AND amortizacion.fecha_pago > '2026-07-11' -- Fecha actual del sistema
    ) as saldo_capital
FROM inversion
WHERE EXISTS (
    -- Subconsulta para excluir las Notas de Crédito (whereHas)
    SELECT 1 
    FROM instrumento 
    WHERE instrumento.id_instrumento = inversion.id_instrumento 
      AND instrumento.id_tipo_inversion != 91
)
ORDER BY inversion.id_inversion DESC;

select distinct(id_estado_amortizacion)  FROM amortizacion 
        WHERE 
          amortizacion.activo = 1 
          AND amortizacion.eliminado = 0 
          AND amortizacion.fecha_pago > '2026-07-11' -- Fecha actual del sistema
          
select distinct(id_inversion) from amortizacion where id_estado_amortizacion = 1


select * from inversion where id_inversion in (611,
612,
664,
665)

select * from catalogo_valor where id_catalogo_valor = 134
select id_catalogo_valor, codigo from catalogo_valor where id_catalogo = 5


update amortizacion set id_estado_amortizacion = 134 where id_inversion in (611,
612,
664,
665)

select distinct (id_estado_amortizacion) from amortizacion
select count(*) from amortizacion where id_estado_amortizacion = 135 and pagada = 0  -- 135 pagadas
select * from amortizacion where id_estado_amortizacion = 137 -- 137 anulada
select * from amortizacion where id_estado_amortizacion = 227

select distinct pagada from amortizacion

select * from amortizacion where activo = 1 and pagada = 0 order by fecha_pago

select distinct(id_inversion) from amortizacion where activo = 1 and pagada = 0 
select distinct(id_inversion) from amortizacion where activo = 1 and pagada = 0 and fecha_pago < curdate()

select * from amortizacion where activo = 1 and pagada = 0 and fecha_pago < curdate() order by fecha_pago
SELECT A.id_amortizacion, I.id_inversion, I.id_instrumento, Ins.nombre, I.fecha_venta
FROM amortizacion A
INNER JOIN inversion I
    ON A.id_inversion = I.id_inversion
INNER JOIN instrumento Ins
    ON I.id_instrumento = Ins.id_instrumento
WHERE A.activo = 1
  AND A.pagada = 0
  AND A.fecha_pago < CURDATE()
ORDER BY A.fecha_pago;

select * from amortizacion where id_inversion = 167;  -- fecha_venta = '2025-08-28'


SELECT a.id_amortizacion, a.id_inversion, i.fecha_venta, a.pagada, a.activo, a.id_estado_amortizacion 
FROM amortizacion a
INNER JOIN inversion i ON a.id_inversion = i.id_inversion
WHERE a.pagada = 0 
  AND a.activo = 0 
  AND i.fecha_venta IS NOT NULL;
  
SELECT a.id_amortizacion, a.id_inversion, a.fecha_pago, i.fecha_venta, a.pagada, a.activo, a.id_estado_amortizacion 
FROM amortizacion a
INNER JOIN inversion i ON a.id_inversion = i.id_inversion
WHERE a.pagada = 0 
  AND a.activo = 0 
  AND i.fecha_venta IS NOT NULL
  AND a.fecha_pago >= i.fecha_venta;

SELECT a.id_amortizacion, a.id_inversion, a.fecha_pago, i.fecha_venta, a.pagada, a.activo, a.id_estado_amortizacion 
FROM amortizacion a
INNER JOIN inversion i ON a.id_inversion = i.id_inversion
WHERE a.pagada = 0 
  AND a.activo = 0 
  AND i.fecha_venta IS NOT NULL
  AND id_estado_amortizacion <> 227

select * from amortizacion where id_amortizacion = 7971
select * from amortizacion where id_inversion = 285
  
UPDATE amortizacion a
INNER JOIN inversion i ON a.id_inversion = i.id_inversion
SET a.id_estado_amortizacion = 227
WHERE a.pagada = 0 
  AND a.activo = 0 
  AND i.fecha_venta IS NOT NULL
  AND a.fecha_pago >= i.fecha_venta;  
  
  
select distinct(id_inversion) from amortizacion where id_estado_amortizacion = 137   
select * from amortizacion where id_estado_amortizacion = 137   
select * from amortizacion where id_inversion = 236

SELECT I.id_inversion, I.id_instrumento, Ins.nombre, I.fecha_venta
FROM inversion I
INNER JOIN instrumento Ins
    ON I.id_instrumento = Ins.id_instrumento
WHERE id_inversion in (
236,
237,
238)

  AND A.fecha_pago < CURDATE()
ORDER BY A.fecha_pago;


select * from inversion.amortizacion where am_fecha_pago in('2025-12-13', '2026-12-13') and inv_id in (236,237,238)
select * from inversion.amortizacion where inv_id in (236,237,238) order by am_fecha_pago

select * from sipro_desa.amortizacion where fecha_pago in('2025-12-13', '2026-12-13') and id_inversion in (236,237,238)
select * from inversion.amortizacion where inv_id in (236,237,238) order by am_fecha_pago