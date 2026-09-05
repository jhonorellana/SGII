<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ValoracionHistoricaController extends Controller
{
    /**
     * Obtener serie histórica de valoración de mercado de acciones en posesión
     * GET /api/reportes/valoracion-historica-acciones
     */
    public function getValoracionHistorica(Request $request): JsonResponse
    {
        $fechaInicio = $request->query('fecha_inicio', '2026-01-01');
        $fechaFin = $request->query('fecha_fin', date('Y-m-d'));
        $idEmisor = $request->query('id_emisor');
        $idPropietario = $request->query('id_propietario');
        $idGrupoFamiliar = $request->query('id_grupo_familiar');

        try {
            // 1. Obtener lista de emisores disponibles de acciones
            $emisores = DB::table('emisor as e')
                ->join('instrumento as i', 'i.id_emisor', '=', 'e.id_emisor')
                ->join('accion_operacion as ao', 'ao.id_instrumento', '=', 'i.id_instrumento')
                ->where('ao.activo', 1)
                ->where('ao.eliminado', 0)
                ->select('e.id_emisor', 'e.nombre')
                ->distinct()
                ->orderBy('e.nombre')
                ->get();

            // 2. Consultar movimientos históricos de acciones del usuario
            $queryMov = DB::table('accion_operacion as ao')
                ->join('instrumento as i', 'i.id_instrumento', '=', 'ao.id_instrumento')
                ->join('emisor as e', 'e.id_emisor', '=', 'i.id_emisor')
                ->where('ao.activo', 1)
                ->where('ao.eliminado', 0)
                ->select([
                    'ao.id_accion_operacion',
                    'ao.fecha_operacion',
                    'e.id_emisor',
                    'e.nombre as emisor_nombre',
                    'ao.id_tipo_operacion',
                    'ao.cantidad',
                    'ao.valor_neto',
                    'ao.id_persona'
                ]);

            if ($idPropietario) {
                $queryMov->where('ao.id_persona', $idPropietario);
            }

            if ($idGrupoFamiliar) {
                $personasGrupo = DB::table('grupo_familiar_persona')
                    ->where('id_grupo_familiar', $idGrupoFamiliar)
                    ->pluck('id_persona');
                $queryMov->whereIn('ao.id_persona', $personasGrupo);
            }

            if ($idEmisor) {
                $queryMov->where('e.id_emisor', $idEmisor);
            }

            $movimientos = $queryMov->orderBy('ao.fecha_operacion', 'asc')->get();

            // 3. Consultar precios promedio diarios del mercado bursátil (shares)
            $queryPrecios = DB::connection('mysql_inversion')
                ->table('shares')
                ->where('SHA_PRICE', '>', 0)
                ->where('SHA_NUMBER', '>', 0)
                ->select([
                    'SHA_ISSUER as emisor_bolsa',
                    'SHA_DATE as fecha',
                    DB::raw('ROUND(SUM(SHA_CASH_VALUE) / SUM(SHA_NUMBER), 4) as precio_promedio'),
                    DB::raw('SUM(SHA_CASH_VALUE) as volumen_diario')
                ])
                ->groupBy('SHA_ISSUER', 'SHA_DATE')
                ->orderBy('SHA_DATE', 'asc');

            $preciosMercado = $queryPrecios->get();

            // Agrupar precios por fecha y nombre de emisor bursátil (exclusivamente por nombre)
            $preciosMap = []; // [fecha][nombre_emisor] = precio_promedio
            foreach ($preciosMercado as $p) {
                $f = $p->fecha;
                if (!isset($preciosMap[$f])) {
                    $preciosMap[$f] = [];
                }
                $keyNombre = strtoupper(trim($p->emisor_bolsa));
                $preciosMap[$f][$keyNombre] = (float)$p->precio_promedio;
            }

            // 4. Inicializar mapa de últimos precios conocidos desde accion_ultimo_precio y shares_lastdate
            $ultimosPreciosConocidos = [];

            try {
                $inicialesAup = DB::table('accion_ultimo_precio')->get();
                foreach ($inicialesAup as $aup) {
                    if (!empty($aup->precio_ultimo) && (float)$aup->precio_ultimo > 0 && !empty($aup->emisor)) {
                        $pVal = (float)$aup->precio_ultimo;
                        $ultimosPreciosConocidos[strtoupper(trim($aup->emisor))] = $pVal;
                    }
                }
            } catch (\Exception $ex) {}

            try {
                $lastDates = DB::connection('mysql_inversion')->table('shares_lastdate')->get();
                foreach ($lastDates as $ld) {
                    $pVal = (float)($ld->AVG_PRICE ?? $ld->MAX_PRICE ?? 0);
                    if ($pVal > 0 && !empty($ld->SHA_ISSUER)) {
                        $ultimosPreciosConocidos[strtoupper(trim($ld->SHA_ISSUER))] = $pVal;
                    }
                }
            } catch (\Exception $ex) {}

            // Recopilar todas las fechas relevantes
            $fechasSet = [];
            foreach ($preciosMercado as $p) {
                if ($p->fecha >= '2020-01-01' && $p->fecha <= $fechaFin) {
                    $fechasSet[$p->fecha] = true;
                }
            }
            foreach ($movimientos as $m) {
                if ($m->fecha_operacion && $m->fecha_operacion <= $fechaFin) {
                    $fechasSet[$m->fecha_operacion] = true;
                }
            }
            $fechasList = array_keys($fechasSet);
            sort($fechasList);

            // Filtrar rango de fechas según request
            $fechasEvaluacion = array_filter($fechasList, function($f) use ($fechaInicio, $fechaFin) {
                return $f >= $fechaInicio && $f <= $fechaFin;
            });
            $fechasEvaluacion = array_values($fechasEvaluacion);

            if (empty($fechasEvaluacion) && !empty($fechasList)) {
                $fechasEvaluacion = $fechasList;
            }

            // 5. Calcular la serie temporal de valoración
            $serie = [];

            $cantidadTotalActual = 0;
            $valorMercadoActual = 0;
            $costoInvertidoActual = 0;

            foreach ($fechasList as $fechaActual) {
                $cantidadesPorEmisor = [];
                $costosPorEmisor = [];

                foreach ($movimientos as $m) {
                    if ($m->fecha_operacion > $fechaActual) {
                        break;
                    }

                    $emId = $m->id_emisor;
                    if (!isset($cantidadesPorEmisor[$emId])) {
                        $cantidadesPorEmisor[$emId] = 0;
                        $costosPorEmisor[$emId] = 0;
                    }

                    $cant = (float)$m->cantidad;
                    $valNeto = (float)$m->valor_neto;

                    if (in_array($m->id_tipo_operacion, [204, 206, 207, 212, 232])) {
                        $cantidadesPorEmisor[$emId] += $cant;
                        if (in_array($m->id_tipo_operacion, [204, 232])) {
                            $costosPorEmisor[$emId] += $valNeto;
                        }
                    } elseif (in_array($m->id_tipo_operacion, [205, 208])) {
                        $cantidadesPorEmisor[$emId] -= $cant;
                        if ($m->id_tipo_operacion == 205) {
                            $costosPorEmisor[$emId] -= $valNeto;
                        }
                    }
                }

                // Actualizar precios del día si ocurrieron operaciones en bolsa
                if (isset($preciosMap[$fechaActual])) {
                    foreach ($preciosMap[$fechaActual] as $k => $prec) {
                        $ultimosPreciosConocidos[$k] = $prec;
                    }
                }

                if (in_array($fechaActual, $fechasEvaluacion)) {
                    $totalCantidadDia = 0;
                    $totalValorMercadoDia = 0;
                    $totalCostoDia = 0;

                    foreach ($cantidadesPorEmisor as $eId => $qty) {
                        if ($qty <= 0) continue;

                        $emisorObj = $emisores->firstWhere('id_emisor', $eId);
                        $nombreE = $emisorObj ? $emisorObj->nombre : '';
                        $keyNombre = strtoupper(trim($nombreE));

                        $precioE = 0;
                        if (isset($ultimosPreciosConocidos[$keyNombre])) {
                            $precioE = $ultimosPreciosConocidos[$keyNombre];
                        } else {
                            foreach ($ultimosPreciosConocidos as $pk => $pv) {
                                if ($this->matchEmisor($nombreE, $pk)) {
                                    $precioE = $pv;
                                    break;
                                }
                            }
                        }

                        $costoE = max(0, $costosPorEmisor[$eId] ?? 0);
                        $valorMercadoE = $qty * $precioE;

                        $totalCantidadDia += $qty;
                        $totalValorMercadoDia += $valorMercadoE;
                        $totalCostoDia += $costoE;
                    }

                    $plusvaliaDia = $totalValorMercadoDia - $totalCostoDia;
                    $pctPlusvaliaDia = $totalCostoDia > 0 ? round(($plusvaliaDia / $totalCostoDia) * 100, 2) : 0;

                    if ($totalCantidadDia > 0 || count($serie) > 0) {
                        $serie[] = [
                            'fecha' => $fechaActual,
                            'cantidad_acciones' => round($totalCantidadDia, 2),
                            'valor_mercado' => round($totalValorMercadoDia, 2),
                            'costo_invertido' => round($totalCostoDia, 2),
                            'plusvalia_monto' => round($plusvaliaDia, 2),
                            'plusvalia_pct' => $pctPlusvaliaDia,
                            'precio_promedio_mercado' => $totalCantidadDia > 0 ? round($totalValorMercadoDia / $totalCantidadDia, 4) : 0
                        ];

                        $cantidadTotalActual = round($totalCantidadDia, 2);
                        $valorMercadoActual = round($totalValorMercadoDia, 2);
                        $costoInvertidoActual = round($totalCostoDia, 2);
                    }
                }
            }

            $plusvaliaActualMonto = $valorMercadoActual - $costoInvertidoActual;
            $plusvaliaActualPct = $costoInvertidoActual > 0 ? round(($plusvaliaActualMonto / $costoInvertidoActual) * 100, 2) : 0;

            return response()->json([
                'success' => true,
                'data' => [
                    'serie' => $serie,
                    'resumen' => [
                        'valor_mercado_actual' => $valorMercadoActual,
                        'cantidad_actual' => $cantidadTotalActual,
                        'costo_actual' => $costoInvertidoActual,
                        'plusvalia_actual_monto' => $plusvaliaActualMonto,
                        'plusvalia_actual_pct' => $plusvaliaActualPct
                    ],
                    'emisores' => $emisores
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error al generar valoración histórica de acciones: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al calcular la valoración histórica: ' . $e->getMessage()
            ], 500);
        }
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
            if (strlen($clean1) >= 4 && strlen($clean2) >= 4) {
                if (strpos($clean1, $clean2) !== false || strpos($clean2, $clean1) !== false) return true;
            }
        }

        $ignore = ['BANCO', 'DE', 'LA', 'EL', 'LOS', 'LAS', 'SA', 'CA', 'SOCIEDAD', 'ANONIMA', 'CORPORACION', 'COMPANIA', 'FONDO', 'INVERSION', 'ACCIONES'];
        $words1 = array_filter(explode(' ', preg_replace('/[^A-Z0-9 ]/', '', $n1)), fn($w) => strlen($w) >= 4 && !in_array($w, $ignore));
        $words2 = array_filter(explode(' ', preg_replace('/[^A-Z0-9 ]/', '', $n2)), fn($w) => strlen($w) >= 4 && !in_array($w, $ignore));

        foreach ($words1 as $w1) {
            foreach ($words2 as $w2) {
                if ($w1 === $w2) return true;
            }
        }

        return false;
    }
}
