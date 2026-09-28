<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FacturasImportService
{
    protected BvqDownloaderService $downloaderService;

    public function __construct(BvqDownloaderService $downloaderService)
    {
        $this->downloaderService = $downloaderService;
    }

    /**
     * Ejecuta el proceso ETL para leer el archivo facturas-comerciales_YYYY_MM_DD.xls e importar nuevos registros a 'facturas_his'
     */
    public function importFromExcel(?string $fechaInput = null): array
    {
        $timestamp = $fechaInput ? strtotime($fechaInput) : time();
        $aaaa = date('Y', $timestamp);
        $mm = date('m', $timestamp);
        $dd = date('d', $timestamp);

        $baseDir = rtrim($this->downloaderService->getBaseDirectory(), '\\/') . DIRECTORY_SEPARATOR;
        $fileRelativePath = "{$aaaa}_{$mm}" . DIRECTORY_SEPARATOR . "{$aaaa}_{$mm}_{$dd}" . DIRECTORY_SEPARATOR . "007_CotizacionesHistoricas" . DIRECTORY_SEPARATOR . "facturas-comerciales_{$aaaa}_{$mm}_{$dd}.xls";
        $excelFilePath = $baseDir . $fileRelativePath;

        if (!file_exists($excelFilePath)) {
            // Buscar cualquier archivo facturas*.xls en la carpeta de cotizaciones históricas del día
            $dayFolderPath = $baseDir . "{$aaaa}_{$mm}" . DIRECTORY_SEPARATOR . "{$aaaa}_{$mm}_{$dd}" . DIRECTORY_SEPARATOR . "007_CotizacionesHistoricas";
            $matchingFiles = glob($dayFolderPath . DIRECTORY_SEPARATOR . "*facturas*.xls");
            if (!empty($matchingFiles)) {
                $excelFilePath = $matchingFiles[0];
            } else {
                return [
                    'success' => false,
                    'message' => "No se encontró el archivo de facturas comerciales en: {$excelFilePath}",
                    'imported_count' => 0,
                    'last_date_in_db' => $this->getLastDateInFacturas()
                ];
            }
        }

        $startTime = microtime(true);

        try {
            $pythonExec = 'C:\\ProgramData\\anaconda3\\python.exe';
            if (!file_exists($pythonExec)) {
                $pythonExec = 'python';
            }

            $scriptPath = base_path('scratch/import_facturas_helper.py');
            if (!file_exists($scriptPath)) {
                $this->ensurePythonScriptExists($scriptPath);
            }

            $cmd = sprintf('"%s" "%s" "%s" "%s"', $pythonExec, $scriptPath, $excelFilePath, $aaaa);
            $output = shell_exec($cmd . ' 2>&1');

            Log::info('Facturas Import Output: ' . $output);

            $jsonResult = json_decode($output, true);
            if (!$jsonResult || isset($jsonResult['error'])) {
                $jsonResult = [
                    'status' => 'ERROR',
                    'imported_count' => 0,
                    'message' => 'Error ejecutando script de importación de facturas: ' . ($jsonResult['error'] ?? $output)
                ];
            }

            $executionTime = round(microtime(true) - $startTime, 2);

            return [
                'success' => ($jsonResult['status'] ?? '') === 'SUCCESS',
                'message' => $jsonResult['message'] ?? 'Proceso de importación de facturas completado.',
                'imported_count' => $jsonResult['imported_count'] ?? 0,
                'last_date_in_db' => $this->getLastDateInFacturas(),
                'tiempo_ejecucion_segundos' => $executionTime,
                'detalles' => $jsonResult
            ];
        } catch (\Exception $e) {
            Log::error('Error en FacturasImportService: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Error al importar registros de facturas a la base de datos',
                'error' => $e->getMessage(),
                'imported_count' => 0,
                'last_date_in_db' => $this->getLastDateInFacturas()
            ];
        }
    }

    /**
     * Obtiene la fecha más reciente registrada en la tabla 'facturas_his'
     */
    public function getLastDateInFacturas(): ?string
    {
        try {
            return DB::connection('mysql_inversion')
                ->table('facturas_his')
                ->max('FECHA');
        } catch (\Exception $e) {
            return null;
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

        $content = file_get_contents(base_path('scratch/import_facturas_helper.py'));
        file_put_contents($scriptPath, $content);
    }
}
