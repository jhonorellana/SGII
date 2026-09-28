<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DividendsImportService
{
    protected BvqDownloaderService $downloaderService;

    public function __construct(BvqDownloaderService $downloaderService)
    {
        $this->downloaderService = $downloaderService;
    }

    /**
     * Ejecuta el proceso ETL para leer el archivo dividendos_YYYY_MM_DD.xls e importar a 'dividendos_his'
     */
    public function importFromExcel(?string $fechaInput = null): array
    {
        $timestamp = $fechaInput ? strtotime($fechaInput) : time();
        $aaaa = date('Y', $timestamp);
        $mm = date('m', $timestamp);
        $dd = date('d', $timestamp);

        $baseDir = rtrim($this->downloaderService->getBaseDirectory(), '\\/') . DIRECTORY_SEPARATOR;
        $fileRelativePath = "{$aaaa}_{$mm}" . DIRECTORY_SEPARATOR . "{$aaaa}_{$mm}_{$dd}" . DIRECTORY_SEPARATOR . "008_RentaVariable" . DIRECTORY_SEPARATOR . "dividendos_{$aaaa}_{$mm}_{$dd}.xls";
        $excelFilePath = $baseDir . $fileRelativePath;

        if (!file_exists($excelFilePath)) {
            // Buscar cualquier archivo dividendos_*.xls en la carpeta de Renta Variable del día
            $dayFolderPath = $baseDir . "{$aaaa}_{$mm}" . DIRECTORY_SEPARATOR . "{$aaaa}_{$mm}_{$dd}" . DIRECTORY_SEPARATOR . "008_RentaVariable";
            $matchingFiles = glob($dayFolderPath . DIRECTORY_SEPARATOR . "dividendos_*.xls");
            if (!empty($matchingFiles)) {
                $excelFilePath = $matchingFiles[0];
            } else {
                // Intentar descargar automáticamente el archivo de dividendos si no existe en disco
                $dlRes = $this->downloaderService->downloadSingleModule('dividendos', $fechaInput);
                if ($dlRes['success'] && file_exists($dlRes['path'])) {
                    $excelFilePath = $dlRes['path'];
                } else {
                    return [
                        'success' => false,
                        'message' => "No se encontró el archivo de dividendos en disco y falló la descarga automática desde la BVQ.",
                        'imported_count' => 0,
                        'total_records_in_db' => $this->getTotalRecordsInDividends()
                    ];
                }
            }
        }

        $startTime = microtime(true);

        try {
            $pythonExec = 'C:\\ProgramData\\anaconda3\\python.exe';
            if (!file_exists($pythonExec)) {
                $pythonExec = 'python';
            }

            $scriptPath = base_path('scratch/import_dividends_helper.py');
            if (!file_exists($scriptPath)) {
                $this->ensurePythonScriptExists($scriptPath);
            }

            $cmd = sprintf('"%s" "%s" "%s"', $pythonExec, $scriptPath, $excelFilePath);
            $output = shell_exec($cmd . ' 2>&1');

            Log::info('Dividends Import Output: ' . $output);

            $jsonResult = json_decode($output, true);
            if (!$jsonResult || isset($jsonResult['error'])) {
                $jsonResult = [
                    'status' => 'ERROR',
                    'imported_count' => 0,
                    'message' => 'Error ejecutando script de importación de dividendos: ' . ($jsonResult['error'] ?? $output)
                ];
            }

            $executionTime = round(microtime(true) - $startTime, 2);

            return [
                'success' => ($jsonResult['status'] ?? '') === 'SUCCESS',
                'message' => $jsonResult['message'] ?? 'Proceso de importación de dividendos completado.',
                'imported_count' => $jsonResult['imported_count'] ?? 0,
                'total_records_in_db' => $this->getTotalRecordsInDividends(),
                'tiempo_ejecucion_segundos' => $executionTime,
                'detalles' => $jsonResult
            ];
        } catch (\Exception $e) {
            Log::error('Error en DividendsImportService: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Error al importar registros de dividendos a la base de datos',
                'error' => $e->getMessage(),
                'imported_count' => 0,
                'total_records_in_db' => $this->getTotalRecordsInDividends()
            ];
        }
    }

    /**
     * Obtiene el total de registros almacenados en la tabla 'dividendos_his'
     */
    public function getTotalRecordsInDividends(): int
    {
        try {
            return DB::connection('mysql_inversion')
                ->table('dividendos_his')
                ->count();
        } catch (\Exception $e) {
            return 0;
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

        $content = file_get_contents(base_path('scratch/import_dividends_helper.py'));
        file_put_contents($scriptPath, $content);
    }
}
