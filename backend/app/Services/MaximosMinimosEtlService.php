<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class MaximosMinimosEtlService
{
    protected string $baseDir = 'D:\\004. DatosBVQ';
    protected ?BvqDownloaderService $downloaderService = null;

    public function __construct(?BvqDownloaderService $downloaderService = null)
    {
        $this->downloaderService = $downloaderService;
    }

    /**
     * Obtiene la última fecha registrada en la tabla 'maximos_minimos_acciones'
     */
    public function getLastDateInDb(): ?string
    {
        try {
            return DB::connection('mysql_inversion')
                ->table('maximos_minimos_acciones')
                ->max('fecha_informacion');
        } catch (\Throwable $e) {
            Log::warning("Error al obtener última fecha de maximos_minimos_acciones: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Obtiene el total de registros en la tabla 'maximos_minimos_acciones'
     */
    public function getTotalRecordsInDb(): int
    {
        try {
            return DB::connection('mysql_inversion')
                ->table('maximos_minimos_acciones')
                ->count();
        } catch (\Throwable $e) {
            Log::warning("Error al contar registros de maximos_minimos_acciones: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Importa el archivo correspondiente a una fecha dada
     */
    public function importDate(string $fecha): array
    {
        $dt = strtotime($fecha);
        if (!$dt) {
            return [
                'success' => false,
                'message' => "Fecha inválida: {$fecha}",
                'count' => 0,
                'imported_count' => 0,
                'last_date_in_db' => $this->getLastDateInDb()
            ];
        }
        $aaaa = date('Y', $dt);
        $mm = date('m', $dt);
        $dd = date('d', $dt);

        $baseDirs = [];
        if ($this->downloaderService) {
            $baseDirs[] = rtrim($this->downloaderService->getBaseDirectory(), '\\/');
        }
        $envDir = env('BVQ_DOWNLOAD_DIR');
        if ($envDir) {
            $baseDirs[] = rtrim($envDir, '\\/');
        }
        $baseDirs[] = 'C:\\Users\\super\\DATOS\\004. DatosBVQ';
        $baseDirs[] = 'D:\\004. DatosBVQ';
        $baseDirs = array_values(array_unique($baseDirs));

        $candidates = [];
        foreach ($baseDirs as $dir) {
            // Estructura oficial del downloader: {dir}/{aaaa}_{mm}/{aaaa}_{mm}_{dd}/001_InformacionContinua/maximos-y-minimos_{aaaa}_{mm}_{dd}.xls
            $candidates[] = "{$dir}\\{$aaaa}_{$mm}\\{$aaaa}_{$mm}_{$dd}\\001_InformacionContinua\\maximos-y-minimos_{$aaaa}_{$mm}_{$dd}.xls";
            $candidates[] = "{$dir}\\{$aaaa}_{$mm}\\{$aaaa}_{$mm}_{$dd}\\001_InformacionContinua\\maximos-y-minimos.xls";
            $candidates[] = "{$dir}\\{$aaaa}_{$mm}\\{$aaaa}_{$mm}_{$dd}\\maximos-y-minimos_{$aaaa}_{$mm}_{$dd}.xls";
            // Estructura histórica por año: {dir}/{aaaa}/{aaaa}_{mm}/{aaaa}_{mm}_{dd}/001_InformacionContinua/maximos-y-minimos_{aaaa}_{mm}_{dd}.xls
            $candidates[] = "{$dir}\\{$aaaa}\\{$aaaa}_{$mm}\\{$aaaa}_{$mm}_{$dd}\\001_InformacionContinua\\maximos-y-minimos_{$aaaa}_{$mm}_{$dd}.xls";
            $candidates[] = "{$dir}\\{$aaaa}\\{$aaaa}_{$mm}\\{$aaaa}_{$mm}_{$dd}\\001_InformacionContinua\\maximos-y-minimos.xls";
            $candidates[] = "{$dir}\\{$aaaa}\\{$aaaa}_{$mm}\\{$aaaa}_{$mm}_{$dd}\\maximos-y-minimos.xls";
            $candidates[] = "{$dir}\\{$aaaa}\\{$aaaa}_{$mm}\\{$mm}_{$dd}\\001_InformacionContinua\\maximos-y-minimos.xls";
        }

        foreach ($candidates as $cand) {
            if (file_exists($cand)) {
                return $this->importFile($cand);
            }
        }

        // Si no existe localmente, intentar descarga automática vía BvqDownloaderService
        if ($this->downloaderService) {
            $dlRes = $this->downloaderService->downloadSingleModule('maximos-y-minimos', $fecha);
            if ($dlRes['success'] && !empty($dlRes['path']) && file_exists($dlRes['path'])) {
                return $this->importFile($dlRes['path']);
            }
        }

        return [
            'success' => false,
            'message' => "No se encontró el archivo de máximos y mínimos para la fecha {$fecha}.",
            'count' => 0,
            'imported_count' => 0,
            'last_date_in_db' => $this->getLastDateInDb()
        ];
    }

    /**
     * Importa un archivo individual de maximos_minimos
     */
    public function importFile(string $filePath): array
    {
        if (!file_exists($filePath)) {
            return [
                'success' => false,
                'message' => "Archivo no encontrado: {$filePath}",
                'count' => 0
            ];
        }

        $helperScript = app_path('Services/import_maximos_minimos_helper.cjs');
        $cmd = sprintf('node "%s" --file "%s"', $helperScript, $filePath);
        $output = shell_exec($cmd . ' 2>&1');

        $result = json_decode($output, true);
        if (!$result || !isset($result['success']) || !$result['success']) {
            $msg = $result['error'] ?? 'Error desconocido al parsear con Node.js';
            return [
                'success' => false,
                'message' => $msg,
                'count' => 0,
                'imported_count' => 0,
                'last_date_in_db' => $this->getLastDateInDb(),
                'total_in_db' => $this->getTotalRecordsInDb()
            ];
        }

        $records = $result['records'] ?? [];
        if (empty($records)) {
            return [
                'success' => true,
                'message' => 'No se encontraron registros de datos en el archivo.',
                'count' => 0,
                'imported_count' => 0,
                'last_date_in_db' => $this->getLastDateInDb(),
                'total_in_db' => $this->getTotalRecordsInDb(),
                'fecha_informacion' => $result['fecha_informacion'] ?? null
            ];
        }

        $inserted = $this->saveRecords($records);

        return [
            'success' => true,
            'message' => "Se procesaron {$inserted} registros correctamente en maximos_minimos_acciones.",
            'count' => $inserted,
            'imported_count' => $inserted,
            'last_date_in_db' => $this->getLastDateInDb(),
            'total_in_db' => $this->getTotalRecordsInDb(),
            'fecha_informacion' => $result['fecha_informacion'] ?? null,
            'fecha_vigencia' => $result['fecha_vigencia'] ?? null,
        ];
    }

    /**
     * Importa todos los archivos de un año o directorio
     */
    public function importDirectory(string $targetDir, ?callable $progressCallback = null): array
    {
        if (!is_dir($targetDir)) {
            return [
                'success' => false,
                'message' => "Directorio no encontrado: {$targetDir}",
                'files_processed' => 0,
                'total_records' => 0
            ];
        }

        $tempOut = storage_path('app/temp_maxmin_' . uniqid() . '.json');
        $helperScript = app_path('Services/import_maximos_minimos_helper.cjs');

        $cmd = sprintf('node "%s" --batch "%s" --out "%s"', $helperScript, $targetDir, $tempOut);
        $output = shell_exec($cmd . ' 2>&1');

        $meta = json_decode($output, true);
        if (!$meta || !file_exists($tempOut)) {
            return [
                'success' => false,
                'message' => "Fallo al ejecutar batch parser en Node.js: {$output}",
                'files_processed' => 0,
                'total_records' => 0
            ];
        }

        $fileContent = file_get_contents($tempOut);
        @unlink($tempOut);

        $data = json_decode($fileContent, true);
        if (!$data || !isset($data['records'])) {
            return [
                'success' => false,
                'message' => 'El JSON generado por el batch parser está vacío o inválido.',
                'files_processed' => 0,
                'total_records' => 0
            ];
        }

        $records = $data['records'];
        $totalSaved = $this->saveRecords($records, $progressCallback);

        return [
            'success' => true,
            'target_dir' => $targetDir,
            'total_files' => $data['total_files'] ?? 0,
            'files_processed' => $data['files_processed'] ?? 0,
            'errors' => $data['errors'] ?? 0,
            'total_records' => $totalSaved
        ];
    }

    /**
     * Guarda / actualiza registros en bloques
     */
    protected function saveRecords(array $records, ?callable $progressCallback = null): int
    {
        if (empty($records)) {
            return 0;
        }

        $now = now();
        $prepared = [];
        foreach ($records as $r) {
            if (empty($r['fecha_informacion']) || empty($r['codigo_seb'])) {
                continue;
            }

            $prepared[] = [
                'fecha_informacion' => $r['fecha_informacion'],
                'fecha_vigencia' => $r['fecha_vigencia'],
                'es_liquido' => $r['es_liquido'] ? 1 : 0,
                'sector' => $r['sector'],
                'emisor' => $r['emisor'],
                'codigo_seb' => $r['codigo_seb'],
                'valor_nominal' => $r['valor_nominal'],
                'precio_cierre' => $r['precio_cierre'],
                'precio_maximo' => $r['precio_maximo'],
                'precio_minimo' => $r['precio_minimo'],
                'num_acc_ult_cierre' => $r['num_acc_ult_cierre'],
                'fecha_ult_cierre' => $r['fecha_ult_cierre'],
                'fecha_ult_negoc' => $r['fecha_ult_negoc'],
                'precio_cierre_bvq' => $r['precio_cierre_bvq'],
                'num_acc_ult_bvq' => $r['num_acc_ult_bvq'],
                'fecha_ult_cierre_bvq' => $r['fecha_ult_cierre_bvq'],
                'archivo_origen' => $r['archivo_origen'],
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $chunkSize = 1000;
        $chunks = array_chunk($prepared, $chunkSize);
        $total = 0;

        $updateColumns = [
            'fecha_vigencia',
            'es_liquido',
            'sector',
            'emisor',
            'valor_nominal',
            'precio_cierre',
            'precio_maximo',
            'precio_minimo',
            'num_acc_ult_cierre',
            'fecha_ult_cierre',
            'fecha_ult_negoc',
            'precio_cierre_bvq',
            'num_acc_ult_bvq',
            'fecha_ult_cierre_bvq',
            'archivo_origen',
            'updated_at'
        ];

        foreach ($chunks as $chunk) {
            DB::connection('mysql_inversion')
                ->table('maximos_minimos_acciones')
                ->upsert($chunk, ['fecha_informacion', 'codigo_seb'], $updateColumns);

            $countChunk = count($chunk);
            $total += $countChunk;

            if ($progressCallback) {
                $progressCallback($countChunk, $total, count($prepared));
            }
        }

        return $total;
    }
}
