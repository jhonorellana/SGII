<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Crear el stored procedure para vencimientos mensuales
        $sql = "
        DROP PROCEDURE IF EXISTS `SP_VENCIMIENTOS_MENSUALES`;
        
        DELIMITER //
        CREATE PROCEDURE `SP_VENCIMIENTOS_MENSUALES`(
            IN `_year` INT,
            IN `_month` INT
        )
        BEGIN
            -- Datos mensuales
            SELECT
                YEAR(fecha_pago) AS anio,
                CASE
                    WHEN MONTH(fecha_pago) = 1 THEN 'Enero'
                    WHEN MONTH(fecha_pago) = 2 THEN 'Febrero'
                    WHEN MONTH(fecha_pago) = 3 THEN 'Marzo'
                    WHEN MONTH(fecha_pago) = 4 THEN 'Abril'
                    WHEN MONTH(fecha_pago) = 5 THEN 'Mayo'
                    WHEN MONTH(fecha_pago) = 6 THEN 'Junio'
                    WHEN MONTH(fecha_pago) = 7 THEN 'Julio'
                    WHEN MONTH(fecha_pago) = 8 THEN 'Agosto'
                    WHEN MONTH(fecha_pago) = 9 THEN 'Septiembre'
                    WHEN MONTH(fecha_pago) = 10 THEN 'Octubre'
                    WHEN MONTH(fecha_pago) = 11 THEN 'Noviembre'
                    WHEN MONTH(fecha_pago) = 12 THEN 'Diciembre'
                END AS nombre_mes,
                MONTH(fecha_pago) AS mes,
                SUM(CASE WHEN pagada IN (1,0) THEN interes ELSE 0 END) AS interes,
                SUM(CASE WHEN pagada IN (1,0) THEN capital ELSE 0 END) AS capital,
                SUM(CASE WHEN pagada IN (1,0) THEN descuento ELSE 0 END) AS descuento,
                SUM(CASE WHEN pagada = 2 THEN interes ELSE 0 END) AS interes_moroso,
                SUM(CASE WHEN pagada = 2 THEN capital ELSE 0 END) AS capital_moroso,
                SUM(CASE WHEN pagada = 2 THEN descuento ELSE 0 END) AS descuento_moroso,
                SUM(interes) + SUM(capital) AS total
            FROM amortizacion A
            INNER JOIN inversion I ON A.id_inversion = I.id_inversion
            WHERE (_month = 0 AND YEAR(fecha_pago) = _year)
               OR (_month > 0 AND MONTH(fecha_pago) = _month AND YEAR(fecha_pago) = _year)
               AND (A.activo = 1 OR I.fecha_venta IS NULL)
               AND A.eliminado = 0
               AND I.eliminado = 0
            GROUP BY YEAR(fecha_pago), MONTH(fecha_pago)
            ORDER BY YEAR(fecha_pago), MONTH(fecha_pago);
            
            -- ANUAL TOTAL
            SELECT
                _year AS anio,
                'ANUAL TOTAL' AS nombre_mes,
                0 AS mes,
                SUM(CASE WHEN A.pagada IN (1,0) THEN A.interes ELSE 0 END) AS interes,
                SUM(CASE WHEN A.pagada IN (1,0) THEN A.capital ELSE 0 END) AS capital,
                SUM(CASE WHEN A.pagada IN (1,0) THEN A.descuento ELSE 0 END) AS descuento,
                SUM(CASE WHEN A.pagada = 2 THEN A.interes ELSE 0 END) AS interes_moroso,
                SUM(CASE WHEN A.pagada = 2 THEN A.capital ELSE 0 END) AS capital_moroso,
                SUM(CASE WHEN A.pagada = 2 THEN A.descuento ELSE 0 END) AS descuento_moroso,
                SUM(A.interes) + SUM(A.capital) AS total
            FROM amortizacion A
            INNER JOIN inversion I ON A.id_inversion = I.id_inversion
            WHERE YEAR(fecha_pago) = _year
               AND (A.activo = 1 OR I.fecha_venta IS NULL)
               AND A.eliminado = 0
               AND I.eliminado = 0;
               
            -- ANUAL EJECUTADO
            SELECT
                _year AS anio,
                'ANUAL EJECUTADO' AS nombre_mes,
                0 AS mes,
                SUM(CASE WHEN A.pagada IN (1,0) THEN A.interes ELSE 0 END) AS interes,
                SUM(CASE WHEN A.pagada IN (1,0) THEN A.capital ELSE 0 END) AS capital,
                SUM(CASE WHEN A.pagada IN (1,0) THEN A.descuento ELSE 0 END) AS descuento,
                SUM(CASE WHEN A.pagada = 2 THEN A.interes ELSE 0 END) AS interes_moroso,
                SUM(CASE WHEN A.pagada = 2 THEN A.capital ELSE 0 END) AS capital_moroso,
                SUM(CASE WHEN A.pagada = 2 THEN A.descuento ELSE 0 END) AS descuento_moroso,
                SUM(A.interes) + SUM(A.capital) AS total
            FROM amortizacion A
            INNER JOIN inversion I ON A.id_inversion = I.id_inversion
            WHERE YEAR(fecha_pago) = _year
               AND A.activo = 1
               AND A.eliminado = 0
               AND I.eliminado = 0
               AND A.fecha_pago <= CURDATE();
               
            -- ANUAL PENDIENTE
            SELECT
                _year AS anio,
                'ANUAL PENDIENTE' AS nombre_mes,
                0 AS mes,
                SUM(CASE WHEN A.pagada IN (1,0) THEN A.interes ELSE 0 END) AS interes,
                SUM(CASE WHEN A.pagada IN (1,0) THEN A.capital ELSE 0 END) AS capital,
                SUM(CASE WHEN A.pagada IN (1,0) THEN A.descuento ELSE 0 END) AS descuento,
                SUM(CASE WHEN A.pagada = 2 THEN A.interes ELSE 0 END) AS interes_moroso,
                SUM(CASE WHEN A.pagada = 2 THEN A.capital ELSE 0 END) AS capital_moroso,
                SUM(CASE WHEN A.pagada = 2 THEN A.descuento ELSE 0 END) AS descuento_moroso,
                SUM(A.interes) + SUM(A.capital) AS total
            FROM amortizacion A
            INNER JOIN inversion I ON A.id_inversion = I.id_inversion
            WHERE YEAR(fecha_pago) = _year
               AND (A.activo = 1 OR I.fecha_venta IS NULL)
               AND A.eliminado = 0
               AND I.eliminado = 0
               AND A.fecha_pago > CURDATE();
        END //
        DELIMITER ;
        ";
        
        \DB::unprepared($sql);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        \DB::unprepared('DROP PROCEDURE IF EXISTS `SP_VENCIMIENTOS_MENSUALES`');
    }
};
