<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

try {
    DB::unprepared("DROP PROCEDURE IF EXISTS `SP_PATRIMONIO_CONSOLIDADO`");
    
    $sql = file_get_contents(base_path('../database/SP_PATRIMONIO_CONSOLIDADO_02.sql'));
    // Remove the first line (the DROP statement)
    $sql = preg_replace('/^DROP PROCEDURE IF EXISTS `SP_PATRIMONIO_CONSOLIDADO`;\s*/i', '', $sql);
    
    DB::unprepared($sql);
    echo "Stored Procedure created successfully.\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
