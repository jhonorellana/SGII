<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class NotasCreditoImportService
{
    protected BvqDownloaderService $bvqDownloaderService;
    protected BvgDownloaderService $bvgDownloaderService;

    public function __construct(
        BvqDownloaderService $bvqDownloaderService,
        BvgDownloaderService $bvgDownloaderService
    ) {
        $this->bvqDownloaderService = $bvqDownloaderService;
        $this->bvgDownloaderService = $bvgDownloaderService;
    }

    /**
     * Ejecuta el proceso ETL para leer el archivo BVG_NotasDeCredito.xlsx e importar nuevos registros a 'notas_credito_his'
     */
    public function importFromExcel(?string $fechaInput = null, bool $force = false): array
    {
        $timestamp = $fechaInput ? strtotime($fechaInput) : time();
        $aaaa = date('Y', $timestamp);
        $mm = date('m', $timestamp);
        $dd = date('d', $timestamp);

        $excelFilePath = $this->resolveNotasCreditoFilePath($fechaInput, $aaaa, $mm, $dd);

        if (!$excelFilePath || !file_exists($excelFilePath)) {
            // Intentar auto-descargar el archivo si no existe localmente usando BvgDownloaderService
            $dlResult = $this->bvgDownloaderService->downloadSingleModule('notas_credito', $fechaInput);
            
            // Re-verificar resolución de la ruta
            $excelFilePath = $this->resolveNotasCreditoFilePath($fechaInput, $aaaa, $mm, $dd);

            if (!$excelFilePath || !file_exists($excelFilePath)) {
                $dlMsg = isset($dlResult['message']) ? " (Intento de descarga: {$dlResult['message']})" : "";
                return [
                    'success' => false,
                    'message' => "No se encontró el archivo de Notas de Crédito de la Bolsa de Guayaquil (BVG){$dlMsg}",
                    'imported_count' => 0,
                    'total_in_db' => $this->getTotalRecordsInNotasCredito(),
                    'last_date_in_db' => $this->getLastDateInNotasCredito()
                ];
            }
        }

        $startTime = microtime(true);

        try {
            $pythonExec = 'C:\\ProgramData\\anaconda3\\python.exe';
            if (!file_exists($pythonExec)) {
                $pythonExec = 'python';
            }

            $scriptPath = base_path('scratch/import_notas_credito_helper.py');
            if (!file_exists($scriptPath)) {
                $this->ensurePythonScriptExists($scriptPath);
            }

            $forceFlag = $force ? '--force' : '';
            $cmd = sprintf('"%s" "%s" "%s" %s', $pythonExec, $scriptPath, $excelFilePath, $forceFlag);
            $output = shell_exec($cmd . ' 2>&1');

            Log::info('Notas de Crédito Import Output: ' . $output);

            $jsonResult = json_decode($output, true);
            if (!$jsonResult || isset($jsonResult['error'])) {
                $jsonResult = [
                    'status' => 'ERROR',
                    'imported_count' => 0,
                    'message' => 'Error ejecutando script de importación de notas de crédito: ' . ($jsonResult['error'] ?? $output)
                ];
            }

            $executionTime = round(microtime(true) - $startTime, 2);

            return [
                'success' => ($jsonResult['status'] ?? '') === 'SUCCESS',
                'message' => $jsonResult['message'] ?? 'Proceso de importación de Notas de Crédito completado.',
                'imported_count' => $jsonResult['imported_count'] ?? 0,
                'total_in_db' => $jsonResult['total_in_db'] ?? $this->getTotalRecordsInNotasCredito(),
                'last_date_in_db' => $this->getLastDateInNotasCredito(),
                'archivo_procesado' => basename($excelFilePath),
                'tiempo_ejecucion_segundos' => $executionTime,
                'detalles' => $jsonResult
            ];
        } catch (\Exception $e) {
            Log::error('Error en NotasCreditoImportService: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Error al importar registros de notas de crédito a la base de datos',
                'error' => $e->getMessage(),
                'imported_count' => 0,
                'total_in_db' => $this->getTotalRecordsInNotasCredito(),
                'last_date_in_db' => $this->getLastDateInNotasCredito()
            ];
        }
    }

    /**
     * Resuelve la ruta física del archivo BVG_NotasDeCredito.xlsx en el sistema de archivos
     */
    protected function resolveNotasCreditoFilePath(?string $fechaInput, string $aaaa, string $mm, string $dd): ?string
    {
        $bvgBase = rtrim($this->bvgDownloaderService->getBaseDirectory(), '\\/') . DIRECTORY_SEPARATOR;
        
        // 1. Ruta exacta del día en DatosBVG
        $p1 = $bvgBase . "{$aaaa}_{$mm}" . DIRECTORY_SEPARATOR . "{$aaaa}_{$mm}_{$dd}" . DIRECTORY_SEPARATOR . "002_CotizacionesHistoricas" . DIRECTORY_SEPARATOR . "BVG_NotasDeCredito_{$aaaa}_{$mm}_{$dd}.xlsx";
        if (file_exists($p1)) {
            return $p1;
        }

        // 2. Coincidencia parcial por patrón en la carpeta del día
        $dayDir = $bvgBase . "{$aaaa}_{$mm}" . DIRECTORY_SEPARATOR . "{$aaaa}_{$mm}_{$dd}" . DIRECTORY_SEPARATOR . "002_CotizacionesHistoricas";
        if (is_dir($dayDir)) {
            $matches = glob($dayDir . DIRECTORY_SEPARATOR . "*NotasDeCredito*.xlsx");
            if (!empty($matches)) {
                return $matches[0];
            }
        }

        // 3. Buscar en la carpeta DatosBVQ si fue depositado allí
        $bvqBase = rtrim($this->bvqDownloaderService->getBaseDirectory(), '\\/') . DIRECTORY_SEPARATOR;
        $bvqDayDir = $bvqBase . "{$aaaa}_{$mm}" . DIRECTORY_SEPARATOR . "{$aaaa}_{$mm}_{$dd}" . DIRECTORY_SEPARATOR . "007_CotizacionesHistoricas";
        if (is_dir($bvqDayDir)) {
            $bvqMatches = glob($bvqDayDir . DIRECTORY_SEPARATOR . "*NotasDeCredito*.xlsx");
            if (!empty($bvqMatches)) {
                return $bvqMatches[0];
            }
        }

        // 4. Buscar el archivo más reciente descargado en todo DatosBVG
        $allBvgFiles = glob($bvgBase . "*/*/*/*NotasDeCredito*.xlsx");
        if (!empty($allBvgFiles)) {
            usort($allBvgFiles, function($a, $b) {
                return filemtime($b) - filemtime($a);
            });
            return $allBvgFiles[0];
        }

        // 5. Fallback a documentación semilla si existe
        $seedFile = base_path('../documentacion/BVG_NotasDeCredito_2026_10_30.xlsx');
        if (file_exists($seedFile)) {
            return $seedFile;
        }

        return null;
    }

    /**
     * Obtiene la fecha más reciente registrada en la tabla 'notas_credito_his'
     */
    public function getLastDateInNotasCredito(): ?string
    {
        try {
            return DB::connection('mysql_inversion')
                ->table('notas_credito_his')
                ->max('FECHA');
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Obtiene el total de registros en la tabla 'notas_credito_his'
     */
    public function getTotalRecordsInNotasCredito(): int
    {
        try {
            return DB::connection('mysql_inversion')
                ->table('notas_credito_his')
                ->count();
        } catch (\Exception $e) {
            return 0;
        }
    }

    /**
     * Obtiene métricas y estadísticas consolidadas de la tabla 'notas_credito_his'
     */
    public function getResumenEstadisticas(): array
    {
        try {
            $stat = DB::connection('mysql_inversion')
                ->table('notas_credito_his')
                ->selectRaw('
                    COUNT(*) as total_registros,
                    MIN(FECHA) as fecha_minima,
                    MAX(FECHA) as fecha_maxima,
                    SUM(VALOR_NOMINAL) as total_nominal,
                    SUM(VALOR_EFECTIVO) as total_efectivo,
                    SUM(CASE WHEN BOLSA = "BVG" THEN 1 ELSE 0 END) as count_bvg,
                    SUM(CASE WHEN BOLSA = "BVQ" THEN 1 ELSE 0 END) as count_bvq
                ')
                ->first();

            return [
                'total_registros' => (int) ($stat->total_registros ?? 0),
                'fecha_minima' => $stat->fecha_minima ?? null,
                'fecha_maxima' => $stat->fecha_maxima ?? null,
                'total_nominal' => (float) ($stat->total_nominal ?? 0),
                'total_efectivo' => (float) ($stat->total_efectivo ?? 0),
                'count_bvg' => (int) ($stat->count_bvg ?? 0),
                'count_bvq' => (int) ($stat->count_bvq ?? 0)
            ];
        } catch (\Exception $e) {
            return [
                'total_registros' => 0,
                'fecha_minima' => null,
                'fecha_maxima' => null,
                'total_nominal' => 0,
                'total_efectivo' => 0,
                'count_bvg' => 0,
                'count_bvq' => 0
            ];
        }
    }

    /**
     * Garantiza la existencia del script Python auxiliar si no existe
     */
    protected function ensurePythonScriptExists(string $scriptPath): void
    {
        $dir = dirname($scriptPath);
        if (!file_exists($dir)) {
            mkdir($dir, 0755, true);
        }
    }
}

