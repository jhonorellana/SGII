<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AccionPosicionController extends Controller
{
    /**
     * Display consolidated portfolio positions from the vw_accion_posicion view,
     * including dynamically calculated average cost, invested capital, and unrealized gain/loss.
     */
    public function index(Request $request)
    {
        $query = DB::table('vw_accion_posicion as vp')
            ->join('emisor as e', 'e.id_emisor', '=', 'vp.id_emisor')
            ->select('vp.*', 'e.nombre as emisor_nombre');

        if ($request->has('id_persona') && $request->id_persona) {
            $query->where('vp.id_persona', $request->id_persona);
        }

        if ($request->has('id_emisor') && $request->id_emisor) {
            $query->where('vp.id_emisor', $request->id_emisor);
        }

        if ($request->has('id_instrumento') && $request->id_instrumento) {
            $query->where('vp.id_instrumento', $request->id_instrumento);
        }

        $posiciones = $query->get();

        // Calcular los costos promedio ponderados de compra
        $costos = $this->calcularCostosPromedios(
            $request->id_persona ?: null,
            $request->id_instrumento ?: null
        );

        // Mapear los costos en las posiciones
        $posicionesMap = $posiciones->map(function ($pos) use ($costos) {
            $key = $pos->id_persona . '_' . $pos->id_instrumento;
            
            $cpu = 0.0;
            $capitalInvertido = 0.0;
            
            if (isset($costos[$key])) {
                $cpu = (float)$costos[$key]['costo_promedio_unitario'];
                $capitalInvertido = (float)$costos[$key]['costo_total_acumulado'];
            }
            
            $valorMercado = (float)$pos->valor_mercado;
            $utilidadPerdidaNoRealizada = $valorMercado - $capitalInvertido;

            // Adjuntar los campos calculados
            $pos->costo_promedio_unitario = $cpu;
            $pos->capital_invertido = $capitalInvertido;
            $pos->utilidad_perdida_no_realizada = $utilidadPerdidaNoRealizada;

            return $pos;
        });

        return response()->json([
            'success' => true,
            'data' => $posicionesMap
        ], Response::HTTP_OK);
    }

    /**
     * Get stock holding info for a specific person and instrument, including average cost.
     */
    public function getSocioPosicion(Request $request)
    {
        $request->validate([
            'id_persona' => 'required|integer',
            'id_instrumento' => 'required|integer'
        ]);

        $posicion = DB::table('vw_accion_posicion as vp')
            ->join('emisor as e', 'e.id_emisor', '=', 'vp.id_emisor')
            ->select('vp.*', 'e.nombre as emisor_nombre')
            ->where('vp.id_persona', $request->id_persona)
            ->where('vp.id_instrumento', $request->id_instrumento)
            ->first();

        // Calcular costo promedio ponderado específico para esta posición
        $costos = $this->calcularCostosPromedios($request->id_persona, $request->id_instrumento);
        $key = $request->id_persona . '_' . $request->id_instrumento;

        $cpu = 0.0;
        $capitalInvertido = 0.0;
        if (isset($costos[$key])) {
            $cpu = (float)$costos[$key]['costo_promedio_unitario'];
            $capitalInvertido = (float)$costos[$key]['costo_total_acumulado'];
        }

        if ($posicion) {
            $valorMercado = (float)$posicion->valor_mercado;
            $posicion->costo_promedio_unitario = $cpu;
            $posicion->capital_invertido = $capitalInvertido;
            $posicion->utilidad_perdida_no_realizada = $valorMercado - $capitalInvertido;
        } else {
            $posicion = [
                'id_persona' => (int)$request->id_persona,
                'id_instrumento' => (int)$request->id_instrumento,
                'cantidad_actual' => 0.000000,
                'precio_ultimo' => 0.000000,
                'valor_mercado' => 0.00,
                'costo_promedio_unitario' => $cpu,
                'capital_invertido' => $capitalInvertido,
                'utilidad_perdida_no_realizada' => 0.00
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $posicion
        ], Response::HTTP_OK);
    }

    /**
     * Calcula secuencialmente el costo promedio ponderado de compra
     * y el capital invertido para cada combinación de persona e instrumento.
     */
    private function calcularCostosPromedios($idPersona = null, $idInstrumento = null)
    {
        $query = DB::table('accion_operacion')
            ->where('activo', 1)
            ->where('eliminado', 0);

        if ($idPersona) {
            $query->where('id_persona', $idPersona);
        }
        if ($idInstrumento) {
            $query->where('id_instrumento', $idInstrumento);
        }

        // Ordenamos estrictamente por fecha de operación y ID ascendente para el flujo temporal
        $operaciones = $query->orderBy('fecha_operacion', 'asc')
            ->orderBy('id_accion_operacion', 'asc')
            ->get();

        $costos = [];

        foreach ($operaciones as $op) {
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

            // Compra (204), Bonificación/Acciones gratis (206), Ajuste Positivo (207)
            if ($tipoOp === 204 || $tipoOp === 206 || $tipoOp === 207) {
                $costos[$key]['cantidad_acumulada'] += $cant;
                $costos[$key]['costo_total_acumulado'] += $neto;
                if ($costos[$key]['cantidad_acumulada'] > 0) {
                    $costos[$key]['costo_promedio_unitario'] = $costos[$key]['costo_total_acumulado'] / $costos[$key]['cantidad_acumulada'];
                }
            }
            // Split (212)
            elseif ($tipoOp === 212) {
                $costos[$key]['cantidad_acumulada'] += $cant;
                if ($costos[$key]['cantidad_acumulada'] > 0) {
                    $costos[$key]['costo_promedio_unitario'] = $costos[$key]['costo_total_acumulado'] / $costos[$key]['cantidad_acumulada'];
                }
            }
            // Venta (205), Ajuste Negativo (208)
            elseif ($tipoOp === 205 || $tipoOp === 208) {
                $cpu = $costos[$key]['costo_promedio_unitario'];
                $costos[$key]['cantidad_acumulada'] -= $cant;
                $costos[$key]['costo_total_acumulado'] -= ($cant * $cpu);

                if ($costos[$key]['cantidad_acumulada'] <= 0) {
                    $costos[$key]['cantidad_acumulada'] = 0.0;
                    $costos[$key]['costo_total_acumulado'] = 0.0;
                    $costos[$key]['costo_promedio_unitario'] = 0.0;
                } else {
                    $costos[$key]['costo_promedio_unitario'] = $cpu;
                }
            }
        }

        return $costos;
    }
}
