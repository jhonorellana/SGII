<?php
require 'backend/vendor/autoload.php';
$app = require_once 'backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$service = app(App\Services\DividendAnalyticsService::class);
$res = $service->getMiPortafolio();
print_r(array_slice($res['data'], 0, 2));
