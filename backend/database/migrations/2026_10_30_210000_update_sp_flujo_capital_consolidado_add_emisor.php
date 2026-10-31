<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::unprepared("DROP PROCEDURE IF EXISTS `SP_FLUJO_CAPITAL_CONSOLIDADO`;");

        DB::unprepared("
            CREATE PROCEDURE `SP_FLUJO_CAPITAL_CONSOLIDADO`(
                IN `_initialDate` DATE, 
                IN `_finalDate` DATE, 
                IN `_id_grupo_familiar` INT, 
                IN `_id_propietario` INT,
                IN `_id_emisor` INT
            )
            BEGIN
                SELECT
                    a.fecha_pago AS fecha,
                    CONCAT(p.nombres, ' ', p.apellidos) AS propietario,
                    e.nombre AS empresa,
                    SUM(CASE WHEN a.id_estado_amortizacion IN (134, 135) THEN a.interes ELSE 0 END) AS interes,
                    SUM(CASE WHEN a.id_estado_amortizacion IN (134, 135) THEN a.capital ELSE 0 END) AS capital,
                    SUM(CASE WHEN a.id_estado_amortizacion IN (134, 135) THEN a.descuento ELSE 0 END) AS descuento,
                    SUM(CASE WHEN a.id_estado_amortizacion = 136 THEN a.interes ELSE 0 END) AS interes_moroso,
                    SUM(CASE WHEN a.id_estado_amortizacion = 136 THEN a.capital ELSE 0 END) AS capital_moroso,
                    SUM(CASE WHEN a.id_estado_amortizacion = 136 THEN a.descuento ELSE 0 END) AS descuento_moroso,
                    SUM(a.interes + a.capital) AS total,
                    e.id_emisor,
                    i.id_propietario
                FROM amortizacion a
                INNER JOIN inversion i ON a.id_inversion = i.id_inversion
                INNER JOIN persona p ON i.id_propietario = p.id_persona
                INNER JOIN instrumento inst ON i.id_instrumento = inst.id_instrumento
                INNER JOIN emisor e ON inst.id_emisor = e.id_emisor
                WHERE a.fecha_pago BETWEEN _initialDate AND _finalDate
                    AND i.id_estado_inversion = 128
                    AND i.eliminado = 0
                    AND a.id_estado_amortizacion IN (134, 135, 136)
                    AND a.eliminado = 0
                    AND (_id_grupo_familiar IS NULL OR i.id_grupo_familiar = _id_grupo_familiar)
                    AND (_id_propietario IS NULL OR i.id_propietario = _id_propietario)
                    AND (_id_emisor IS NULL OR e.id_emisor = _id_emisor)
                GROUP BY a.fecha_pago, p.nombres, p.apellidos, e.nombre, e.id_emisor, i.id_propietario
                ORDER BY fecha, propietario;
            END
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::unprepared("DROP PROCEDURE IF EXISTS `SP_FLUJO_CAPITAL_CONSOLIDADO`;");

        DB::unprepared("
            CREATE PROCEDURE `SP_FLUJO_CAPITAL_CONSOLIDADO`(
                IN `_initialDate` DATE, 
                IN `_finalDate` DATE, 
                IN `_id_grupo_familiar` INT, 
                IN `_id_propietario` INT
            )
            BEGIN
                SELECT
                    a.fecha_pago AS fecha,
                    CONCAT(p.nombres, ' ', p.apellidos) AS propietario,
                    e.nombre AS empresa,
                    SUM(CASE WHEN a.id_estado_amortizacion IN (134, 135) THEN a.interes ELSE 0 END) AS interes,
                    SUM(CASE WHEN a.id_estado_amortizacion IN (134, 135) THEN a.capital ELSE 0 END) AS capital,
                    SUM(CASE WHEN a.id_estado_amortizacion IN (134, 135) THEN a.descuento ELSE 0 END) AS descuento,
                    SUM(CASE WHEN a.id_estado_amortizacion = 136 THEN a.interes ELSE 0 END) AS interes_moroso,
                    SUM(CASE WHEN a.id_estado_amortizacion = 136 THEN a.capital ELSE 0 END) AS capital_moroso,
                    SUM(CASE WHEN a.id_estado_amortizacion = 136 THEN a.descuento ELSE 0 END) AS descuento_moroso,
                    SUM(a.interes + a.capital) AS total,
                    e.id_emisor,
                    i.id_propietario
                FROM amortizacion a
                INNER JOIN inversion i ON a.id_inversion = i.id_inversion
                INNER JOIN persona p ON i.id_propietario = p.id_persona
                INNER JOIN instrumento inst ON i.id_instrumento = inst.id_instrumento
                INNER JOIN emisor e ON inst.id_emisor = e.id_emisor
                WHERE a.fecha_pago BETWEEN _initialDate AND _finalDate
                    AND i.id_estado_inversion = 128
                    AND i.eliminado = 0
                    AND a.id_estado_amortizacion IN (134, 135, 136)
                    AND a.eliminado = 0
                    AND (_id_grupo_familiar IS NULL OR i.id_grupo_familiar = _id_grupo_familiar)
                    AND (_id_propietario IS NULL OR i.id_propietario = _id_propietario)
                GROUP BY a.fecha_pago, p.nombres, p.apellidos, e.nombre, e.id_emisor, i.id_propietario
                ORDER BY fecha, propietario;
            END
        ");
    }
};

