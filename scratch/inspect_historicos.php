<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$rows = DB::table('historico_indicadores')->get();
echo "TOTAL ROWS: " . count($rows) . "\n\n";

foreach ($rows as $r) {
    echo "ID: {$r->id_historico} | Fecha: {$r->fecha_captura} | Cap RV: {$r->capital_renta_variable} | Plus Acc: {$r->plusvalia_acciones} | Div Acc: {$r->dividendos_acciones} | Val Merc RV: {$r->valor_mercado_renta_variable} | Plus Lat RV: {$r->plusvalia_latente_rv}\n";
}
