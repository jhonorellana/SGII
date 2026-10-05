<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class StoredProcedureService
{
    /**
     * Ejecuta la secuencia completa de los 8 procedimientos almacenados (SPs) requeridos
     */
    public function executeAllProcedures(): array
    {
        $startTimeGlobal = microtime(true);

        $spList = [
            [
                'id' => 1,
                'modulo' => 'inversion',
                'name' => 'inversion.SP_ACTUALIZAR_SHARES_LAST_DATE',
                'connection' => 'mysql_inversion',
                'sql' => 'CALL SP_ACTUALIZAR_SHARES_LAST_DATE()',
                'description' => 'Actualiza fechas recientes de acciones'
            ],
            [
                'id' => 2,
                'modulo' => 'inversion',
                'name' => 'inversion.SP_ACTUALIZAR_RESUMEN_QUINCENAL',
                'connection' => 'mysql_inversion',
                'sql' => 'CALL SP_ACTUALIZAR_RESUMEN_QUINCENAL()',
                'description' => 'Actualiza resumen quincenal de títulos'
            ],
            [
                'id' => 3,
                'modulo' => 'inversion',
                'name' => 'inversion.SP_LIMPIAR_TEMPORALES',
                'connection' => 'mysql_inversion',
                'sql' => 'CALL SP_LIMPIAR_TEMPORALES()',
                'description' => 'Limpia registros y tablas temporales'
            ],
            [
                'id' => 4,
                'modulo' => 'sipro_desa',
                'name' => 'sipro_desa.SP_ACTUALIZAR_AMORTIZACION_INVERSION(NULL, NULL)',
                'connection' => 'mysql',
                'sql' => 'CALL SP_ACTUALIZAR_AMORTIZACION_INVERSION(NULL, NULL)',
                'description' => 'Actualiza cuotas y estado de amortización sipro_desa'
            ],
            [
                'id' => 5,
                'modulo' => 'sipro_desa',
                'name' => 'sipro_desa.SP_ACCION_ULTIMO_PRECIO_REFRESH',
                'connection' => 'mysql',
                'sql' => 'CALL SP_ACCION_ULTIMO_PRECIO_REFRESH()',
                'description' => 'Refresca precio de cierre de acciones sipro_desa'
            ],
            [
                'id' => 6,
                'modulo' => 'sipro_desa',
                'name' => 'sipro_desa.sp_actualizar_snapshot_cartera',
                'connection' => 'mysql',
                'sql' => 'CALL sp_actualizar_snapshot_cartera()',
                'description' => 'Actualiza el snapshot consolidado de cartera'
            ]
        ];

        $executedResults = [];
        $totalExitosos = 0;
        $totalFallidos = 0;

        foreach ($spList as $sp) {
            $startSp = microtime(true);
            try {
                // Ejecutar procedimiento en la conexión correspondiente
                DB::connection($sp['connection'])->statement($sp['sql']);
                $spTime = round(microtime(true) - $startSp, 3);
                $totalExitosos++;

                $executedResults[] = [
                    'id' => $sp['id'],
                    'name' => $sp['name'],
                    'description' => $sp['description'],
                    'connection' => $sp['connection'],
                    'success' => true,
                    'message' => "Ejecutado exitosamente en {$spTime}s.",
                    'tiempo_segundos' => $spTime
                ];
            } catch (\Throwable $e) {
                $spTime = round(microtime(true) - $startSp, 3);
                $totalFallidos++;
                Log::error("Error ejecutando SP {$sp['name']}: " . $e->getMessage());

                $executedResults[] = [
                    'id' => $sp['id'],
                    'name' => $sp['name'],
                    'description' => $sp['description'],
                    'connection' => $sp['connection'],
                    'success' => false,
                    'message' => "Error al ejecutar: " . $e->getMessage(),
                    'error_detail' => $e->getMessage(),
                    'tiempo_segundos' => $spTime
                ];
            }
        }

        $executionTimeGlobal = round(microtime(true) - $startTimeGlobal, 2);

        return [
            'success' => ($totalFallidos === 0),
            'message' => ($totalFallidos === 0)
                ? "Se ejecutaron exitosamente los 6 Procedimientos Almacenados en {$executionTimeGlobal}s."
                : "Ejecución finalizada con {$totalExitosos} SPs exitosos y {$totalFallidos} observaciones en {$executionTimeGlobal}s.",
            'total_sps' => count($spList),
            'exitosos' => $totalExitosos,
            'fallidos' => $totalFallidos,
            'tiempo_total_segundos' => $executionTimeGlobal,
            'detalles' => $executedResults
        ];
    }
}
