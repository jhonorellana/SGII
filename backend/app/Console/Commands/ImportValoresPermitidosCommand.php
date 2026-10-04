<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ValoresPermitidosEtlService;

class ImportValoresPermitidosCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sipro:import-valores-permitidos {filepath? : Ruta al archivo valores-permitidos.xlsx}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Importa y homologa calificaciones de riesgo y valores nominales desde valores-permitidos.xlsx';

    /**
     * Execute the console command.
     */
    public function handle(ValoresPermitidosEtlService $etlService)
    {
        $filePath = $this->argument('filepath');
        $this->info('Iniciando proceso de importación de Valores Permitidos...');

        $res = $etlService->importValoresPermitidos($filePath);

        if ($res['success']) {
            $this->info("✅ " . $res['message']);
            $this->line("• Archivo procesado: " . ($res['file_processed'] ?? 'N/A'));
            $this->line("• Emisores actualizados: " . ($res['updated_emisores_count'] ?? 0));
            $this->line("• Tiempo de ejecución: " . ($res['tiempo_ejecucion_segundos'] ?? 0) . "s");
            return Command::SUCCESS;
        } else {
            $this->error("❌ Error: " . $res['message']);
            if (!empty($res['error'])) {
                $this->error("Detalle: " . $res['error']);
            }
            return Command::FAILURE;
        }
    }
}
