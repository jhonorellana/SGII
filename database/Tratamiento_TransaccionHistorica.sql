SELECT * FROM sipro_desa.transaccion_historica where fechaventa in ('2026-06-17','2026-06-25')
Select * from venta_inversion where  fecha_venta in ('2026-06-17','2026-06-25','2026-05-12','2026-04-20')
SELECT * FROM sipro_desa.transaccion_historica TH

Select * from sipro_desa.movimiento_capital where id_inversion in (281,289,393); -- se crear un nuevo registro
Select * from venta_inversion where id_inversion in (281,289,393); -- se debe crear un nuevo registro
Select * from venta_inversion_detalle; 

SELECT * FROM sipro_desa.transaccion_historica where fechaventa > '2026-05-27'

select ganancia_perdida from venta_inversion 
select * from venta_inversion 

SELECT id, LiquidacionVenta, UtilidadConComision_GananciaCapital FROM sipro_desa.transaccion_historica where 
LiquidacionVenta in(
'368144',
'3683381',
'3686693',
'15514_01 - VRF59',
'3692061',
'16322 - VRF26',
'3695169',
'369780')
and UtilidadConComision_GananciaCapital not in (
select ganancia_perdida from venta_inversion 
)

select * from venta_inversion where id_venta_inversion  =6

select id_venta_inversion, id_instrumento, liquidacion_venta, ganancia_perdida from venta_inversion 
where liquidacion_venta in ('16322 - VRF26')

261.04


SELECT id_transaccion_historica, LiquidacionVenta, UtilidadConComision_GananciaCapital FROM sipro_desa.transaccion_historica where 
LiquidacionVenta in('16322 - VRF26')

select * from sipro_desa.transaccion_historica where LiquidacionVenta = 3692061

select * from sipro_desa.inversion where valor_nominal = 53100


SELECT * FROM sipro_desa.transaccion_historica where LiquidacionVenta in('16322 - VRF26')
select 0.0241*100

SELECT * FROM sipro_desa.transaccion_historica where LiquidacionVenta in('16322 - VRF26')

select * from instrumento where nombre like '%bono%'

update transaccion_historica set id_emisor = 146 where Titulo='PapelComercial'

select * from transaccion_historica where id_emisor not in (139,153)

update transaccion_historica set id_instrumento = 223 where id_emisor = 146

select * from instrumento where fecha_emision='2026-04-24' and fecha_vencimiento='2027-04-09'
select * from instrumento where fecha_vencimiento='2027-04-09'

select * from instrumento where fecha_emision ='2022-07-27'  -- 2029-07-27




update transaccion_historica set id_emisor=153 where id_instrumento = 222 
select * from instrumento where id_emisor= 146
select * from emisor where id_emisor = 146


update transaccion_historica T set T.id_instrumento = Inst.id_instrumento
from Instrumento inst
where T.FechaCompra = Inst.fecha_compra
and T.FechaVencimiento = Inst.fecha_vencimiento
and T.id_emisor = 139
and inst.id_emisor = 139

UPDATE transaccion_historica T
INNER JOIN instrumento Inst
    ON T.FechaEmision = Inst.fecha_emision
   AND T.FechaVencimiento = Inst.fecha_vencimiento
SET T.id_instrumento = Inst.id_instrumento
WHERE T.id_emisor = 139
  AND Inst.id_emisor = 139;


select * from instrumento where id_instrumento = 219
select * from transaccion_historica where id_instrumento is null
select * from instrumento where fecha_vencimiento = '2028-06-27'
select * from instrumento where fecha_vencimiento = '2029-11-18'
select * from instrumento where fecha_vencimiento = '2028-08-08'
select * from instrumento where fecha_vencimiento = '2033-09-05'
select * from instrumento where fecha_vencimiento = '2034-05-08'
select * from instrumento where fecha_emision = '2022-08-08'

select * from inversion where fecha_compra= '2026-04-09'

2022-08-08  2028-08-08

inversion: 2025-09-25 BONOS DEL ESTADO 2030-09-25
historico; 2025-09-05 a 2033-09-05


select * from persona

