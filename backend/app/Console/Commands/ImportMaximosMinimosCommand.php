<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\MaximosMinimosEtlService;

class ImportMaximosMinimosCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sipro:import-maximos-minimos 
                            {file? : Ruta opcional a un archivo específico .xls}
                            {--date= : Fecha específica a importar en formato YYYY-MM-DD}
                            {--year= : Año a importar (ej. 2026)}
                            {--all : Importar todos los años disponibles (2019 al 2026)}
                            {--dir= : Directorio personalizado a importar}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Importa y procesa los reportes de Precios Máximos y Mínimos de Acciones de la BVQ en la BD inversion';

    /**
     * Execute the console command.
     */
    public function handle(MaximosMinimosEtlService $etlService)
    {
        $filePath = $this->argument('file');
        $date = $this->option('date');
        $year = $this->option('year');
        $all = $this->option('all');
        $customDir = $this->option('dir');

        $baseDir = 'D:\\004. DatosBVQ';

        // 0. Caso: fecha específica
        if ($date) {
            $this->info("Buscando y procesando archivo para la fecha: {$date}");
            $res = $etlService->importDate($date);
            if ($res['success']) {
                $this->info("✅ {$res['message']}");
                return Command::SUCCESS;
            } else {
                $this->error("❌ {$res['message']}");
                return Command::FAILURE;
            }
        }

        // 1. Caso: archivo individual
        if ($filePath) {
            $this->info("Procesando archivo individual: {$filePath}");
            $res = $etlService->importFile($filePath);
            if ($res['success']) {
                $this->info("✅ {$res['message']}");
                return Command::SUCCESS;
            } else {
                $this->error("❌ {$res['message']}");
                return Command::FAILURE;
            }
        }

        // 2. Caso: directorio personalizado
        if ($customDir) {
            $this->info("Procesando directorio: {$customDir}");
            return $this->processDirectory($etlService, $customDir);
        }

        // 3. Caso: todos los años
        if ($all) {
            $years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
            $this->info("🚀 Iniciando importación de todos los años disponibles (" . implode(', ', $years) . ")...");

            $grandTotalFiles = 0;
            $grandTotalRecords = 0;

            foreach ($years as $y) {
                $targetDir = $baseDir . DIRECTORY_SEPARATOR . $y;
                if (!is_dir($targetDir)) {
                    $this->warn("Directorio para el año {$y} no encontrado, omitiendo...");
                    continue;
                }

                $this->info("\n--- Procesando Año {$y} ---");
                $res = $this->processDirectory($etlService, $targetDir);
                if ($res === Command::SUCCESS) {
                    // Contadores acumulados
                }
            }

            $this->info("\n🎉 Proceso masivo completado.");
            return Command::SUCCESS;
        }

        // 4. Caso: un año en específico (por defecto 2026 si no se pasa nada)
        $targetYear = $year ?: '2026';
        $targetDir = $baseDir . DIRECTORY_SEPARATOR . $targetYear;
        $this->info("Procesando año: {$targetYear} ({$targetDir})");
        return $this->processDirectory($etlService, $targetDir);
    }

    protected function processDirectory(MaximosMinimosEtlService $etlService, string $targetDir): int
    {
        $startTime = microtime(true);
        $bar = null;

        $res = $etlService->importDirectory($targetDir, function ($chunkSize, $current, $total) use (&$bar) {
            if (!$bar) {
                $bar = $this->output->createProgressBar($total);
                $bar->start();
            }
            $bar->setProgress($current);
        });

        if ($bar) {
            $bar->finish();
            $this->newLine();
        }

        if ($res['success']) {
            $elapsed = round(microtime(true) - $startTime, 2);
            $this->table(
                ['Métrica', 'Valor'],
                [
                    ['Directorio', $res['target_dir']],
                    ['Archivos Encontrados', $res['total_files']],
                    ['Archivos Procesados', $res['files_processed']],
                    ['Archivos con Error', $res['errors']],
                    ['Registros Insertados/Actualizados', number_format($res['total_records'])],
                    ['Tiempo de Ejecución', "{$elapsed} seg"]
                ]
            );
            return Command::SUCCESS;
        } else {
            $this->error("❌ " . $res['message']);
            return Command::FAILURE;
        }
    }
}
