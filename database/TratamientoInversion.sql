select * from catalogo where id_catalogo=4
select * from catalogo_valor where id_catalogo_valor=128
select id_catalogo_valor, descripcion from catalogo_valor where id_catalogo=4
+ ---------------------- + ---------------- +
| id_catalogo_valor      | descripcion      |
+ ---------------------- + ---------------- +
| 128                    | Activa           |
| 132                    | Cancelada        |
| 133                    | En riesgo        |
| 131                    | Vencida          |
| 129                    | Vendida parcialmente |
| 130                    | Vendida totalmente |
+ ---------------------- + ---------------- +

select * from inversion where fecha_venta is not null and fecha_actualizacion <> '2026-07-12 09:42:34' -- 430
update inversion set id_estado_inversion = 130 where fecha_venta is not null
select distinct (id_estado_inversion) from inversion 
select * from inversion where id_estado_inversion=132 -- 234


SELECT I.id_inversion, I.id_instrumento, Ins.nombre, I.fecha_compra, Ins.fecha_vencimiento, I.fecha_venta
FROM Inversion I
INNER JOIN instrumento Ins
    ON I.id_instrumento = Ins.id_instrumento
WHERE 
  id_estado_inversion=132
ORDER BY I.fecha_compra;

update inversion set id_estado_inversion=131
where id_inversion in (
1,
2,
3,
4,
5,
6,
7,
8,
9,
10,
11,
12,
13,
14,
15,
16,
17,
18,
19,
20,
21,
22,
23,
24,
25,
26,
27,
28,
29,
30,
31,
32,
33,
34,
35,
36,
37,
38,
39,
40,
41,
42,
43,
44,
45,
46,
47,
48,
49,
50,
51,
52,
53,
54,
55,
56,
57,
58,
59,
60,
61,
62,
63,
64,
65,
66,
67,
68,
69,
70,
71,
72,
73,
74,
75,
76,
77,
78,
79,
80,
81,
82,
83,
84,
85,
86,
87,
88,
89,
90,
91,
92,
93,
94,
95,
96,
99,
100,
101,
102,
103,
104,
105,
106,
107,
108,
109,
110,
111,
112,
115,
130,
131,
132,
133,
135,
175,
188) and id_estado_inversion=132

select * from inversion where expirado = 1 and id_estado_inversion <> 131
select distinct(id_estado_inversion) from inversion where activo_old = 0
select * from inversion where activo_old = 0 and id_estado_inversion = 128
select distinct(id_instrumento) from inversion where activo_old = 0 
and id_estado_inversion = 128


select * from instrumento where id_instrumento in(
196,
98,
192,
194,
117,
221,
224)

update inversion set id_estado_inversion = 132 where id_instrumento in(
196,
98,
192,
194,
117,
221,
224)

select * from inversion where id_instrumento in(
196,
98,
192,
194,
117,
221,
224) and id_estado_inversion <> 128SP_FLUJO_CAPITAL_CONSOLIDADO

select * from inversion where id_inversion in (299,300,309)


select * from inversion where id_inversion = 138
select * from inversion.inversion where id = 138
select * from inversion.bonos where inv_id = 138
select * from inversion where valor_nominal = 0 and id_estado_inversion = 128

select * from instrumento where id_instrumento in(
select distinct(id_instrumento) from inversion where valor_nominal = 0 and id_estado_inversion = 128)

select * from inversion.bonos where inv_id in(
select id_inversion from inversion where valor_nominal = 0 and id_estado_inversion = 128
)

update inversion set id_estado_inversion=132 where valor_nominal = 0 and id_estado_inversion = 128


select * from inversion where id_inversion = 136
select * from instrumento where id_instrumento = 34


SELECT I.id_inversion, I.id_instrumento, Ins.nombre, I.fecha_compra, I.fecha_venta, Ins.fecha_vencimiento
FROM Inversion I
INNER JOIN instrumento Ins
    ON I.id_instrumento = Ins.id_instrumento
WHERE 
  id_estado_inversion=128
  and Ins.fecha_vencimiento < curdate()
ORDER BY I.fecha_compra;


UPDATE Inversion I
INNER JOIN instrumento Ins
    ON I.id_instrumento = Ins.id_instrumento
SET 
    I.id_estado_inversion = 131,
    I.fecha_actualizacion = NOW()
WHERE 
    I.id_estado_inversion = 128
    AND Ins.fecha_vencimiento < CURDATE();