update transaccion_historica set id_propietario = 1 where titular = 'Jhon'
update transaccion_historica set id_propietario = 2 where titular = 'Cristian'
update transaccion_historica set id_propietario = 3 where titular = 'Isabel'
select * from transaccion_historica where id_propietario is null

select * from transaccion_historica T, inversion INV
where T.FechaCompra = INV.fecha_compra
and T.FechaVenta = INV.fecha_venta
and T.id_instrumento = INV.id_instrumento

select * from inversion

SELECT
    T.id_transaccion_historica,
    T.id_inversion AS inversion_actual,
    INV.id_inversion AS inversion_nueva,
    T.FechaCompra,
    T.FechaVenta,
    T.id_instrumento
FROM transaccion_historica T
INNER JOIN inversion INV
    ON T.FechaCompra = INV.fecha_compra
   AND T.FechaVenta = INV.fecha_venta
   AND T.id_instrumento = INV.id_instrumento;


UPDATE transaccion_historica T
INNER JOIN inversion INV
    ON T.FechaCompra = INV.fecha_compra
   AND T.FechaVenta = INV.fecha_venta
   AND T.id_instrumento = INV.id_instrumento
SET T.id_inversion = INV.id_inversion;

UPDATE transaccion_historica T
INNER JOIN inversion INV
    ON T.FechaCompra = INV.fecha_compra
   AND (
        T.FechaVenta <=> INV.fecha_venta
       )
   AND T.id_instrumento = INV.id_instrumento
   AND T.id_propietario = INV.id_propietario
SET T.id_inversion = INV.id_inversion
WHERE T.id_inversion IS NULL;

select * from transaccion_historica where id_inversion is null
select * from inversion.bonos where fechacompra = '2022-08-17'
select * from inversion.inversion where inv_fecha_compra = '2022-08-17'
select * from inversion.bonos where fechacompra = '2022-12-21'

UPDATE transaccion_historica T
INNER JOIN inversion.bonos B
    ON T.FechaCompra = B.fechacompra
   AND T.fechaemision = B.fechaEmision
   AND T.fechavencimiento = B.fechavencimiento
   AND T.Titular = B.Propietario
SET T.id_inversion = B.inv_id

-- WHERE T.id_inversion IS NULL;

select * from inversion.inversion where inv_fecha_Compra in ('2022-08-17',
'2022-08-17',
'2022-08-17',
'2022-08-17',
'2022-12-21',
'2022-08-17',
'2022-08-17',
'2023-02-07',
'2022-12-21',
'2022-12-22',
'2023-01-04',
'2022-12-21',
'2026-02-20')


UPDATE transaccion_historica T
INNER JOIN inversion.inversion INV
    ON T.FechaCompra = INV.inv_fecha_compra
   AND T.fechaemision = INV.inv_fecha_Emision
   AND T.fechavencimiento = INV.inv_fecha_vencimiento
   AND T.Titular = INV.inv_Propietario
SET T.id_inversion = inv.id

select * from transaccion_historica where Titulo = 'BonoEstado' and id_inversion is null and id_transaccion_historica not in (2,3,12, 16, 18)
select * from transaccion_historica where Titulo = 'BonoEstado' and id_inversion is null and fechacompra = '2022-08-17' and fechaemision = '2022-06-27' and FEchaVencimiento = '2028-06-27'

select * from inversion.inversion where inv_fecha_compra = '2026-02-20' and inv_fecha_Emision = '2022-08-08' and inv_fecha_vencimiento='2028-08-08' and inv_propietario = 'Cristian'

select * from inversion.inversion where inv_fecha_vencimiento ='2032-05-17'

select 15242.50 + 8277.48

 2031-05-07

select * from inversion.inversion where id = 146

select * from inversion.bonos where fechacompra = '2026-02-20'
select * from inversion.inversion where inv_fecha_compra = '2026-02-20'
select * from sipro_desa.inversion where fecha_compra = '2026-02-20'

select * from transaccion_historica where Titulo <> 'BonoEstado'    -- and id_inversion is null and id_transaccion_historica not in (2,3,12, 16, 18)

select * from inversion where id_inversion = 453

update transaccion_historica set id_inversion = null where titulo = 'NotaCreditoSRI'
select * from transaccion_historica where titulo = 'PapelComercial'

select * from inversion where id_instrumento = 223

select * from 