UPDATE inversion.inversion I
INNER JOIN Inversion.Bonos B
    ON B.inv_id = I.id
SET
    I.inv_fecha_compra          = B.fechaCompra,
    I.inv_propietario           = B.propietario,
    I.inv_liquidacion           = B.liquidacion,
    I.inv_fecha_emision         = B.fechaEmision,
    I.inv_fecha_vencimiento     = B.fechaVencimiento,
    I.inv_valor_nominal         = B.valorNominal,
    I.inv_valor_con_interes     = B.pagado,
    I.inv_tasa_interes          = B.tasaMensual,
    I.inv_rendimiento_nominal   = B.rendimiento,
    I.inv_valor_interes         = B.interesMensual,
    I.inv_comision_bolsa        = B.comisionBolsa,
    I.inv_comision_operador     = B.comisionCasa,
    I.inv_tasa_mensual_real     = B.tasaMensualReal,
    I.inv_interes_primer_mes    = B.interesPrimerMes,
    I.inv_fecha_primer_pago     = B.fechaPrimerPago,
    I.inv_precio_comprado       = B.precioComprado,
    I.inv_precio_neto_comprado  = B.precioNetoComprado,
    I.inv_valor_sin_comision    = B.valorSinComision,
    I.inv_capital_invertido     = B.valorConComision,
    I.inv_interes_acumulado_previo = B.interesAcumuladoPrevio,
    I.inv_total_comisiones      = B.totalComisiones,
    I.inv_codigo_SEB            = B.codigoSEB,
    I.inv_codigo_BCE            = B.codigoBCE,
    I.inv_fechas_pagos_capital  = B.fechasPagosCapital;