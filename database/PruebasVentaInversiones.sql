select * from catalogo_valor where id_catalogo =4 order by id_catalogo_valor
select * from catalogo_valor where id_catalogo =5 order by id_catalogo_valor
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

select * from inversion where id_inversion in (241,244);
UPDATE `sipro_desa`.`inversion` SET `liquidacion` = '333313', `fecha_venta` = null, `activo` = '1', id_estado_inversion=132 WHERE (`id_inversion` = '241');
UPDATE `sipro_desa`.`inversion` SET `liquidacion` = '333555', `fecha_venta` = null, `activo` = '1', id_estado_inversion=132 WHERE (`id_inversion` = '244');

select * from amortizacion where id_inversion in (241,244) order by fecha_pago;
update sipro_desa.amortizacion set activo = 1 where id_inversion in (241,244)


Select * from inversion where id_inversion in (241,244);   -- cambia el estado, fecha_venta, activo 
Select * from amortizacion where id_inversion in (241,244); -- id_estado_amortizacion / activo   --- originalmente 134
Select * from sipro_desa.movimiento_capital order by id_movimiento_capital desc, id_movimiento_capital desc -- where id_inversion in (525) -- in (491,492,493,494,495,496,497,498, 499,500, 501) -- se crear un nuevo registro
Select * from venta_inversion -- se debe crear un nuevo registro
Select * from venta_inversion_detalle -- se deben crear la misma cantidad de inversiones afectadas
select * from inversion_propietario_reasignacion_log -- se carga cuando hay una reasignación automática de notas de crédito
