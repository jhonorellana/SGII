<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('inversion', 'saldo_capital_actual')) {
            Schema::table('inversion', function (Blueprint $table) {
                $table->decimal('saldo_capital_actual', 18, 2)->nullable()->after('capital_invertido');
            });
        }

        // Poblado inicial de saldo_capital_actual para todas las inversiones existentes
        DB::statement("
            UPDATE inversion I
            LEFT JOIN (
                SELECT id_inversion, 
                       SUM(CASE WHEN id_estado_amortizacion = 134 THEN capital ELSE 0 END) AS saldo_pendiente,
                       COUNT(*) AS total_cuotas
                FROM amortizacion
                WHERE eliminado = 0
                GROUP BY id_inversion
            ) A ON I.id_inversion = A.id_inversion
            SET I.saldo_capital_actual = CASE 
                    WHEN I.id_estado_inversion = 129 THEN 0.00
                    WHEN A.total_cuotas IS NOT NULL AND A.total_cuotas > 0 THEN A.saldo_pendiente
                    ELSE I.capital_invertido
                END;
        ");

        // Actualización del Procedimiento Almacenado SP_ACTUALIZAR_AMORTIZACION_INVERSION
        DB::unprepared("DROP PROCEDURE IF EXISTS SP_ACTUALIZAR_AMORTIZACION_INVERSION");
        
        DB::unprepared("
            CREATE PROCEDURE `SP_ACTUALIZAR_AMORTIZACION_INVERSION`(IN `p_fecha_corte` DATE, IN `p_nuevo_estado_cuota` INT)
            BEGIN
                /*
                  ========================================================================================
                  PROCEDIMIENTO ALMACENADO: SP_ACTUALIZAR_AMORTIZACION_INVERSION
                  PROYECTO: SIPRO_07
                  
                  DESCRIPCIÓN:
                  Actualiza el estado de las amortizaciones/cuotas vencidas, recalcula el saldo_capital_actual
                  vigente de las inversiones y finaliza aquellas cuyo plazo expiró.
                  
                  PARÁMETROS:
                  - p_fecha_corte: Fecha límite para evaluar vencimiento (Si es NULL se usa CURDATE()).
                  - p_nuevo_estado_cuota: ID de catálogo para cuotas vencidas (Ej: 135=Pagada, 136=Morosa). 
                                          Si es NULL por defecto asigna 135 (Pagada).
                  ========================================================================================
                */

                IF p_fecha_corte IS NULL THEN
                    SET p_fecha_corte = CURDATE();
                END IF;

                IF p_nuevo_estado_cuota IS NULL THEN
                    SET p_nuevo_estado_cuota = 135; -- Por defecto: 135 (Pagada)
                END IF;

                -- ========================================================================================
                -- PASO 1: Actualizar cuotas pendientes (134) cuya fecha de pago sea menor o igual a p_fecha_corte
                -- ========================================================================================
                UPDATE amortizacion A
                INNER JOIN inversion I ON A.id_inversion = I.id_inversion
                SET A.id_estado_amortizacion = p_nuevo_estado_cuota,
                    A.fecha_actualizacion = NOW()
                WHERE A.fecha_pago <= p_fecha_corte
                  AND A.id_estado_amortizacion = 134 -- Solo cuotas Pendientes de pago
                  AND A.eliminado = 0
                  AND I.fecha_venta IS NULL        -- Solo inversiones no vendidas
                  AND I.id_estado_inversion = 128  -- Solo inversiones activas
                  AND I.eliminado = 0;

                -- ========================================================================================
                -- PASO 2: Recalcular saldo_capital_actual en inversiones activas segun cuotas pendientes
                -- ========================================================================================
                UPDATE inversion I
                LEFT JOIN (
                    SELECT id_inversion, 
                           SUM(CASE WHEN id_estado_amortizacion = 134 THEN capital ELSE 0 END) AS saldo_pendiente,
                           COUNT(*) AS total_cuotas
                    FROM amortizacion
                    WHERE eliminado = 0
                    GROUP BY id_inversion
                ) A ON I.id_inversion = A.id_inversion
                SET I.saldo_capital_actual = CASE 
                        WHEN A.total_cuotas IS NOT NULL AND A.total_cuotas > 0 THEN A.saldo_pendiente
                        ELSE I.capital_invertido
                    END,
                    I.fecha_actualizacion = NOW()
                WHERE I.id_estado_inversion = 128
                  AND I.eliminado = 0;

                -- ========================================================================================
                -- PASO 3: Actualizar inversiones activas (128) cuya fecha de vencimiento expiró a Finalizada (129)
                -- ========================================================================================
                UPDATE inversion I
                INNER JOIN instrumento inst ON I.id_instrumento = inst.id_instrumento
                SET I.id_estado_inversion = 129,   -- 129 = Finalizada / Pagada
                    I.saldo_capital_actual = 0.00,
                    I.fecha_actualizacion = NOW()
                WHERE inst.fecha_vencimiento <= p_fecha_corte
                  AND I.id_estado_inversion = 128  -- Solo inversiones activas
                  AND I.fecha_venta IS NULL        -- Solo inversiones no vendidas
                  AND I.eliminado = 0
                  -- Asegurar que no le queden cuotas pendientes de cobro
                  AND NOT EXISTS (
                      SELECT 1 
                      FROM amortizacion subA 
                      WHERE subA.id_inversion = I.id_inversion 
                        AND subA.id_estado_amortizacion = 134 
                        AND subA.eliminado = 0
                  );

            END
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('inversion', 'saldo_capital_actual')) {
            Schema::table('inversion', function (Blueprint $table) {
                $table->dropColumn('saldo_capital_actual');
            });
        }
    }
};
