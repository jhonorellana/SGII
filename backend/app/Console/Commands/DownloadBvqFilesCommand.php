<?php

namespace App\Console\Commands;

use App\Services\BvqDownloaderService;
use Illuminate\Console\Command;

class DownloadBvqFilesCommand extends Command
{
    /**
     * El nombre y firma del comando CLI
     */
    protected $signature = 'bvq:download {--fecha= : Fecha en formato YYYY-MM-DD (por defecto hoy)}';

    /**
     * La descripción del comando CLI
     */
    protected $description = 'Descarga los 42 archivos oficiales de boletines y precios de la Bolsa de Valores de Quito (BVQ)';

    protected BvqDownloaderService $downloaderService;

    public function __construct(BvqDownloaderService $downloaderService)
    {
        parent::__construct();
        $this->downloaderService = $downloaderService;
    }

    public function handle()
    {
        $fecha = $this->option('fecha') ?: date('Y-m-d');
        $this->info("Iniciando descarga de archivos de la Bolsa de Valores de Quito (BVQ) para la fecha: {$fecha}...");

        $res = $this->downloaderService->downloadAll($fecha);

        if ($res['success']) {
            $this->info("✔ Descarga completada exitosamente.");
        } else {
            $this->warn("⚠️ Descarga finalizada con algunos errores ({$res['exitosos']} exitosos, {$res['fallidos']} fallidos).");
        }

        $this->line("Directorio Destino: {$res['directorio_base']}");
        $this->line("Archivos Procesados: {$res['exitosos']} / {$res['total_archivos']}");
        $this->line("Tiempo Transcurrido: {$res['tiempo_ejecucion_segundos']}s");

        return $res['success'] ? Command::SUCCESS : Command::FAILURE;
    }
}
