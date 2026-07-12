select * from catalogo_valor where id_catalogo_valor = 132;

select id_catalogo_valor, descripcion from catalogo_valor where id_catalogo = 5
+ ---------------------- + ---------------- +
| id_catalogo_valor      | descripcion      |
+ ---------------------- + ---------------- +
| 137                    | Anulada          |
| 136                    | Morosa           |
| 135                    | Pagada           |
| 134                    | Pendiente de pago |
| 227                    | Inversion vendida antes de la fecha de pago de la amortizacion |
| 200                    | Anulada Por Venta Parcial |
| NULL                   | NULL             |

select * from inversion where id_instrumento = 25;
update inversion
       set valor_nominal = capital_invertido,
       monto_a_negociar = capital_invertido
 where id_instrumento = 25
 
 select * from inversion where capital_invertido > valor_nominal
 select distinct(id_instrumento) from inversion where capital_invertido > valor_nominal
 
 select * from instrumento where id_instrumento in (224,
192,
194) 

select * from catalogo_valor where id_catalogo_valor = 203
select * from catalogo_valor where id_catalogo = 1

select distinct(id_inversion) from inversion where valor_nominal is null

update inversion set valor_nominal = capital_invertido where valor_nominal is null

Execute:
> select id_catalogo_valor, descripcion from catalogo_valor where id_catalogo = 5

