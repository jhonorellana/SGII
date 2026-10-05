<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$spList = [
    ['db' => 'mysql_inversion', 'sql' => 'CALL SP_ACTUALIZAR_SHARES_LAST_DATE()', 'name' => 'inversion.SP_ACTUALIZAR_SHARES_LAST_DATE'],
    ['db' => 'mysql_inversion', 'sql' => 'CALL SP_ACTUALIZAR_RESUMEN_QUINCENAL()', 'name' => 'inversion.SP_ACTUALIZAR_RESUMEN_QUINCENAL'],
    ['db' => 'mysql_inversion', 'sql' => 'CALL SP_ACTUALIZAR_CONSOLIDADO_INVERSIONES()', 'name' => 'inversion.SP_ACTUALIZAR_CONSOLIDADO_INVERSIONES'],
    ['db' => 'mysql_inversion', 'sql' => 'CALL SP_LIMPIAR_TEMPORALES()', 'name' => 'inversion.SP_LIMPIAR_TEMPORALES'],
    ['db' => 'mysql_inversion', 'sql' => 'CALL SP_ACTUALIZAR_AMORTIZACION_INVESTMENT()', 'name' => 'inversion.SP_ACTUALIZAR_AMORTIZACION_INVESTMENT'],
    ['db' => 'mysql', 'sql' => 'CALL SP_ACTUALIZAR_AMORTIZACION_INVERSION(NULL, NULL)', 'name' => 'sipro_desa.SP_ACTUALIZAR_AMORTIZACION_INVERSION(NULL, NULL)'],
    ['db' => 'mysql', 'sql' => 'CALL SP_ACCION_ULTIMO_PRECIO_REFRESH()', 'name' => 'sipro_desa.SP_ACCION_ULTIMO_PRECIO_REFRESH'],
    ['db' => 'mysql', 'sql' => 'CALL sp_actualizar_snapshot_cartera()', 'name' => 'sipro_desa.sp_actualizar_snapshot_cartera'],
];

foreach ($spList as $item) {
    try {
        $start = microtime(true);
        // DB::statement o DB::select para llamadas a SP en PDO MySQL
        DB::connection($item['db'])->statement($item['sql']);
        $time = round(microtime(true) - $start, 3);
        echo "✓ [OK] {$item['name']} ({$time}s)\n";
    } catch (\Throwable $e) {
        echo "✗ [ERROR] {$item['name']}: " . $e->getMessage() . "\n";
    }
}
