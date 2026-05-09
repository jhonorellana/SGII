CREATE DEFINER=`root`@`localhost` PROCEDURE `SP_BALANCE`(IN `initial_date` VARCHAR(10), IN `final_date` VARCHAR(10))
BEGIN

 
    delete from balance;
  
  insert into balance select 'Intereses esperados en el período escogido', sum(am_interes) FROM amortizacion A, inversion I where am_fecha_pago > (initial_date) and am_fecha_pago <= final_date and inv_fecha_venta is null and A.is_active = 1 and A.is_deleted = 0
       and I.is_deleted = 0
       and A.inv_id = I.id;
  insert into balance select 'Capital bonos excepto los de vencimiento próximo', sum(inv_capital_invertido) from inversion where is_active=1 and is_deleted=0 and inv_tipo = 4 and inv_fecha_vencimiento > initial_date and id not in (175, 144, 201, 205, 206,        207,194, 195,223,218,203,208,220,209);

  insert into balance select 'Bonos vencimiento próximo', sum(am_capital) as capital from amortizacion A, inversion I where am_fecha_pago > initial_date and inv_fecha_venta is null and A.is_active = 1 and A.is_deleted = 0
       and I.is_deleted = 0
       and A.inv_id = I.id
       and I.inv_tipo =4
       ;

  insert into balance select 'Obligaciones', sum(am_capital) as capital from amortizacion A, inversion I where am_fecha_pago > initial_date and inv_fecha_venta is null and A.is_active = 1 and A.is_deleted = 0
       and I.is_deleted = 0
       and A.inv_id = I.id
       and I.inv_tipo =5
       ;

  insert into balance select 'Papeles Comerciales', sum(am_capital) as capital from amortizacion A, inversion I where am_fecha_pago > initial_date and inv_fecha_venta is null and A.is_active = 1 and A.is_deleted = 0
       and I.is_deleted = 0
       and A.inv_id = I.id
       and I.inv_tipo =3
       ;

    insert into balance select 'Notas Credito', sum(am_capital) as capital from amortizacion A, inversion I where am_fecha_pago > initial_date and inv_fecha_venta is null and A.is_active = 1 and A.is_deleted = 0
       and I.is_deleted = 0
       and A.inv_id = I.id
       and I.inv_tipo = 91
       ;
       
	insert into balance select 'Acciones', sum(am_capital) as capital from amortizacion A, inversion I where am_fecha_pago > initial_date and inv_fecha_venta is null and A.is_active = 1 and A.is_deleted = 0
       and I.is_deleted = 0
       and A.inv_id = I.id
       and I.inv_tipo = 73
       ;

	insert into balance select 'Titularizaciones', sum(am_capital) as capital from amortizacion A, inversion I where am_fecha_pago > initial_date and inv_fecha_venta is null and A.is_active = 1 and A.is_deleted = 0
       and I.is_deleted = 0
       and A.inv_id = I.id
       and I.inv_tipo = 75
       ;
       
  insert into balance select 'Otros Valores', sum(ov_value) from othervalue order by id;  
  -- insert into balance select ov_description, ov_value from othervalue order by id;  
  select description as detalle, value as valor from balance
  union 
  select 'TOTAL' as detalle, sum(value) as valor from balance;
  
END