<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class BvgDownloaderService
{
    /**
     * Mapeo de subcarpetas nativas para la Bolsa de Valores de Guayaquil (BVG)
     */
    protected array $folderMap = [
        'renta-variable' => '001_RentaVariable',
        'cotizaciones-historicas' => '002_CotizacionesHistoricas',
        'vector-precios' => '003_VectorDePrecios'
    ];

    /**
     * Lista completa de las 10 URLs oficiales de la Bolsa de Valores de Guayaquil
     */
    protected array $urls = [
        // 001_RentaVariable
        'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_Acciones.xlsx',
        'https://www.bolsadevaloresguayaquil.com/boletines/historicos/dividendos-totales.xlsx',

        // 002_CotizacionesHistoricas
        'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_BonosDelEstado.xlsx',
        'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_Obligaciones.xlsx',
        'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_PapelComercial.xlsx',
        'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_Titularizaciones.xlsx',
        'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_Cetes.xlsx',
        'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_NotasDeCredito.xlsx',

        // 003_VectorDePrecios
        'https://www.bolsadevaloresguayaquil.com/boletines/valoracion/Diario/Vectores%20Final.xls',
        'https://www.bolsadevaloresguayaquil.com/boletines/valoracion/valores-permitidos.xlsx'
    ];

    /**
     * Mapeo explicito de cada archivo BVG a su subcarpeta simplificada
     */
    protected array $fileFolderMapping = [
        'BVG_Acciones.xlsx' => '001_RentaVariable',
        'dividendos-totales.xlsx' => '001_RentaVariable',
        'BVG_BonosDelEstado.xlsx' => '002_CotizacionesHistoricas',
        'BVG_Obligaciones.xlsx' => '002_CotizacionesHistoricas',
        'BVG_PapelComercial.xlsx' => '002_CotizacionesHistoricas',
        'BVG_Titularizaciones.xlsx' => '002_CotizacionesHistoricas',
        'BVG_Cetes.xlsx' => '002_CotizacionesHistoricas',
        'BVG_NotasDeCredito.xlsx' => '002_CotizacionesHistoricas',
        'Vectores Final.xls' => '003_VectorDePrecios',
        'valores-permitidos.xlsx' => '003_VectorDePrecios'
    ];

    /**
     * Obtener el directorio base configurado para guardar las descargas de la BVG
     */
    public function getBaseDirectory(): string
    {
        $defaultDir = 'C:\\Users\\super\\DATOS\\004. DatosBVG\\';
        return env('BVG_DOWNLOAD_DIR', $defaultDir);
    }

    /**
     * Ejecuta la descarga de los 10 archivos de la BVG
     */
    public function downloadAll(?string $fechaInput = null): array
    {
        $timestamp = $fechaInput ? strtotime($fechaInput) : time();
        $aaaa = date('Y', $timestamp);
        $mm = date('m', $timestamp);
        $dd = date('d', $timestamp);

        $baseDir = rtrim($this->getBaseDirectory(), '\\/') . DIRECTORY_SEPARATOR;
        $monthFolder = "{$aaaa}_{$mm}";
        $dayFolder = "{$aaaa}_{$mm}_{$dd}";
        $targetDayPath = $baseDir . $monthFolder . DIRECTORY_SEPARATOR . $dayFolder;

        // Crear carpeta principal del día si no existe
        if (!File::exists($targetDayPath)) {
            File::makeDirectory($targetDayPath, 0755, true);
        }

        // Crear únicamente las 3 subcarpetas activas de la BVG
        foreach ($this->folderMap as $subFolder) {
            $path = $targetDayPath . DIRECTORY_SEPARATOR . $subFolder;
            if (!File::exists($path)) {
                File::makeDirectory($path, 0755, true);
            }
        }

        $startTime = microtime(true);
        $urlsList = array_values($this->urls);

        $results = [];
        $successCount = 0;
        $failedCount = 0;
        $logLines = [];

        $logLines[] = "=== INICIO DESCARGA BVG - FECHA: {$aaaa}-{$mm}-{$dd} ===";
        $logLines[] = "Directorio destino: {$targetDayPath}";

        foreach ($urlsList as $url) {
            $rawFilename = urldecode(basename(parse_url($url, PHP_URL_PATH)));
            $ext = '.' . pathinfo($rawFilename, PATHINFO_EXTENSION);
            $nombreSinExt = pathinfo($rawFilename, PATHINFO_FILENAME);

            $localFolder = $this->fileFolderMapping[$rawFilename] ?? '000_Otros';
            $nombreFinal = "{$nombreSinExt}_{$aaaa}_{$mm}_{$dd}{$ext}";

            $filePath = $targetDayPath . DIRECTORY_SEPARATOR . $localFolder . DIRECTORY_SEPARATOR . $nombreFinal;

            $fileResult = [
                'url' => $url,
                'archivo' => $nombreFinal,
                'carpeta' => $localFolder,
                'path' => $filePath,
                'status' => 'PENDING',
                'size_bytes' => 0,
                'error' => null
            ];

            try {
                $response = Http::withoutVerifying()
                    ->withHeaders([
                        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept' => '*/*'
                    ])
                    ->timeout(20)
                    ->get($url);

                if ($response->successful()) {
                    File::put($filePath, $response->body());
                    $fileResult['status'] = 'SUCCESS';
                    $fileResult['size_bytes'] = strlen($response->body());
                    $successCount++;
                    $logLines[] = "[OK] {$nombreFinal} -> Descargado ({$fileResult['size_bytes']} bytes)";
                } else {
                    $statusCode = $response->status();
                    $fileResult['status'] = 'FAILED';
                    $fileResult['error'] = 'HTTP Status ' . $statusCode;
                    $failedCount++;
                    $logLines[] = "[FALLO] {$nombreFinal} -> HTTP {$statusCode}";
                }
            } catch (\Throwable $e) {
                $fileResult['status'] = 'FAILED';
                $fileResult['error'] = $e->getMessage();
                $failedCount++;
                $logLines[] = "[EXCEPCION] {$nombreFinal} -> " . $e->getMessage();
            }

            $results[] = $fileResult;
            usleep(30000);
        }

        $executionTime = round(microtime(true) - $startTime, 2);
        $logLines[] = "=== RESUMEN BVG: {$successCount} exitosos, {$failedCount} fallidos en {$executionTime}s ===";

        // Escribir archivo de log permanente en storage/logs/
        try {
            $logPath = storage_path("logs/bvg_download_{$aaaa}_{$mm}_{$dd}.log");
            File::append($logPath, implode(PHP_EOL, $logLines) . PHP_EOL . PHP_EOL);
        } catch (\Exception $e) {
            Log::warning("No se pudo escribir archivo de log local BVG: " . $e->getMessage());
        }

        return [
            'success' => $failedCount === 0,
            'fecha' => "{$aaaa}-{$mm}-{$dd}",
            'directorio_base' => $targetDayPath,
            'total_archivos' => count($urlsList),
            'exitosos' => $successCount,
            'fallidos' => $failedCount,
            'tiempo_ejecucion_segundos' => $executionTime,
            'archivos' => $results
        ];
    }

    /**
     * Descarga un archivo individual de un módulo específico de la BVG
     */
    public function downloadSingleModule(string $module, ?string $fechaInput = null): array
    {
        $timestamp = $fechaInput ? strtotime($fechaInput) : time();
        $aaaa = date('Y', $timestamp);
        $mm = date('m', $timestamp);
        $dd = date('d', $timestamp);

        $baseDir = rtrim($this->getBaseDirectory(), '\\/') . DIRECTORY_SEPARATOR;
        $monthFolder = "{$aaaa}_{$mm}";
        $dayFolder = "{$aaaa}_{$mm}_{$dd}";
        $targetDayPath = $baseDir . $monthFolder . DIRECTORY_SEPARATOR . $dayFolder;

        $moduleMap = [
            'acciones' => [
                'url' => 'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_Acciones.xlsx',
                'folder' => '001_RentaVariable',
                'filename' => "BVG_Acciones_{$aaaa}_{$mm}_{$dd}.xlsx"
            ],
            'dividendos' => [
                'url' => 'https://www.bolsadevaloresguayaquil.com/boletines/historicos/dividendos-totales.xlsx',
                'folder' => '001_RentaVariable',
                'filename' => "dividendos-totales_{$aaaa}_{$mm}_{$dd}.xlsx"
            ],
            'bonos' => [
                'url' => 'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_BonosDelEstado.xlsx',
                'folder' => '002_CotizacionesHistoricas',
                'filename' => "BVG_BonosDelEstado_{$aaaa}_{$mm}_{$dd}.xlsx"
            ],
            'obligaciones' => [
                'url' => 'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_Obligaciones.xlsx',
                'folder' => '002_CotizacionesHistoricas',
                'filename' => "BVG_Obligaciones_{$aaaa}_{$mm}_{$dd}.xlsx"
            ],
            'papel_comercial' => [
                'url' => 'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_PapelComercial.xlsx',
                'folder' => '002_CotizacionesHistoricas',
                'filename' => "BVG_PapelComercial_{$aaaa}_{$mm}_{$dd}.xlsx"
            ],
            'papeles' => [
                'url' => 'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_PapelComercial.xlsx',
                'folder' => '002_CotizacionesHistoricas',
                'filename' => "BVG_PapelComercial_{$aaaa}_{$mm}_{$dd}.xlsx"
            ],
            'titularizaciones' => [
                'url' => 'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_Titularizaciones.xlsx',
                'folder' => '002_CotizacionesHistoricas',
                'filename' => "BVG_Titularizaciones_{$aaaa}_{$mm}_{$dd}.xlsx"
            ],
            'cetes' => [
                'url' => 'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_Cetes.xlsx',
                'folder' => '002_CotizacionesHistoricas',
                'filename' => "BVG_Cetes_{$aaaa}_{$mm}_{$dd}.xlsx"
            ],
            'notas_credito' => [
                'url' => 'https://www.bolsadevaloresguayaquil.com/boletines/historicos/BVG_NotasDeCredito.xlsx',
                'folder' => '002_CotizacionesHistoricas',
                'filename' => "BVG_NotasDeCredito_{$aaaa}_{$mm}_{$dd}.xlsx"
            ],
            'vector_precios' => [
                'url' => 'https://www.bolsadevaloresguayaquil.com/boletines/valoracion/Diario/Vectores%20Final.xls',
                'folder' => '003_VectorDePrecios',
                'filename' => "Vectores Final_{$aaaa}_{$mm}_{$dd}.xls"
            ],
            'valores_permitidos' => [
                'url' => 'https://www.bolsadevaloresguayaquil.com/boletines/valoracion/valores-permitidos.xlsx',
                'folder' => '003_VectorDePrecios',
                'filename' => "valores-permitidos_{$aaaa}_{$mm}_{$dd}.xlsx"
            ]
        ];

        $key = strtolower(trim($module));
        if (!isset($moduleMap[$key])) {
            return [
                'success' => false,
                'message' => "El módulo '{$module}' no es válido para descarga individual.",
                'size_bytes' => 0
            ];
        }

        $info = $moduleMap[$key];
        $targetFolder = $targetDayPath . DIRECTORY_SEPARATOR . $info['folder'];
        if (!File::exists($targetFolder)) {
            File::makeDirectory($targetFolder, 0755, true);
        }

        $filePath = $targetFolder . DIRECTORY_SEPARATOR . $info['filename'];

        try {
            $response = Http::withoutVerifying()
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept' => '*/*'
                ])
                ->timeout(20)
                ->get($info['url']);

            if ($response->successful()) {
                File::put($filePath, $response->body());
                return [
                    'success' => true,
                    'module' => $key,
                    'fecha' => "{$aaaa}-{$mm}-{$dd}",
                    'archivo' => $info['filename'],
                    'carpeta' => $info['folder'],
                    'path' => $filePath,
                    'size_bytes' => strlen($response->body()),
                    'message' => "El archivo {$info['filename']} fue descargado exitosamente."
                ];
            } else {
                return [
                    'success' => false,
                    'module' => $key,
                    'message' => "Fallo HTTP " . $response->status() . " al descargar el archivo desde la BVG.",
                    'size_bytes' => 0
                ];
            }
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'module' => $key,
                'message' => "Excepción al descargar archivo BVG: " . $e->getMessage(),
                'size_bytes' => 0
            ];
        }
    }

    /**
     * Escanea el historial de descargas realizadas en el directorio base de la BVG
     */
    public function getHistory(): array
    {
        $baseDir = rtrim($this->getBaseDirectory(), '\\/') . DIRECTORY_SEPARATOR;
        if (!File::exists($baseDir)) {
            return [];
        }

        $history = [];
        $monthFolders = File::directories($baseDir);

        foreach ($monthFolders as $mFolder) {
            $dayFolders = File::directories($mFolder);
            foreach ($dayFolders as $dFolder) {
                $folderName = basename($dFolder);
                if (preg_match('/^(\d{4})_(\d{2})_(\d{2})$/', $folderName, $matches)) {
                    $fechaFormatted = "{$matches[1]}-{$matches[2]}-{$matches[3]}";
                    $allFiles = File::allFiles($dFolder);
                    
                    $totalSize = 0;
                    foreach ($allFiles as $f) {
                        $totalSize += $f->getSize();
                    }

                    $history[] = [
                        'fecha' => $fechaFormatted,
                        'carpeta' => $folderName,
                        'ruta_completa' => $dFolder,
                        'total_archivos' => count($allFiles),
                        'tamano_total_mb' => round($totalSize / (1024 * 1024), 2)
                    ];
                }
            }
        }

        usort($history, function ($a, $b) {
            return strcmp($b['fecha'], $a['fecha']);
        });

        return $history;
    }
}
