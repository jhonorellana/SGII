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

        // Obtener cierres y variaciones diarias directamente desde shares_lastdate
        $lastDates = [];
        try {
            $lastDates = DB::connection('mysql_inversion')
                ->table('shares_lastdate')
                ->get();
        } catch (\Exception $ex) {
            // Silencioso si no hay conexión a mysql_inversion
        }

        // Mapear los costos y variaciones en las posiciones
        $posicionesMap = $posiciones->map(function ($pos) use ($costos, $lastDates) {
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

            // Buscar coincidencia en shares_lastdate por nombre de instrumento/emisor primero
            $v = null;
            foreach ($lastDates as $ld) {
                if ($this->matchEmisor($pos->instrumento, $ld->SHA_ISSUER) || $this->matchEmisor($pos->emisor_nombre, $ld->SHA_ISSUER)) {
                    $v = $ld;
                    break;
                }
            }
            if (!$v) {
                foreach ($lastDates as $ld) {
                    if (!empty($ld->SHA_ISSUER_ID) && $pos->id_emisor == $ld->SHA_ISSUER_ID) {
                        $v = $ld;
                        break;
                    }
                }
            }

            if ($v) {
                $precioUlt = (float)($v->AVG_PRICE ?? $v->MAX_PRICE ?? $pos->precio_ultimo);
                if ($precioUlt > 0) {
                    $pos->precio_ultimo = $precioUlt;
                    $pos->valor_mercado = (float)$pos->cantidad_actual * $precioUlt;
                    $pos->utilidad_perdida_no_realizada = $pos->valor_mercado - $capitalInvertido;
                }

                $pos->precio_anterior = (float)($v->PREV_AVG_PRICE ?? 0);
                $pos->fecha_anterior = $v->PREV_DATE ?? null;
                $pos->cambio_diario = (float)($v->DAILY_CHANGE ?? 0);
                $pos->variacion_diaria_pct = (float)($v->DAILY_VARIATION_PCT ?? 0);
                $pos->tendencia_diaria = $pos->cambio_diario > 0 ? 'SUBIO' : ($pos->cambio_diario < 0 ? 'BAJO' : 'IGUAL');
                if (!empty($v->MAX_DATE)) {
                    $pos->fecha_ultimo_precio = $v->MAX_DATE;
                }
            } else {
                $pos->precio_anterior = null;
                $pos->fecha_anterior = null;
                $pos->cambio_diario = 0;
                $pos->variacion_diaria_pct = 0;
                $pos->tendencia_diaria = 'IGUAL';
            }

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

            // Compra (204) o Suscripción de acciones (232): aumenta cantidad y suma capital desembolsado real
            if ($tipoOp === 204 || $tipoOp === 232) {
                $costos[$key]['cantidad_acumulada'] += $cant;
                $costos[$key]['costo_total_acumulado'] += $neto;
                if ($costos[$key]['cantidad_acumulada'] > 0) {
                    $costos[$key]['costo_promedio_unitario'] = $costos[$key]['costo_total_acumulado'] / $costos[$key]['cantidad_acumulada'];
                }
            }
            // Dividendo en Acciones/Bonificación (206), Ajuste Positivo (207), Split (212): aumenta cantidad sin desembolso de dinero ($0)
            elseif ($tipoOp === 206 || $tipoOp === 207 || $tipoOp === 212) {
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

    private function matchEmisor($name1, $name2)
    {
        if (empty($name1) || empty($name2)) return false;
        $n1 = trim(mb_strtoupper($name1));
        $n2 = trim(mb_strtoupper($name2));
        if ($n1 === $n2) return true;

        $clean1 = preg_replace('/[^A-Z0-9]/', '', $n1);
        $clean2 = preg_replace('/[^A-Z0-9]/', '', $n2);
        if (!empty($clean1) && !empty($clean2)) {
            if ($clean1 === $clean2) return true;
            if (strlen($clean1) >= 5 && strlen($clean2) >= 5) {
                if (strpos($clean1, $clean2) !== false || strpos($clean2, $clean1) !== false) return true;
            }
        }

        $ignore = ['BANCO', 'DE', 'LA', 'EL', 'LOS', 'LAS', 'SA', 'CA', 'SOCIEDAD', 'ANONIMA', 'CORPORACION', 'COMPANIA', 'FONDO', 'INVERSION', 'ACCIONES'];
        $words1 = array_filter(explode(' ', preg_replace('/[^A-Z0-9 ]/', '', $n1)), fn($w) => strlen($w) >= 5 && !in_array($w, $ignore));
        $words2 = array_filter(explode(' ', preg_replace('/[^A-Z0-9 ]/', '', $n2)), fn($w) => strlen($w) >= 5 && !in_array($w, $ignore));

        foreach ($words1 as $w1) {
            foreach ($words2 as $w2) {
                if ($w1 === $w2) return true;
            }
        }

        return false;
    }
}
