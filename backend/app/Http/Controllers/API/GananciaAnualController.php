<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GananciaAnualController extends Controller
{
    public function getGananciaAnual(Request $request)
    {
        try {
            // 1. Ganancias por ventas de Renta Fija (venta_inversion)
            $rfResults = DB::table('venta_inversion')
                ->join('catalogo_valor', 'venta_inversion.id_tipo_venta', '=', 'catalogo_valor.id_catalogo_valor')
                ->select(
                    DB::raw('YEAR(venta_inversion.fecha_venta) as anio'), 
                    'catalogo_valor.nombre as tipo_venta',
                    DB::raw('SUM(venta_inversion.ganancia_perdida) as ganancia')
                )
                ->where('venta_inversion.activo', 1)
                ->where('venta_inversion.eliminado', 0)
                ->whereNotNull('venta_inversion.fecha_venta')
                ->groupBy(DB::raw('YEAR(venta_inversion.fecha_venta)'), 'catalogo_valor.nombre')
                ->orderBy('anio', 'asc')
                ->get();

            // 2. Ganancias por ventas de Renta Variable (accion_operacion)
            // Reconstruimos secuencialmente el costo promedio ponderado de compras/ventas
            $rvOperaciones = DB::table('accion_operacion')
                ->where('activo', 1)
                ->where('eliminado', 0)
                ->orderBy('fecha_operacion', 'asc')
                ->orderBy('id_accion_operacion', 'asc')
                ->get();

            $costos = [];
            $rvGananciaPorAnio = [];

            foreach ($rvOperaciones as $op) {
                $key = $op->id_persona . '_' . $op->id_instrumento;

                if (!isset($costos[$key])) {
                    $costos[$key] = [
                        'cantidad_acumulada' => 0.0,
                        'costo_total_acumulado' => 0.0,
                        'costo_promedio_unitario' => 0.0
                    ];
                }

                $tipoOp = (int)$op->id_tipo_operacion;
                $cant = (float)$op->cantidad;
                $neto = (float)$op->valor_neto;

                // Compra (204) o Suscripción de acciones (232)
                if ($tipoOp === 204 || $tipoOp === 232) {
                    $costos[$key]['cantidad_acumulada'] += $cant;
                    $costos[$key]['costo_total_acumulado'] += $neto;
                    if ($costos[$key]['cantidad_acumulada'] > 0) {
                        $costos[$key]['costo_promedio_unitario'] = $costos[$key]['costo_total_acumulado'] / $costos[$key]['cantidad_acumulada'];
                    }
                }
                // Dividendo en Acciones (206), Ajuste Positivo (207), Split (212)
                elseif ($tipoOp === 206 || $tipoOp === 207 || $tipoOp === 212) {
                    $costos[$key]['cantidad_acumulada'] += $cant;
                    if ($costos[$key]['cantidad_acumulada'] > 0) {
                        $costos[$key]['costo_promedio_unitario'] = $costos[$key]['costo_total_acumulado'] / $costos[$key]['cantidad_acumulada'];
                    }
                }
                // Venta de Acciones (205)
                elseif ($tipoOp === 205) {
                    $cpuPrevio = $costos[$key]['costo_promedio_unitario'];
                    $costoBaseTotal = $cant * $cpuPrevio;
                    $utilidadPerdida = $neto - $costoBaseTotal;

                    // Descuenta stock
                    $costos[$key]['cantidad_acumulada'] -= $cant;
                    $costos[$key]['costo_total_acumulado'] -= $costoBaseTotal;

                    if ($costos[$key]['cantidad_acumulada'] <= 0) {
                        $costos[$key]['cantidad_acumulada'] = 0.0;
                        $costos[$key]['costo_total_acumulado'] = 0.0;
                        $costos[$key]['costo_promedio_unitario'] = 0.0;
                    } else {
                        $costos[$key]['costo_promedio_unitario'] = $cpuPrevio;
                    }

                    if ($op->fecha_operacion) {
                        $anio = (int)substr($op->fecha_operacion, 0, 4);
                        if (!isset($rvGananciaPorAnio[$anio])) {
                            $rvGananciaPorAnio[$anio] = 0.0;
                        }
                        $rvGananciaPorAnio[$anio] += $utilidadPerdida;
                    }
                }
                // Ajuste Negativo (208)
                elseif ($tipoOp === 208) {
                    $cpuPrevio = $costos[$key]['costo_promedio_unitario'];
                    $costos[$key]['cantidad_acumulada'] -= $cant;
                    $costos[$key]['costo_total_acumulado'] -= ($cant * $cpuPrevio);

                    if ($costos[$key]['cantidad_acumulada'] <= 0) {
                        $costos[$key]['cantidad_acumulada'] = 0.0;
                        $costos[$key]['costo_total_acumulado'] = 0.0;
                        $costos[$key]['costo_promedio_unitario'] = 0.0;
                    } else {
                        $costos[$key]['costo_promedio_unitario'] = $cpuPrevio;
                    }
                }
            }

            // Combinar Renta Fija y Renta Variable
            $combined = [];
            foreach ($rfResults as $rf) {
                $combined[] = [
                    'anio' => (int)$rf->anio,
                    'tipo_venta' => $rf->tipo_venta,
                    'ganancia' => (float)$rf->ganancia
                ];
            }

            foreach ($rvGananciaPorAnio as $anio => $gananciaRV) {
                $combined[] = [
                    'anio' => (int)$anio,
                    'tipo_venta' => 'Venta de Acciones',
                    'ganancia' => (float)$gananciaRV
                ];
            }

            // Ordenar por año asc
            usort($combined, function ($a, $b) {
                return $a['anio'] <=> $b['anio'];
            });

            return response()->json($combined);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener la ganancia anual',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
