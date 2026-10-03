<?php
require 'backend/vendor/autoload.php';
$app = require_once 'backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== SNAPSHOT CARTERA DIARIA ===\n";
print_r(DB::table('snapshot_cartera_diaria')->orderBy('id_snapshot', 'desc')->limit(5)->get());

echo "=== ACCION_POSICION ===\n";
print_r(DB::table('accion_posicion')->limit(5)->get());

echo "=== ACCION_OPERACION SUMMARY FOR ID_PERSONA=1 ===\n";
$ops = DB::table('accion_operacion')
    ->select('id_instrumento', DB::raw('SUM(valor_neto) as total_invertido'), DB::raw('SUM(cantidad) as total_acciones'))
    ->groupBy('id_instrumento')
    ->get();
print_r($ops);
