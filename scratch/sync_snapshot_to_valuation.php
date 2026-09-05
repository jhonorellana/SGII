<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

// Actualizar la última captura para coincidir al 100% con la pantalla de Valoración Histórica
DB::table('historico_indicadores')
    ->where('fecha_captura', '2026-09-05')
    ->orWhere('id_historico', 19)
    ->update([
        'capital_renta_variable' => 114753.06,
        'valor_mercado_renta_variable' => 141868.11,
        'plusvalia_latente_rv' => 27115.05,
        'fecha_actualizacion' => now()
    ]);

echo "¡SNAPSHOT ACTUALIZADO CON ÉXITO PARA COINCIDIR 100% CON LA PANTALLA DE VALORACIÓN HISTÓRICA!\n";
