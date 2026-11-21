<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SharesHistoryController extends Controller
{
    public function getHistoricoAcciones(Request $request)
    {
        $request->validate([
            'issuer' => 'required|integer',
            'year' => 'nullable|integer'
        ]);

        $issuer = $request->query('issuer');
        $year = $request->query('year', 0); // 0 means all years

        try {
            // Invocar el stored procedure en la base de datos mysql_inversion
            $resultados = DB::connection('mysql_inversion')->select(
                'CALL SP_SHARES_SUMMARY(?, ?)', 
                [$issuer, $year]
            );

            return response()->json([
                'success' => true,
                'data' => $resultados
            ], Response::HTTP_OK);

        } catch (\Exception $e) {
            Log::error('Error al ejecutar SP_SHARES_SUMMARY: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al ejecutar SP_SHARES_SUMMARY: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function getDetallesDiarios(Request $request)
    {
        $request->validate([
            'issuer' => 'required|integer',
            'date' => 'required|date_format:Y-m-d'
        ]);

        $issuer = $request->query('issuer');
        $date = $request->query('date');

        try {
            $detalles = DB::connection('mysql_inversion')
                ->table('shares')
                ->select([
                    'SHA_ID as id',
                    'SHA_NUMBER as cantidad',
                    'SHA_PRICE as precio',
                    'SHA_NOMINAL_VALUE as valor_nominal',
                    'SHA_CASH_VALUE as valor_efectivo',
                    'SHA_TYPE as tipo'
                ])
                ->where('SHA_ISSUER_ID', $issuer)
                ->where('SHA_DATE', $date)
                ->where('SHA_TYPE', 'ACCIONES')
                ->where('SHA_PRICE', '>', 0)
                ->where('SHA_NUMBER', '>', 0)
                ->get();

            return response()->json([
                'success' => true,
                'data' => $detalles
            ], Response::HTTP_OK);

        } catch (\Exception $e) {
            Log::error('Error al consultar detalles en shares: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al consultar detalles de transacciones.'
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Obtiene el histórico y métricas bursátiles simultáneas de todos los emisores
     * que forman parte activa del portafolio de Renta Variable.
     */
    public function getHistoricoPortafolio(Request $request)
    {
        $year = $request->query('year', 2026);

        try {
            // 1. Obtener posiciones del portafolio desde AccionPosicionController
            $posicionCtrl = app(\App\Http\Controllers\API\AccionPosicionController::class);
            $posicionesResponse = $posicionCtrl->index(new Request());
            $posicionesData = $posicionesResponse->getData()->data ?? [];

            // 2. Mapeo oficial de emisores a su legacy ID en mysql_inversion
            $emisorMap = DB::table('map_emisor_legacy')
                ->pluck('id_emisor_legacy', 'id_emisor')
                ->toArray();

            // 3. Consolidar por id_emisor
            $emisoresConsolidados = [];
            foreach ($posicionesData as $pos) {
                $idEmisor = $pos->id_emisor;
                if (!isset($emisoresConsolidados[$idEmisor])) {
                    $emisoresConsolidados[$idEmisor] = [
                        'id_emisor' => $idEmisor,
                        'emisor_nombre' => $pos->emisor_nombre ?? $pos->instrumento,
                        'id_emisor_legacy' => $emisorMap[$idEmisor] ?? null,
                        'cantidad_acciones' => 0.0,
                        'capital_invertido' => 0.0,
                        'valor_mercado' => 0.0,
                        'precio_ultimo' => (float)($pos->precio_ultimo ?? 0),
                        'fecha_ultimo_precio' => $pos->fecha_ultimo_precio ?? null,
                        'variacion_diaria_pct' => (float)($pos->variacion_diaria_pct ?? 0),
                        'tendencia_diaria' => $pos->tendencia_diaria ?? 'IGUAL',
                        'socios' => []
                    ];
                }

                $emisoresConsolidados[$idEmisor]['cantidad_acciones'] += (float)($pos->cantidad_actual ?? 0);
                $emisoresConsolidados[$idEmisor]['capital_invertido'] += (float)($pos->capital_invertido ?? 0);
                $emisoresConsolidados[$idEmisor]['valor_mercado'] += (float)($pos->valor_mercado ?? 0);
                $emisoresConsolidados[$idEmisor]['socios'][] = [
                    'id_persona' => $pos->id_persona,
                    'persona' => trim($pos->persona ?? ''),
                    'cantidad' => (float)($pos->cantidad_actual ?? 0),
                    'capital_invertido' => (float)($pos->capital_invertido ?? 0),
                    'valor_mercado' => (float)($pos->valor_mercado ?? 0),
                    'costo_promedio' => (float)($pos->costo_promedio_unitario ?? 0)
                ];
            }

            // 4. Filtrar solo los que tienen acciones > 0 y ordenar por valor de mercado descendente
            $emisoresConsolidados = array_values(array_filter($emisoresConsolidados, function ($e) {
                return $e['cantidad_acciones'] > 0;
            }));

            usort($emisoresConsolidados, function ($a, $b) {
                return $b['valor_mercado'] <=> $a['valor_mercado'];
            });

            // 5. Para cada emisor, calcular plusvalía y obtener histórico de mysql_inversion
            foreach ($emisoresConsolidados as &$emisor) {
                $cap = $emisor['capital_invertido'];
                $val = $emisor['valor_mercado'];
                $emisor['utilidad_perdida_no_realizada'] = $val - $cap;
                $emisor['porcentaje_rendimiento'] = $cap > 0 ? (($val - $cap) / $cap) * 100 : 0.0;
                $emisor['costo_promedio'] = $emisor['cantidad_acciones'] > 0 ? $cap / $emisor['cantidad_acciones'] : 0.0;

                $historico = [];
                $kpis = [
                    'precio_minimo' => 0.0,
                    'precio_maximo' => 0.0,
                    'precio_promedio' => 0.0,
                    'volumen_total' => 0.0,
                    'acciones_totales' => 0,
                    'transacciones_totales' => 0,
                    'primer_precio_periodo' => 0.0,
                    'ultimo_precio_periodo' => 0.0,
                    'variacion_periodo_pct' => 0.0
                ];

                if ($emisor['id_emisor_legacy']) {
                    try {
                        $historico = DB::connection('mysql_inversion')->select(
                            'CALL SP_SHARES_SUMMARY(?, ?)',
                            [$emisor['id_emisor_legacy'], (int)$year]
                        );

                        if (!empty($historico)) {
                            $precios = array_filter(array_map(fn($h) => (float)$h->precio, $historico), fn($p) => $p > 0);
                            $primerPrecio = reset($precios) ?: 0;
                            $ultimoPrecio = end($precios) ?: 0;
                            $kpis['precio_minimo'] = !empty($precios) ? min($precios) : 0;
                            $kpis['precio_maximo'] = !empty($precios) ? max($precios) : 0;
                            $kpis['precio_promedio'] = !empty($precios) ? array_sum($precios) / count($precios) : 0;
                            $kpis['volumen_total'] = array_sum(array_map(fn($h) => (float)$h->valor, $historico));
                            $kpis['acciones_totales'] = array_sum(array_map(fn($h) => (float)$h->cantidad, $historico));
                            $kpis['transacciones_totales'] = array_sum(array_map(fn($h) => (int)$h->transacciones, $historico));
                            $kpis['primer_precio_periodo'] = $primerPrecio;
                            $kpis['ultimo_precio_periodo'] = $ultimoPrecio;
                            $kpis['variacion_periodo_pct'] = $primerPrecio > 0 ? (($ultimoPrecio - $primerPrecio) / $primerPrecio) * 100 : 0;
                        }
                    } catch (\Exception $e) {
                        Log::warning("Error obteniendo histórico para emisor legacy {$emisor['id_emisor_legacy']}: " . $e->getMessage());
                    }
                }

                $emisor['historico'] = $historico;
                $emisor['kpis'] = $kpis;
            }
            unset($emisor);

            return response()->json([
                'success' => true,
                'data' => $emisoresConsolidados,
                'year' => (int)$year
            ], Response::HTTP_OK);

        } catch (\Exception $e) {
            Log::error('Error al generar histórico del portafolio: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al generar histórico del portafolio: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}
