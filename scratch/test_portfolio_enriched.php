<?php
require 'backend/vendor/autoload.php';
$app = require_once 'backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$positions = DB::table('sipro_desa.vw_accion_posicion')->get();

foreach ($positions as $pos) {
    echo "\n----------------------------------------\n";
    echo "Persona: {$pos->persona} | Emisor: {$pos->instrumento} (id_emisor: {$pos->id_emisor})\n";
    
    // Obtener datos de snapshot_cartera_diaria si existe
    $snapshot = DB::table('snapshot_cartera_diaria')
        ->where('id_emisor', $pos->id_emisor)
        ->orderBy('fecha', 'desc')
        ->first();
        
    // Obtener datos de precio ultimo (variación, precio anterior)
    $precioInfo = DB::table('accion_ultimo_precio')
        ->where('id_emisor', $pos->id_emisor)
        ->first();
        
    // Obtener dividendos recibidos en acciones y en efectivo
    $divAcciones = DB::table('accion_dividendo')
        ->where('id_persona', $pos->id_persona)
        ->where('id_instrumento', $pos->id_instrumento)
        ->sum('acciones_recibidas');
        
    $valDivAcciones = DB::table('accion_dividendo')
        ->where('id_persona', $pos->id_persona)
        ->where('id_instrumento', $pos->id_instrumento)
        ->sum('valor_referencial_acciones');
        
    $divEfectivo = DB::table('accion_dividendo')
        ->where('id_persona', $pos->id_persona)
        ->where('id_instrumento', $pos->id_instrumento)
        ->sum('valor_neto');
        
    // Obtener costo promedio y capital invertido de operaciones de compra
    $ops = DB::table('accion_operacion')
        ->where('id_persona', $pos->id_persona)
        ->where('id_instrumento', $pos->id_instrumento)
        ->where('id_tipo_operacion', 1) // Compras
        ->get();
        
    $cantComprada = $ops->sum('cantidad');
    $valNetoComprado = $ops->sum('valor_neto');
    $costoProm = $cantComprada > 0 ? ($valNetoComprado / $cantComprada) : 0;
    
    // Si snapshot tiene costo promedio, usar ese o fallback
    $costoPromFinal = ($snapshot && $snapshot->costo_promedio > 0) ? (float)$snapshot->costo_promedio : $costoProm;
    $cantActual = (float)$pos->cantidad_actual;
    $capitalInvertido = $cantActual * $costoPromFinal;
    $valorMercadoActual = (float)$pos->valor_mercado;
    $gananciaPerdida = $valorMercadoActual - $capitalInvertido;
    
    echo "Acciones Poseidas: " . number_format($cantActual, 0) . " acc.\n";
    echo "Capital Invertido: $" . number_format($capitalInvertido, 2) . "\n";
    echo "Costo Promedio: $" . number_format($costoPromFinal, 2) . "\n";
    echo "Valor Actual Acciones: $" . number_format($valorMercadoActual, 2) . "\n";
    echo "Ganancia / Pérdida: $" . number_format($gananciaPerdida, 2) . "\n";
    echo "Dividendo Acciones (Cant.): " . number_format($divAcciones, 0) . " acc.\n";
    echo "Val. Div. Acc. (Precio Actual): $" . number_format($divAcciones * (float)$pos->precio_ultimo, 2) . "\n";
    echo "Div. Efectivo Recibidos: $" . number_format($divEfectivo, 2) . "\n";
    if ($precioInfo) {
        echo "Precio Actual: $" . number_format($precioInfo->precio_ultimo, 2) . " (" . number_format($precioInfo->variacion_porcentaje, 2) . "%)\n";
        echo "Precio Ant.: $" . number_format($precioInfo->precio_anterior, 2) . "\n";
    }
    if ($snapshot) {
        echo "SMA 5: $" . number_format($snapshot->sma_5, 2) . " | SMA 20: $" . number_format($snapshot->sma_20, 2) . "\n";
        echo "Vol. Relativo: " . number_format($snapshot->vr, 2) . " | Inactividad: {$snapshot->dias_sin_negociacion} días\n";
    }
}
