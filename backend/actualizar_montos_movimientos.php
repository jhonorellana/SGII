<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\MovimientoCapital;
use App\Models\CatalogoValor;
use App\Models\Inversion;
use App\Models\VentaInversion;

echo "Actualizando montos de movimientos de capital..." . PHP_EOL;

// Obtener tipo de movimiento COMPRA_INVERSION (id_catalogo_valor = 181)
$tipoCompra = CatalogoValor::where('id_catalogo_valor', 181)->first();
if (!$tipoCompra) {
    echo "ERROR: No se encontró el tipo de movimiento COMPRA_INVERSION (id=181)" . PHP_EOL;
    exit(1);
}

// Obtener tipo de movimiento VENTA_INVERSION (id_catalogo_valor = 182)
$tipoVenta = CatalogoValor::where('id_catalogo_valor', 182)->first();
if (!$tipoVenta) {
    echo "ERROR: No se encontró el tipo de movimiento VENTA_INVERSION (id=182)" . PHP_EOL;
    exit(1);
}

// Actualizar movimientos de compra (id=181)
$comprasActualizadas = 0;
$compras = MovimientoCapital::where('id_tipo_movimiento', $tipoCompra->id_catalogo_valor)
    ->whereNull('monto')
    ->get();

echo "Encontradas {$compras->count()} compras sin monto..." . PHP_EOL;

foreach ($compras as $movimiento) {
    if ($movimiento->id_inversion) {
        $inversion = Inversion::find($movimiento->id_inversion);
        if ($inversion) {
            $movimiento->monto = $inversion->capital_invertido;
            $movimiento->save();
            $comprasActualizadas++;
            echo "Compra ID {$movimiento->id_movimiento_capital}: monto actualizado a {$inversion->capital_invertido}" . PHP_EOL;
        }
    }
}

// Actualizar movimientos de venta (id=182)
$ventasActualizadas = 0;
$ventas = MovimientoCapital::where('id_tipo_movimiento', $tipoVenta->id_catalogo_valor)
    ->whereNull('monto')
    ->get();

echo "Encontradas {$ventas->count()} ventas sin monto..." . PHP_EOL;

foreach ($ventas as $movimiento) {
    if ($movimiento->id_venta_inversion) {
        $venta = VentaInversion::find($movimiento->id_venta_inversion);
        if ($venta) {
            $movimiento->monto = $venta->valor_venta_con_comision;
            $movimiento->save();
            $ventasActualizadas++;
            echo "Venta ID {$movimiento->id_movimiento_capital}: monto actualizado a {$venta->valor_venta_con_comision}" . PHP_EOL;
        }
    }
}

echo PHP_EOL;
echo "=== RESUMEN ===" . PHP_EOL;
echo "Compras actualizadas: {$comprasActualizadas}" . PHP_EOL;
echo "Ventas actualizadas: {$ventasActualizadas}" . PHP_EOL;
echo "Total actualizadas: " . ($comprasActualizadas + $ventasActualizadas) . PHP_EOL;
