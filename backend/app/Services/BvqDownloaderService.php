<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class BvqDownloaderService
{
    /**
     * Mapeo de subcarpetas de la BVQ a carpetas locales numeradas
     */
    protected array $folderMap = [
        'informacion-continua' => '001_InformacionContinua',
        'boletines-al-cierre' => '002_BoletinesAlCierre',
        'boletines-semanales' => '003_BoletinesSemanales',
        'boletines-mensuales' => '004_BoletinesMensuales',
        'boletines-valores' => '005_BoletinesValores',
        'emisiones' => '006_Emisiones',
        'cotizaciones-historicas' => '007_CotizacionesHistoricas',
        'renta-variable' => '008_RentaVariable',
        'calificaciones-de-riesgo' => '009_CalificacionesDeRiesgo',
        'sector-publico' => '010_SectorPublico',
        'vector-precios-diario' => '011_VectorDePreciosDiario',
        'vector-precios-mensual' => '012_VectorDePreciosMensual',
        'pnrv-diario' => '013_PrecioNacionalRentaVariableDiario',
        'pnrv-mensual' => '014_PrecioNacionalRentaVariableMensual'
    ];

    /**
     * Lista completa de las 42 URLs oficiales de la Bolsa de Valores de Quito
     */
    protected array $urls = [
        // 001_InformacionContinua
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/informacion-continua/boletin-diario.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/informacion-continua/ofertas-y-demandas.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/informacion-continua/maximos-y-minimos.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/informacion-continua/lista-valores-reporto.xls',

        // 002_BoletinesAlCierre
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/boletines-al-cierre/ecuindex.xls',

        // 003_BoletinesSemanales
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/boletines-semanales/pulso-semanal.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/boletines-semanales/montos-colocados.xls',

        // 004_BoletinesMensuales
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/boletines-mensuales/pulso-mensual.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/boletines-mensuales/informe-bursatil-mensual.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/boletines-mensuales/total-negociado-tipo-papel.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/boletines-mensuales/analisis-sensibilidad.pdf',

        // 005_BoletinesValores
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/boletines-valores/deuda-publica.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/boletines-valores/obligaciones.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/boletines-valores/facturas-comerciales.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/boletines-valores/valores-genericos.xls',

        // 006_Emisiones
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/emisiones/renta-fija.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/emisiones/renta-variable.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/emisiones/bonos.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/emisiones/facturas-comerciales.xls',

        // 007_CotizacionesHistoricas
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/facturas-comerciales.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/notas-credito.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/cetes.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/bonos.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/cupones.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/papel-comercial.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/tbc.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/ocas.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/vtp.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/acciones.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/valores-genericos.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/obligaciones.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/titularizaciones.xls',

        // 008_RentaVariable
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/renta-variable/dividendos.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/renta-variable/indicadores-renta-variable.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/renta-variable/montos-negociados-acciones.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/renta-variable/evolucion-precios-acciones.xls',

        // 010_SectorPublico
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/sector-publico/montos-negociados-mensuales.xls',
        'https://www.bolsadequito.com/uploads/estadisticas/boletines/sector-publico/montos-negociados-acumulados.xls',

        // 011_VectorDePreciosDiario
        'https://www.bolsadequito.com/uploads/estadisticas/valoracion/vector-precios-diario/vector-precios-diario.xls',

        // 012_VectorDePreciosMensual
        'https://www.bolsadequito.com/uploads/estadisticas/valoracion/vector-precios-mensual/vector-precios-mensual.xls',

        // 013_PrecioNacionalRentaVariableDiario
        'https://www.bolsadequito.com/uploads/estadisticas/valoracion/pnrv-diario/precio-nacional-renta-variable-diario.xls',

        // 014_PrecioNacionalRentaVariableMensual
        'https://www.bolsadequito.com/uploads/estadisticas/valoracion/pnrv-mensual/precio-nacional-renta-variable-mensual.xls'
    ];

    /**
     * Obtener el directorio base configurado para guardar las descargas de la BVQ
     */
    public function getBaseDirectory(): string
    {
        $defaultDir = 'C:\\Users\\super\\DATOS\\004. DatosBVQ\\';
        return env('BVQ_DOWNLOAD_DIR', $defaultDir);
    }

    /**
     * Ejecuta la descarga de los 42 archivos de la BVQ (soporta paralelo y aislamiento de errores por archivo)
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

        // Crear carpetas principales si no existen
        if (!File::exists($targetDayPath)) {
            File::makeDirectory($targetDayPath, 0755, true);
        }

        // Crear las 14 subcarpetas numéricas
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

        $logLines[] = "=== INICIO DESCARGA BVQ - FECHA: {$aaaa}-{$mm}-{$dd} ===";
        $logLines[] = "Directorio destino: {$targetDayPath}";

        foreach ($urlsList as $index => $url) {
            $parts = explode('/', $url);
            $archivo = end($parts);
            $carpetaRaw = $parts[count($parts) - 2] ?? '';

            $ext = '.' . pathinfo($archivo, PATHINFO_EXTENSION);
            $nombreSinExt = pathinfo($archivo, PATHINFO_FILENAME);

            $localFolder = $this->folderMap[$carpetaRaw] ?? '000_Otros';
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
                // Realizar la descarga de forma secuencial y sin verificación SSL estricta para evitar bloqueos WAF/cURL timeout
                $response = Http::withoutVerifying()
                    ->withHeaders([
                        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept' => '*/*'
                    ])
                    ->timeout(10)
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

            // Pequeña pausa de 30ms entre descargas para no saturar el servidor de la BVQ
            usleep(30000);
        }

        $executionTime = round(microtime(true) - $startTime, 2);
        $logLines[] = "=== RESUMEN: {$successCount} exitosos, {$failedCount} fallidos en {$executionTime}s ===";

        // Escribir archivo de log permanente en storage/logs/
        try {
            $logPath = storage_path("logs/bvq_download_{$aaaa}_{$mm}_{$dd}.log");
            File::append($logPath, implode(PHP_EOL, $logLines) . PHP_EOL . PHP_EOL);
        } catch (\Exception $e) {
            Log::warning("No se pudo escribir archivo de log local: " . $e->getMessage());
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
     * Descarga un archivo individual de un módulo específico de la BVQ (ej: 'acciones', 'bonos', 'dividendos', etc.)
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

        // Mapeo de módulos a su URL y subcarpeta destino
        $moduleMap = [
            'acciones' => [
                'url' => 'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/acciones.xls',
                'folder' => '007_CotizacionesHistoricas',
                'filename' => "acciones_{$aaaa}_{$mm}_{$dd}.xls"
            ],
            'bonos' => [
                'url' => 'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/bonos.xls',
                'folder' => '007_CotizacionesHistoricas',
                'filename' => "bonos_{$aaaa}_{$mm}_{$dd}.xls"
            ],
            'dividendos' => [
                'url' => 'https://www.bolsadequito.com/uploads/estadisticas/boletines/renta-variable/dividendos.xls',
                'folder' => '008_RentaVariable',
                'filename' => "dividendos_{$aaaa}_{$mm}_{$dd}.xls"
            ],
            'facturas' => [
                'url' => 'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/facturas-comerciales.xls',
                'folder' => '007_CotizacionesHistoricas',
                'filename' => "facturas-comerciales_{$aaaa}_{$mm}_{$dd}.xls"
            ],
            'genericos' => [
                'url' => 'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/valores-genericos.xls',
                'folder' => '007_CotizacionesHistoricas',
                'filename' => "valores-genericos_{$aaaa}_{$mm}_{$dd}.xls"
            ],
            'obligaciones' => [
                'url' => 'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/obligaciones.xls',
                'folder' => '007_CotizacionesHistoricas',
                'filename' => "obligaciones_{$aaaa}_{$mm}_{$dd}.xls"
            ],
            'papeles' => [
                'url' => 'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/papel-comercial.xls',
                'folder' => '007_CotizacionesHistoricas',
                'filename' => "papel-comercial_{$aaaa}_{$mm}_{$dd}.xls"
            ],
            'titularizaciones' => [
                'url' => 'https://www.bolsadequito.com/uploads/estadisticas/boletines/cotizaciones-historicas/titularizaciones.xls',
                'folder' => '007_CotizacionesHistoricas',
                'filename' => "titularizaciones_{$aaaa}_{$mm}_{$dd}.xls"
            ],
            'vector' => [
                'url' => 'https://www.bolsadequito.com/uploads/estadisticas/valoracion/vector-precios-diario/vector-precios-diario.xls',
                'folder' => '011_VectorDePreciosDiario',
                'filename' => "vector-precios-diario_{$aaaa}_{$mm}_{$dd}.xls"
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
                ->timeout(15)
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
                    'message' => "Fallo HTTP " . $response->status() . " al descargar el archivo desde la BVQ.",
                    'size_bytes' => 0
                ];
            }
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'module' => $key,
                'message' => "Excepción al descargar archivo: " . $e->getMessage(),
                'size_bytes' => 0
            ];
        }
    }

    /**
     * Escanea el historial de descargas realizadas en el directorio base
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
                // Ejemplo de nombre: 2026_09_27
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
