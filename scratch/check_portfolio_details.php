<?php
require 'backend/vendor/autoload.php';
$app = require_once 'backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== INVERSION ===\n";
print_r(DB::table('inversion')->where('id_instrumento', 98)->limit(5)->get());

echo "=== ACCION_POSICION ===\n";
print_r(DB::table('accion_posicion')->where('id_instrumento', 98)->get());

echo "=== ACCION_OPERACION ===\n";
print_r(DB::table('accion_operacion')->where('id_instrumento', 98)->limit(5)->get());

echo "=== ACCION_DIVIDENDO ===\n";
print_r(DB::table('accion_dividendo')->where('id_instrumento', 98)->limit(5)->get());

echo "=== CONSOLIDADO_INVERSIONES ===\n";
print_r(DB::table('consolidado_inversiones')->limit(5)->get());
