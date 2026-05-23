<?php

require __DIR__.'/../../backend/vendor/autoload.php';

$app = require_once __DIR__.'/../../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Inversion;
use App\Models\VentaInversion;
use App\Models\MovimientoCapital;
use App\Models\CatalogoValor;

echo "=== MIGRACIÓN DE MOVIMIENTOS HISTÓRICOS ===\n\n";

try {
    // Buscar catálogos necesarios
    echo "1. Buscando catálogos necesarios...\n";
    $tipoCompraInversion = CatalogoValor::where('codigo', 'TPAJ')->first(); // COMPRA_INVERSION
    $tipoVentaInversion = CatalogoValor::where('codigo', 'TPIJ')->first(); // VENTA_INVERSION

    if (!$tipoCompraInversion || !$tipoVentaInversion) {
        echo "ERROR: Faltan catálogos necesarios.\n";
        echo "  - COMPRA_INVERSION: " . ($tipoCompraInversion ? 'OK' : 'FALTA') . "\n";
        echo "  - VENTA_INVERSION: " . ($tipoVentaInversion ? 'OK' : 'FALTA') . "\n";
        exit(1);
    }

    echo "  ✓ Catálogos encontrados correctamente\n\n";

    // Migrar movimientos de compras
    echo "2. Migrando movimientos de compras de inversiones...\n";
    $inversiones = Inversion::where('eliminado', false)
        ->where('activo', true)
        ->get();

    echo "  - Total de inversiones activas: {$inversiones->count()}\n";

    $comprasCreadas = 0;
    $comprasExistentes = 0;
    $comprasFallidas = 0;

    foreach ($inversiones as $inversion) {
        // Verificar si ya existe movimiento de compra para esta inversión
        $movimientoExistente = MovimientoCapital::where('id_inversion', $inversion->id_inversion)
            ->where('id_tipo_movimiento', $tipoCompraInversion->id_catalogo_valor)
            ->first();

        if ($movimientoExistente) {
            $comprasExistentes++;
            continue;
        }

        try {
            MovimientoCapital::create([
                'fecha_movimiento' => $inversion->fecha_compra,
                'id_tipo_movimiento' => $tipoCompraInversion->id_catalogo_valor,
                'signo' => '-', // Signo negativo para compras
                'monto' => null, // No se duplica, el valor está en inversion.capital_invertido
                'id_inversion' => $inversion->id_inversion,
                'descripcion' => 'Compra de inversión (migración histórica)',
                'conciliado' => true, // Marcar como conciliado por ser histórico
                'activo' => true,
                'eliminado' => false,
                'fecha_creacion' => $inversion->fecha_creacion,
                'fecha_actualizacion' => now()
            ]);
            $comprasCreadas++;
        } catch (\Exception $e) {
            $comprasFallidas++;
            echo "  ✗ Error al crear movimiento para inversión ID {$inversion->id_inversion}: {$e->getMessage()}\n";
        }
    }

    echo "  - Movimientos de compra creados: {$comprasCreadas}\n";
    echo "  - Movimientos de compra ya existentes: {$comprasExistentes}\n";
    echo "  - Movimientos de compra fallidos: {$comprasFallidas}\n\n";

    // Migrar movimientos de ventas
    echo "3. Migrando movimientos de ventas de inversiones...\n";
    $ventas = VentaInversion::where('eliminado', false)
        ->where('activo', true)
        ->get();

    echo "  - Total de ventas activas: {$ventas->count()}\n";

    $ventasCreadas = 0;
    $ventasExistentes = 0;
    $ventasFallidas = 0;

    foreach ($ventas as $venta) {
        // Verificar si ya existe movimiento de venta para esta venta
        $movimientoExistente = MovimientoCapital::where('id_venta_inversion', $venta->id_venta_inversion)
            ->where('id_tipo_movimiento', $tipoVentaInversion->id_catalogo_valor)
            ->first();

        if ($movimientoExistente) {
            $ventasExistentes++;
            continue;
        }

        try {
            MovimientoCapital::create([
                'fecha_movimiento' => $venta->fecha_venta,
                'id_tipo_movimiento' => $tipoVentaInversion->id_catalogo_valor,
                'signo' => '+', // Signo positivo para ventas
                'monto' => null, // No se duplica, el valor está en venta_inversion.valor_venta_con_comision
                'id_venta_inversion' => $venta->id_venta_inversion,
                'id_inversion' => $venta->id_inversion,
                'descripcion' => 'Venta de inversión (migración histórica)',
                'conciliado' => true, // Marcar como conciliado por ser histórico
                'activo' => true,
                'eliminado' => false,
                'fecha_creacion' => $venta->fecha_creacion,
                'fecha_actualizacion' => now()
            ]);
            $ventasCreadas++;
        } catch (\Exception $e) {
            $ventasFallidas++;
            echo "  ✗ Error al crear movimiento para venta ID {$venta->id_venta_inversion}: {$e->getMessage()}\n";
        }
    }

    echo "  - Movimientos de venta creados: {$ventasCreadas}\n";
    echo "  - Movimientos de venta ya existentes: {$ventasExistentes}\n";
    echo "  - Movimientos de venta fallidos: {$ventasFallidas}\n\n";

    // Resumen final
    echo "=== RESUMEN FINAL ===\n";
    echo "Total movimientos creados: " . ($comprasCreadas + $ventasCreadas) . "\n";
    echo "Total movimientos ya existentes: " . ($comprasExistentes + $ventasExistentes) . "\n";
    echo "Total movimientos fallidos: " . ($comprasFallidas + $ventasFallidas) . "\n\n";

    // Verificar total de movimientos
    $totalMovimientos = MovimientoCapital::where('eliminado', false)->count();
    echo "Total de movimientos en movimiento_capital: {$totalMovimientos}\n\n";

    echo "✓ Migración completada exitosamente.\n";

} catch (\Exception $e) {
    echo "\n✗ ERROR durante la migración: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
