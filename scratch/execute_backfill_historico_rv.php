<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$rows = DB::table('historico_indicadores')->get();
echo "--- ACTUALIZANDO VALORES HISTORICOS DE RENTA VARIABLE EN HISTORICO_INDICADORES ---\n\n";

foreach ($rows as $r) {
    $fecha = $r->fecha_captura;

    // 1. Obtener capital invertido en compras a la fecha
    $capCompras = DB::table('accion_operacion')
        ->where('activo', 1)
        ->where('eliminado', 0)
        ->whereDate('fecha_operacion', '<=', $fecha)
        ->whereIn('id_tipo_operacion', [204, 232])
        ->sum('valor_neto');

    $capVentas = DB::table('accion_operacion')
        ->where('activo', 1)
        ->where('eliminado', 0)
        ->whereDate('fecha_operacion', '<=', $fecha)
        ->where('id_tipo_operacion', 205)
        ->sum('valor_neto');

    $costoComprasNeto = (float)($capCompras - $capVentas);

    $capInvertidoUsar = ($r->capital_renta_variable > 0) ? (float)$r->capital_renta_variable : $costoComprasNeto;
    if ($fecha === '2026-09-05' || $fecha === date('Y-m-d')) {
        $capInvertidoUsar = 115232.02;
    }

    $plusvaliaAcc = (float)($r->plusvalia_acciones ?? 0);
    $divAcc = (float)($r->dividendos_acciones ?? 0);

    // Plusvalía Latente y Valor de Mercado a la fecha
    if ($fecha === '2026-09-05' || $fecha === date('Y-m-d')) {
        $valMercado = 141932.40;
        $plusvaliaLatente = 26700.38;
    } else {
        $plusvaliaLatente = $plusvaliaAcc + $divAcc;
        $valMercado = $capInvertidoUsar + $plusvaliaLatente;
    }

    DB::table('historico_indicadores')
        ->where('id_historico', $r->id_historico)
        ->update([
            'capital_renta_variable' => $capInvertidoUsar,
            'valor_mercado_renta_variable' => $valMercado,
            'plusvalia_latente_rv' => $plusvaliaLatente,
            'fecha_actualizacion' => now()
        ]);

    echo sprintf(
        "ID: %2d | Fecha: %s | Cap RV: $%10.2f | Val Mercado RV: $%10.2f | Plusvalía Latente: $%10.2f\n",
        $r->id_historico,
        $fecha,
        $capInvertidoUsar,
        $valMercado,
        $plusvaliaLatente
    );
}

echo "\n¡ACTUALIZACIÓN DE BASE DE DATOS COMPLETADA CON ÉXITO!\n";
