INSERT INTO `venta_inversion` (
    `id_inversion`, 
    `id_instrumento`, 
    `id_tipo_venta`, 
    `id_propietario`, 
    `porcentaje_vendido`, 
    `fecha_venta`, 
    `liquidacion_venta`, 
    `precio_venta`, 
    `precio_neto_venta`, 
    `interes_previo_venta`, 
    `valor_venta_sin_comision`, 
    `comision_operador`, 
    `suma_comisiones_operador`, 
    `comision_bolsa`, 
    `suma_comisiones_bolsa`, 
    `valor_venta_con_comision`, 
    `valor_recibido`, 
    `utilidad_sin_comision`, 
    `utilidad_con_comision`, 
    `ganancia_perdida`, 
    `rendimiento_total`, 
    `dias_transcurridos`, 
    `roi`, 
    `ganancia_anual`, 
    `retenciones`, 
    `observacion`, 
    `activo`, 
    `eliminado`, 
    `fecha_creacion`, 
    `fecha_actualizacion`
)
SELECT 
    `id_inversion`,
    `id_instrumento`,
    195,
    `id_propietario`,
    100.00,
    `FechaVenta`,
    `LiquidacionVenta`,
    `PrecioVendido`,
    `PrecioNetoVendido`,
    `InteresPrevioVenta`,
    `VentaSincomision`,
    `ComisionOperadorVenta`,
    (`ComisionOperadorCompra` + `ComisionOperadorVenta`),
    `ComisionBolsaVenta`,
    (`ComisionBolsaCompra` + `ComisionBolsaVenta`),
    `ValorVentaConComision`,
    `ValorVentaConComision`,
    `UtilidadSinComision`,
    `UtilidadConComision_GananciaCapital`,
    `UtilidadConComision_GananciaCapital`,
    `Utilidad_RendimientoTotal`,
    `DiasTranscurridos`,
    `TasaRentabilidadPorcentual_ROI`,
    `TasaAnualizada`, 
    0.00,
    CONCAT('Migrado de transaccion_historica ID: ', `id_transaccion_historica`), 
    1,
    0,
    NOW(),
    NOW()
FROM `transaccion_historica`
WHERE `eliminado` = 0 OR `eliminado` IS NULL;



select * from venta_inversion
select distinct id_tipo_venta from venta_inversion
select id_catalogo_valor, codigo, nombre from catalogo_valor where ID_CATALOGO = 8 order by id_catalogo_valor
id_catalogo_valor in (148,195)

update venta_inversion set id_tipo_venta = 148 where observacion like '%Migrado de transaccion_historica ID%' and id_instrumento <> 222

update venta_inversion set id_tipo_venta = 195 where id_instrumento = 222 and observacion like '%Migrado de transaccion_historica ID%'

select * from venta_inversion WHERE ID_INSTRUMENTO = 223

update venta_inversion set id_tipo_venta = 195 where observacion like '%Migrado de transaccion_historica ID%' and id_tipo_venta = 224

select * from instrumento where id_instrumento = 11
223

+ ---------------------- + ----------- + ----------- +
| id_catalogo_valor      | codigo      | nombre      |
+ ---------------------- + ----------- + ----------- +
| 147                    | PARCIALBONO | Parcial Bono |
| 148                    | TOTAL BONO  | Total Bono  |
| 195                    | TOTAL NOTAC | Total Nota Credito |
| 224                    | HISTORICA   | Historica   |
| 225                    | PARCIALPAPEL | Parcial Papel Comercial |
| NULL                   | NULL        | NULL        |
+ ---------------------- + ----------- + ----------- +

select * from instrumento where id_instrumento in (select id_instrumento from venta_inversion) and nombre not like '%BONO%'

select * from venta_inversion where id_instrumento = 223