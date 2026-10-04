<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\VectorPreciosEtlService;

class ImportVectorPreciosCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sipro:import-vector-precios {file? : Ruta opcional al archivo vector-precios-diario.xls}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Importa y procesa la matriz del Vector de Precios Diario y la Curva de Rendimiento de la BVQ';

    /**
     * Execute the console command.
     */
    public function handle(VectorPreciosEtlService $etlService)
    {
        $filePath = $this->argument('file');
        $this->info('Iniciando proceso ETL de Vector de Precios Diario BVQ...');

        $result = $etlService->importVectorPrecios($filePath);

        if ($result['success']) {
            $this->info('✅ ' . $result['message']);
            $this->table(
                ['Métrica', 'Valor'],
                [
                    ['Fecha Vector', $result['fecha_vector']],
                    ['Títulos de Renta Fija', $result['total_precios_importados']],
                    ['Puntos Curva Cero Cupón', $result['total_curva_importados']],
                    ['Archivo Procesado', $result['file_processed']]
                ]
            );
            return Command::SUCCESS;
        } else {
            $this->error('❌ ' . $result['message']);
            return Command::FAILURE;
        }
    }
}
