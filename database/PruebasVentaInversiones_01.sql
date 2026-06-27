select * from catalogo_valor where id_catalogo =14 order by id_catalogo_valor
select * from catalogo_valor where id_catalogo =5 order by id_catalogo_valor

select * from catalogo_valor where id_catalogo_valor = 213
/*
select * from catalogo_valor where id_catalogo =4  order by id_catalogo_valor
+ ---------------------- + ---------------- + ----------- + ----------- +
| id_catalogo_valor      | id_catalogo      | codigo      | nombre      |
+ ---------------------- + ---------------- + ----------- + ----------- +
| 128                    | 4                | ACTIVA      | Activa      |
| 129                    | 4                | VENDIDA_PARCIAL | Vendida parcialmente |
| 130                    | 4                | VENDIDA_TOTAL | Vendida totalmente |
| 131                    | 4                | VENCIDA     | Vencida     |
| 132                    | 4                | CANCELADA   | Cancelada   |
| 133                    | 4                | EN_RIESGO   | En riesgo   |
| NULL                   | NULL             | NULL        | NULL        |
+ ---------------------- + ---------------- + ----------- + ----------- +
7 rows
*/

/*
select * from catalogo_valor where id_catalogo =5  order by id_catalogo_valor
+ ---------------------- + ---------------- + ----------- + ----------- +
| id_catalogo_valor      | id_catalogo      | codigo      | nombre      |
+ ---------------------- + ---------------- + ----------- + ----------- +
| 134                    | 5                | PENDIENTE   | Pendiente   |
| 135                    | 5                | PAGADA      | Pagada      |
| 136                    | 5                | MOROSA      | Morosa      |
| 137                    | 5                | ANULADA     | Anulada     |
| NULL                   | NULL             | NULL        | NULL        |
+ ---------------------- + ---------------- + ----------- + ----------- +
5 rows
*/

select * from instrumento where nombre like '%pichincha%' id_instrumento = 194 -- id_instrumento = 64;
select * from inversion where id_inversion in (281,289,393);  -- 347901 / 20288 - VRF35 / 366691


select * from amortizacion where id_inversion in (393) -- (281,289,393); order by fecha_pago;


-- select * from inversion.bonos where inv_id = 241;
select * from sipro_desa.inversion where id_inversion in (281,289,393,569);   -- cambia el estado, fecha_venta, activo 
Select * from sipro_desa.amortizacion where id_inversion > 500 in (393) (281,289,393); -- id_estado_amortizacion / activo   --- originalmente 134
Select * from sipro_desa.movimiento_capital where id_inversion in (281,289,393); -- se crear un nuevo registro
Select * from venta_inversion where id_inversion in (281,289,393); -- se debe crear un nuevo registro
Select * from venta_inversion_detalle; -- se deben crear la misma cantidad de inversiones afectadas
select * from inversion_propietario_reasignacion_log -- se carga cuando hay una reasignación automática de notas de crédito
select * from accion_operacion

utilidad_sin_comision = Valor Efectivo Venta es decir valor_venta_sin_comision de la tabla venta_inversion - Valor Efectivo Compra 



Select * from inversion.inversion where inv_tipo = 4
Select * from inversion.amortizacion where inv_id>600
Select * from inversion.inversion where id in(241,244,316,424,447,494)

Select 
id,
inv_liquidacion, 
inv_valor_nominal,
inv_valor_con_interes,
inv_tasa_interes,
inv_rendimiento_nominal,
inv_valor_interes,
inv_comision_bolsa,
inv_comision_operador,
inv_tasa_mensual_real,
inv_interes_primer_mes,
inv_fecha_primer_pago,
inv_precio_comprado,
inv_precio_neto_comprado,
inv_valor_sin_comision,
inv_capital_invertido,
inv_interes_acumulado_previo,
inv_total_comisiones
from inversion.inversion 
where id in (241,244,316,424,447,494)


Select id_inversion,
liquidacion,
`valor_nominal`,
`valor_con_interes`,
`tasa_interes`,
`rendimiento_nominal`,
`interes_mensual`,
`comision_bolsa`,
`comision_casa_valores`,
`tasa_mensual_real`,
`interes_primer_mes`,
`fecha_primer_pago`,
`precio_compra`,
`precio_neto_compra`,
`valor_sin_comision`,
`capital_invertido`,
`interes_acumulado_previo`,
`total_comisiones`
 from sipro_desa.inversion where id_inversion in (241,244,316,424,447,494)
 
 
 
 UPDATE sipro_desa.inversion I
INNER JOIN inversion.inversion INV
    ON INV.id = I.id_inversion
SET
    I.liquidacion               = INV.inv_liquidacion,
    I.valor_nominal             = INV.inv_valor_nominal,
    I.valor_con_interes         = INV.inv_valor_con_interes,
    I.tasa_interes              = INV.inv_tasa_interes,
    I.rendimiento_nominal       = INV.inv_rendimiento_nominal,
    I.interes_mensual           = INV.inv_valor_interes,
    I.comision_bolsa            = INV.inv_comision_bolsa,
    I.comision_casa_valores     = INV.inv_comision_operador,
    I.tasa_mensual_real         = INV.inv_tasa_mensual_real,
    I.interes_primer_mes        = INV.inv_interes_primer_mes,
    I.fecha_primer_pago         = INV.inv_fecha_primer_pago,
    I.precio_compra             = INV.inv_precio_comprado,
    I.precio_neto_compra        = INV.inv_precio_neto_comprado,
    I.valor_sin_comision        = INV.inv_valor_sin_comision,
    I.capital_invertido         = INV.inv_capital_invertido,
    I.interes_acumulado_previo  = INV.inv_interes_acumulado_previo,
    I.total_comisiones          = INV.inv_total_comisiones
    where inv_tipo=4;
    
    select * from amortizacion where fecha_pago between '2026-05-01' and '2026-05-31'
    