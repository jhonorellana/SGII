<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== 1. DIAGNÓSTICO DE ACCION_OPERACION (TODAS LAS OPERACIONES DE RENTA VARIABLE) ===\n";
$operaciones = DB::table('accion_operacion as ao')
    ->join('instrumento as i', 'i.id_instrumento', '=', 'ao.id_instrumento')
    ->join('emisor as e', 'e.id_emisor', '=', 'i.id_emisor')
    ->where('ao.activo', 1)
    ->where('ao.eliminado', 0)
    ->select([
        'ao.id_accion_operacion',
        'ao.fecha_operacion',
        'e.nombre as emisor',
        'ao.id_tipo_operacion',
        'ao.cantidad',
        'ao.precio_unitario',
        'ao.valor_neto',
        'ao.id_persona'
    ])
    ->orderBy('ao.fecha_operacion', 'asc')
    ->get();

foreach ($operaciones as $op) {
    echo sprintf(
        "ID: %3d | Fecha: %s | Emisor: %-20s | TipoOp: %3d | Cant: %10.2f | P.Unit: $%8.2f | Neto: $%10.2f | Persona: %d\n",
        $op->id_accion_operacion,
        $op->fecha_operacion,
        $op->emisor,
        $op->id_tipo_operacion,
        $op->cantidad,
        $op->precio_unitario,
        $op->valor_neto,
        $op->id_persona
    );
}

echo "\n=== 2. SUMA DE VALOR NETO POR TIPO DE OPERACIÓN EN ACCION_OPERACION ===\n";
$sumByTipo = DB::table('accion_operacion as ao')
    ->where('ao.activo', 1)
    ->where('ao.eliminado', 0)
    ->select('ao.id_tipo_operacion', DB::raw('SUM(ao.valor_neto) as suma_neto'), DB::raw('SUM(ao.cantidad) as suma_cant'))
    ->groupBy('ao.id_tipo_operacion')
    ->get();

foreach ($sumByTipo as $st) {
    echo sprintf("Tipo ID %3d: Suma Neto = $%12.2f | Suma Cantidad = %10.2f\n", $st->id_tipo_operacion, $st->suma_neto, $st->suma_cant);
}

echo "\n=== 3. DIAGNÓSTICO DE SP_PATRIMONIO_CONSOLIDADO (RUBRO ACCIONES SIN INTERES) ===\n";
$spResult = DB::select('CALL SP_PATRIMONIO_CONSOLIDADO(?, ?, NULL, NULL, 1, 1)', [date('Y-m-d'), date('Y-m-d')]);
foreach ($spResult as $r) {
    if (str_contains(strtolower($r->detalle), 'accion') || str_contains(strtolower($r->detalle), 'renta') || $r->detalle === 'TOTAL') {
        echo sprintf("Detalle: %-30s | Valor: $%12.2f\n", $r->detalle, $r->valor);
    }
}
