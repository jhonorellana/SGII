<?php
require 'backend/vendor/autoload.php';
$app = require_once 'backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "=== VW_ACCION_POSICION ===\n";
print_r(DB::table('sipro_desa.vw_accion_posicion')->first());

echo "\n=== ACCION_ULTIMO_PRECIO ===\n";
print_r(DB::table('accion_ultimo_precio')->first());

echo "\n=== ALL TABLES IN DB sipro_desa ===\n";
$tables = DB::select("SHOW TABLES FROM sipro_desa");
foreach ($tables as $t) {
    $arr = (array)$t;
    echo current($arr) . "\n";
}
