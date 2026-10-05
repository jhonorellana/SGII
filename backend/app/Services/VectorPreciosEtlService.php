<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class VectorPreciosEtlService
{
    protected BvqDownloaderService $downloaderService;

    public function __construct(BvqDownloaderService $downloaderService)
    {
        $this->downloaderService = $downloaderService;
    }

    /**
     * Procesa e importa el archivo Excel de Vector de Precios Diario (BVQ)
     */
    public function importVectorPrecios(?string $filePath = null, ?string $fechaInput = null): array
    {
        $startTime = microtime(true);
        $timestamp = $fechaInput ? strtotime($fechaInput) : time();
        $aaaa = date('Y', $timestamp);
        $mm = date('m', $timestamp);
        $dd = date('d', $timestamp);

        if (!$filePath || !file_exists($filePath)) {
            $baseDir = rtrim($this->downloaderService->getBaseDirectory(), '\\/') . DIRECTORY_SEPARATOR;
            $fileRelativePath = "{$aaaa}_{$mm}" . DIRECTORY_SEPARATOR . "{$aaaa}_{$mm}_{$dd}" . DIRECTORY_SEPARATOR . "011_VectorDePreciosDiario" . DIRECTORY_SEPARATOR . "vector-precios-diario_{$aaaa}_{$mm}_{$dd}.xls";
            $targetPath = $baseDir . $fileRelativePath;

            if (file_exists($targetPath)) {
                $filePath = $targetPath;
            } else {
                // Auto-descarga desde BVQ
                $dlRes = $this->downloaderService->downloadSingleModule('vector', $fechaInput);
                if ($dlRes['success'] && file_exists($dlRes['path'])) {
                    $filePath = $dlRes['path'];
                } else {
                    // Fallback al archivo más reciente en disco si el específico del día no está
                    $searchPattern = $baseDir . '*\\*\\011_VectorDePreciosDiario\\vector-precios-diario_*.xls';
                    $files = glob($searchPattern);
                    if (!empty($files)) {
                        usort($files, function ($a, $b) {
                            return filemtime($b) - filemtime($a);
                        });
                        $filePath = $files[0];
                    }
                }
            }
        }

        if (!$filePath || !file_exists($filePath)) {
            return [
                'success' => false,
                'message' => 'No se encontró el archivo vector-precios-diario.xls en disco y falló la descarga desde la BVQ.',
                'imported_count' => 0
            ];
        }

        try {
            // Ejecutar script helper Node.js para parsing rápido con xlsx
            $nodeExec = 'node';
            $helperScript = app_path('Services/import_vector_helper.cjs');

            $cmd = sprintf('"%s" "%s" "%s"', $nodeExec, $helperScript, $filePath);
            $output = shell_exec($cmd . ' 2>&1');

            $result = json_decode($output, true);
            if (!$result || !isset($result['success']) || !$result['success']) {
                return [
                    'success' => false,
                    'message' => 'Error al analizar el archivo Excel del Vector de Precios.',
                    'output' => $output
                ];
            }

            $fechaVector = $result['fecha_vector'];
            $preciosData = $result['data_precios'] ?? [];
            $curvaData = $result['data_curva'] ?? [];

            Log::info("Iniciando importación Vector de Precios ($fechaVector): " . count($preciosData) . " precios, " . count($curvaData) . " puntos de curva.");

            DB::beginTransaction();

            // 1. Guardar o actualizar Matriz de Precios (vector_precio_diario)
            $preciosInsert = [];
            $now = now();

            foreach ($preciosData as $p) {
                $fEmision = (!empty($p['fecha_emision']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $p['fecha_emision'])) ? $p['fecha_emision'] : null;
                $fVencimiento = (!empty($p['fecha_vencimiento']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $p['fecha_vencimiento'])) ? $p['fecha_vencimiento'] : null;

                $preciosInsert[] = [
                    'fecha_vector' => $fechaVector,
                    'codigo_titulo_vector' => $p['codigo_titulo_vector'],
                    'nemo_emisor' => substr($p['nemo_emisor'] ?? '', 0, 50),
                    'nombre_emisor' => substr($p['nombre_emisor'] ?? '', 0, 255),
                    'clase_titulo' => substr($p['clase_titulo'] ?? '', 0, 100),
                    'calificacion_riesgo' => substr($p['calificacion_riesgo'] ?? '', 0, 20),
                    'precio_porcentaje' => (float) ($p['precio_porcentaje'] ?? 100),
                    'tasa_descuento_tir' => (float) ($p['tasa_descuento_tir'] ?? 0),
                    'tasa_cupon' => (float) ($p['tasa_cupon'] ?? 0),
                    'plazo_dias_remanentes' => (int) ($p['plazo_dias_remanentes'] ?? 0),
                    'fecha_emision' => $fEmision,
                    'fecha_vencimiento' => $fVencimiento,
                    'forma_reajuste' => substr($p['forma_reajuste'] ?? '', 0, 150),
                    'created_at' => $now,
                    'updated_at' => $now
                ];
            }

            // Insertar en lotes de 200 registros
            foreach (array_chunk($preciosInsert, 200) as $chunk) {
                DB::connection('mysql_inversion')->table('vector_precio_diario')->upsert(
                    $chunk,
                    ['fecha_vector', 'codigo_titulo_vector'],
                    [
                        'nemo_emisor', 'nombre_emisor', 'clase_titulo', 'calificacion_riesgo',
                        'precio_porcentaje', 'tasa_descuento_tir', 'tasa_cupon',
                        'plazo_dias_remanentes', 'fecha_emision', 'fecha_vencimiento',
                        'forma_reajuste', 'updated_at'
                    ]
                );
            }

            // 2. Guardar o actualizar Curva de Rendimiento (vector_curva_rendimiento)
            $curvaInsert = [];
            foreach ($curvaData as $c) {
                $curvaInsert[] = [
                    'fecha_vector' => $fechaVector,
                    'plazo_dias' => $c['plazo_dias'],
                    'tasa_tir' => $c['tasa_tir'],
                    'created_at' => $now,
                    'updated_at' => $now
                ];
            }

            foreach (array_chunk($curvaInsert, 500) as $chunkCurva) {
                DB::connection('mysql_inversion')->table('vector_curva_rendimiento')->upsert(
                    $chunkCurva,
                    ['fecha_vector', 'plazo_dias'],
                    ['tasa_tir', 'updated_at']
                );
            }

            // 3. Actualizar la calificación de riesgo de emisores si coincide con emisor
            $uniqueEmisores = DB::connection('mysql_inversion')->table('vector_precio_diario')
                ->where('fecha_vector', $fechaVector)
                ->whereNotNull('nombre_emisor')
                ->whereNotNull('calificacion_riesgo')
                ->select('nombre_emisor', 'nemo_emisor', 'calificacion_riesgo')
                ->groupBy('nombre_emisor', 'nemo_emisor', 'calificacion_riesgo')
                ->get();

            foreach ($uniqueEmisores as $e) {
                DB::table('emisor')
                    ->where('sigla', 'LIKE', '%' . $e->nemo_emisor . '%')
                    ->orWhere('nombre', 'LIKE', '%' . $e->nombre_emisor . '%')
                    ->update([
                        'calificacion_riesgo' => $e->calificacion_riesgo,
                        'fecha_actualizacion' => $now
                    ]);
            }

            // 4. Retención inteligente quincenal (Conservar inicio de mes, quincena y el vector activo más reciente)
            $latestMaxDate = DB::connection('mysql_inversion')->table('vector_precio_diario')->max('fecha_vector');
            if ($latestMaxDate) {
                DB::connection('mysql_inversion')->table('vector_precio_diario')
                    ->where('fecha_vector', '<', $latestMaxDate)
                    ->whereRaw('DAY(fecha_vector) NOT IN (1, 2, 3, 15, 16)')
                    ->delete();

                DB::connection('mysql_inversion')->table('vector_curva_rendimiento')
                    ->where('fecha_vector', '<', $latestMaxDate)
                    ->whereRaw('DAY(fecha_vector) NOT IN (1, 2, 3, 15, 16)')
                    ->delete();
            }

            DB::commit();

            $executionTime = round(microtime(true) - $startTime, 2);

            return [
                'success' => true,
                'message' => "Vector de Precios ($fechaVector) procesado exitosamente en {$executionTime}s.",
                'fecha_vector' => $fechaVector,
                'total_precios_importados' => count($preciosInsert),
                'total_curva_importados' => count($curvaInsert),
                'file_processed' => basename($filePath)
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Error importando Vector de Precios: " . $e->getMessage());
            return [
                'success' => false,
                'message' => "Error al guardar los datos del Vector de Precios: " . $e->getMessage()
            ];
        }
    }
}
