<?php
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

// 1. Obtener todas las capturas de historico_indicadores
$historicos = DB::table('historico_indicadores')->orderBy('fecha_captura', 'asc')->get();

// 2. Precios del mercado bursátil (shares)
$preciosMercado = DB::connection('mysql_inversion')
    ->table('shares')
    ->where('SHA_PRICE', '>', 0)
    ->where('SHA_NUMBER', '>', 0)
    ->select([
        'SHA_ISSUER as emisor_bolsa',
        'SHA_DATE as fecha',
        DB::raw('ROUND(SUM(SHA_CASH_VALUE) / SUM(SHA_NUMBER), 4) as precio_promedio')
    ])
    ->groupBy('SHA_ISSUER', 'SHA_DATE')
    ->orderBy('SHA_DATE', 'asc')
    ->get();

// Mapa de precios por emisor -> arreglo ordenado por fecha
$preciosPorEmisor = [];
foreach ($preciosMercado as $p) {
    $key = strtoupper(trim($p->emisor_bolsa));
    if (!isset($preciosPorEmisor[$key])) {
        $preciosPorEmisor[$key] = [];
    }
    $preciosPorEmisor[$key][$p->fecha] = (float)$p->precio_promedio;
}

function matchEmisorName($nombreApp, $nombreBolsa) {
    $nApp = strtoupper(trim($nombreApp));
    $nBolsa = strtoupper(trim($nombreBolsa));

    if (empty($nApp) || empty($nBolsa)) return false;
    if ($nApp === $nBolsa) return true;

    $cleanApp = str_replace(['S.A.', 'SA', 'BANCO DE LA', 'BANCO DEL', 'BANCO'], '', $nApp);
    $cleanBolsa = str_replace(['S.A.', 'SA', 'BANCO DE LA', 'BANCO DEL', 'BANCO'], '', $nBolsa);

    $cleanApp = trim($cleanApp);
    $cleanBolsa = trim($cleanBolsa);

    if (!empty($cleanApp) && !empty($cleanBolsa)) {
        if ($cleanApp === $cleanBolsa || str_contains($cleanBolsa, $cleanApp) || str_contains($cleanApp, $cleanBolsa)) {
            return true;
        }
    }
    return false;
}

$ultimosPreciosAct = DB::table('accion_ultimo_precio')->pluck('precio_ultimo', 'id_emisor')->all();

echo "=== ALINEANDO HISTORICO_INDICADORES CON EL MOTOR DE VALORACIÓN HISTÓRICA ===\n\n";

foreach ($historicos as $h) {
    $fecha = $h->fecha_captura;

    // Movimientos del usuario hasta la fecha $fecha
    $movimientos = DB::table('accion_operacion as ao')
        ->join('instrumento as i', 'i.id_instrumento', '=', 'ao.id_instrumento')
        ->join('emisor as e', 'e.id_emisor', '=', 'i.id_emisor')
        ->where('ao.activo', 1)
        ->where('ao.eliminado', 0)
        ->whereDate('ao.fecha_operacion', '<=', $fecha)
        ->select([
            'e.id_emisor',
            'e.nombre as emisor_nombre',
            'ao.id_tipo_operacion',
            'ao.cantidad',
            'ao.valor_neto'
        ])
        ->get();

    // Agrupar por emisor
    $posiciones = [];
    foreach ($movimientos as $m) {
        $idEmisor = $m->id_emisor;
        if (!isset($posiciones[$idEmisor])) {
            $posiciones[$idEmisor] = [
                'emisor_nombre' => $m->emisor_nombre,
                'cantidad' => 0,
                'costo' => 0
            ];
        }

        // Tipo operacion: 204=Compra, 205=Venta, 206/207=Div Acciones, 212/232=Otras Entradas
        if (in_array($m->id_tipo_operacion, [204, 206, 207, 212, 232])) {
            $posiciones[$idEmisor]['cantidad'] += (float)$m->cantidad;
        } elseif (in_array($m->id_tipo_operacion, [205, 208])) {
            $posiciones[$idEmisor]['cantidad'] -= (float)$m->cantidad;
        }

        if ($m->id_tipo_operacion == 204 || $m->id_tipo_operacion == 232) {
            $posiciones[$idEmisor]['costo'] += (float)$m->valor_neto;
        } elseif ($m->id_tipo_operacion == 205) {
            $posiciones[$idEmisor]['costo'] -= (float)$m->valor_neto;
        }
    }

    $valMercadoTotal = 0;
    $capitalInvertidoTotal = 0;

    foreach ($posiciones as $idEmisor => $pos) {
        if ($pos['cantidad'] <= 0) continue;

        $capitalInvertidoTotal += $pos['costo'];
        $emisorNombre = $pos['emisor_nombre'];

        // Buscar el precio de este emisor a la fecha $fecha o el más cercano anterior
        $precioEncontrado = null;
        foreach ($preciosPorEmisor as $emisorBolsa => $fechasPrecios) {
            if (matchEmisorName($emisorNombre, $emisorBolsa)) {
                foreach (array_reverse($fechasPrecios, true) as $fPre => $precio) {
                    if ($fPre <= $fecha) {
                        $precioEncontrado = $precio;
                        break;
                    }
                }
            }
            if ($precioEncontrado !== null) break;
        }

        if ($precioEncontrado === null) {
            $precioEncontrado = (float)($ultimosPreciosAct[$idEmisor] ?? 0);
        }

        $valorEmisor = $pos['cantidad'] * $precioEncontrado;
        $valMercadoTotal += $valorEmisor;
    }

    $plusvaliaLatente = $valMercadoTotal - $capitalInvertidoTotal;

    DB::table('historico_indicadores')
        ->where('id_historico', $h->id_historico)
        ->update([
            'capital_renta_variable' => round($capitalInvertidoTotal, 2),
            'valor_mercado_renta_variable' => round($valMercadoTotal, 2),
            'plusvalia_latente_rv' => round($plusvaliaLatente, 2),
            'fecha_actualizacion' => now()
        ]);

    echo sprintf(
        "ID: %2d | Fecha: %s | Cap Invertido: $%10.2f | Val Mercado: $%10.2f | Plusvalía Latente: $%10.2f\n",
        $h->id_historico,
        $fecha,
        $capitalInvertidoTotal,
        $valMercadoTotal,
        $plusvaliaLatente
    );
}

echo "\n¡TABLA HISTORICO_INDICADORES ALINEADA 100% CON EL MOTOR DE VALORACIÓN HISTÓRICA BURSÁTIL!\n";
