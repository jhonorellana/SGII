<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$res1 = DB::connection('mysql_inversion')->select('SHOW CREATE PROCEDURE inversion.SP_ACTUALIZAR_CONSOLIDADO_INVERSIONES');
echo "=== SP_ACTUALIZAR_CONSOLIDADO_INVERSIONES ===\n";
echo $res1[0]->{'Create Procedure'} ?? '';

echo "\n\n=== SP_ACTUALIZAR_AMORTIZACION_INVESTMENT ===\n";
$res2 = DB::connection('mysql_inversion')->select('SHOW CREATE PROCEDURE inversion.SP_ACTUALIZAR_AMORTIZACION_INVESTMENT');
echo $res2[0]->{'Create Procedure'} ?? '';
