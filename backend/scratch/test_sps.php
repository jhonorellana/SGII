<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== INVERSION SPs ===\n";
$inversionSps = DB::connection('mysql_inversion')->select("SHOW PROCEDURE STATUS WHERE Db = 'inversion'");
foreach ($inversionSps as $s) {
    echo "inversion." . $s->Name . "\n";
}

echo "\n=== SIPRO_DESA SPs ===\n";
$siproSps = DB::select("SHOW PROCEDURE STATUS WHERE Db = 'sipro_desa'");
foreach ($siproSps as $s) {
    echo "sipro_desa." . $s->Name . "\n";
}
