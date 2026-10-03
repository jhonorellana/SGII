<?php
require 'backend/vendor/autoload.php';
$app = require_once 'backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$service = app(App\Services\DividendAnalyticsService::class);
$raw = $service->getMiPortafolio();
$items = $raw['data'];

echo "=== ORIGINAL DESGLOSADO (" . count($items) . " registros) ===\n";
foreach ($items as $it) {
    echo "{$it['persona']} - {$it['emisor']}: {$it['cantidad_actual']} acc | $" . number_format($it['valor_mercado'], 2) . "\n";
}

// Consolidar por id_emisor
$grouped = [];
foreach ($items as $it) {
    $idE = $it['id_emisor'];
    if (!isset($grouped[$idE])) {
        $grouped[$idE] = $it;
        $grouped[$idE]['personas_list'] = [$it['persona']];
    } else {
        $grouped[$idE]['cantidad_actual'] += $it['cantidad_actual'];
        $grouped[$idE]['capital_invertido'] += $it['capital_invertido'];
        $grouped[$idE]['valor_mercado'] += $it['valor_mercado'];
        $grouped[$idE]['ganancia_perdida'] += $it['ganancia_perdida'];
        $grouped[$idE]['dividendo_acciones_cant'] += $it['dividendo_acciones_cant'];
        $grouped[$idE]['val_div_acciones'] += $it['val_div_acciones'];
        $grouped[$idE]['div_efectivo_recibido'] += $it['div_efectivo_recibido'];
        $grouped[$idE]['ingreso_anual_estimado_usd'] += $it['ingreso_anual_estimado_usd'];
        if (!in_array($it['persona'], $grouped[$idE]['personas_list'])) {
            $grouped[$idE]['personas_list'][] = $it['persona'];
        }
        $grouped[$idE]['persona'] = implode(', ', $grouped[$idE]['personas_list']);
        $grouped[$idE]['costo_promedio'] = $grouped[$idE]['cantidad_actual'] > 0 
            ? round($grouped[$idE]['capital_invertido'] / $grouped[$idE]['cantidad_actual'], 2) 
            : 0;
    }
}
$consolidatedItems = array_values($grouped);

echo "\n=== CONSOLIDADO POR ACCION (" . count($consolidatedItems) . " registros) ===\n";
foreach ($consolidatedItems as $it) {
    echo "[{$it['persona']}] {$it['emisor']}: " . number_format($it['cantidad_actual'], 0) . " acc | Valor: $" . number_format($it['valor_mercado'], 2) . " | Ingreso: $" . number_format($it['ingreso_anual_estimado_usd'], 2) . "\n";
}
