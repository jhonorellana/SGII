<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class MaximosMinimosAnalyticsService
{
    /**
     * Obtiene el listado de emisores/títulos disponibles con su último estado bursátil y liquidez
     */
    public function getEmisoresDisponibles(): array
    {
        try {
            $db = DB::connection('mysql_inversion');

            // Consulta unificada optimizada con el índice UNIQUE(fecha_informacion, codigo_seb)
            $ultimos = $db->table('maximos_minimos_acciones as m1')
                ->join(DB::raw('(
                    SELECT codigo_seb, 
                           MAX(fecha_informacion) as max_fecha, 
                           COUNT(*) as total_sesiones, 
                           MIN(fecha_informacion) as primer_registro, 
                           COUNT(DISTINCT precio_cierre) as precios_distintos 
                    FROM maximos_minimos_acciones 
                    GROUP BY codigo_seb
                ) as sub'), function ($join) {
                    $join->on('m1.codigo_seb', '=', 'sub.codigo_seb')
                         ->on('m1.fecha_informacion', '=', 'sub.max_fecha');
                })
                ->select([
                    'm1.codigo_seb',
                    'm1.emisor',
                    'm1.sector',
                    'm1.es_liquido',
                    'm1.fecha_informacion as ultima_fecha',
                    'm1.precio_cierre as ultimo_cierre',
                    'm1.precio_maximo as ultimo_maximo',
                    'm1.precio_minimo as ultimo_minimo',
                    'm1.num_acc_ult_cierre as ultimas_acciones',
                    'm1.fecha_ult_negoc',
                    'm1.fecha_ult_cierre',
                    'sub.total_sesiones',
                    'sub.primer_registro',
                    'sub.precios_distintos'
                ])
                ->get();

            $resultado = [];
            foreach ($ultimos as $u) {
                // Cálculo de inactividad (días entre fecha de información y fecha de última negociación)
                $diasInactividad = 0;
                if (!empty($u->fecha_ult_negoc) && !empty($u->ultima_fecha)) {
                    $d1 = new \DateTime($u->fecha_ult_negoc);
                    $d2 = new \DateTime($u->ultima_fecha);
                    $diasInactividad = max(0, (int) $d1->diff($d2)->format("%r%a"));
                }

                $estadoLiquidez = 'BAJA';
                if ($u->es_liquido) {
                    $estadoLiquidez = ($diasInactividad <= 3) ? 'ALTA' : (($diasInactividad <= 15) ? 'MODERADA' : 'BAJA');
                } else {
                    $estadoLiquidez = ($diasInactividad <= 7) ? 'MODERADA' : 'BAJA';
                }

                $resultado[] = [
                    'codigo_seb' => $u->codigo_seb,
                    'emisor' => $u->emisor,
                    'sector' => $u->sector ?? 'COMPAÑÍAS',
                    'es_liquido' => (bool) $u->es_liquido,
                    'total_sesiones' => (int) $u->total_sesiones,
                    'primer_registro' => $u->primer_registro,
                    'ultima_fecha' => $u->ultima_fecha,
                    'ultimo_cierre' => (float) $u->ultimo_cierre,
                    'ultimo_maximo' => (float) $u->ultimo_maximo,
                    'ultimo_minimo' => (float) $u->ultimo_minimo,
                    'ultimas_acciones' => (float) $u->ultimas_acciones,
                    'fecha_ult_negoc' => $u->fecha_ult_negoc,
                    'fecha_ult_cierre' => $u->fecha_ult_cierre,
                    'dias_inactividad' => $diasInactividad,
                    'estado_liquidez' => $estadoLiquidez,
                    'precios_distintos' => (int) $u->precios_distintos
                ];
            }

            // Ordenar: primero líquidos, luego por total de sesiones descendente, luego nombre
            usort($resultado, function ($a, $b) {
                if ($a['es_liquido'] !== $b['es_liquido']) {
                    return $b['es_liquido'] <=> $a['es_liquido'];
                }
                if ($a['total_sesiones'] !== $b['total_sesiones']) {
                    return $b['total_sesiones'] <=> $a['total_sesiones'];
                }
                return strcmp($a['emisor'], $b['emisor']);
            });

            return [
                'success' => true,
                'total_emisores' => count($resultado),
                'emisores_liquidos' => count(array_filter($resultado, fn($e) => $e['es_liquido'])),
                'data' => $resultado
            ];
        } catch (\Exception $e) {
            Log::error('Error en MaximosMinimosAnalyticsService::getEmisoresDisponibles: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Error al obtener emisores de máximos y mínimos',
                'error' => $e->getMessage(),
                'data' => []
            ];
        }
    }

    /**
     * Obtiene la serie temporal diaria con canales de fluctuación (precios máximos y mínimos BVQ),
     * métricas estadísticas (volatilidad, retorno, vwap) y proyección Monte Carlo acotada.
     */
    public function getCanalHistorico(
        string $codigoSeb,
        string $periodo = '1y',
        ?string $fechaDesde = null,
        ?string $fechaHasta = null,
        bool $incluirProyeccion = true,
        int $diasProyeccion = 90
    ): array {
        try {
            $db = DB::connection('mysql_inversion');

            $query = $db->table('maximos_minimos_acciones')
                ->where('codigo_seb', strtoupper(trim($codigoSeb)))
                ->where('precio_cierre', '>', 0);

            // Filtro de fechas según período predefinido o rango manual
            if ($fechaDesde && $fechaHasta) {
                $query->whereBetween('fecha_informacion', [$fechaDesde, $fechaHasta]);
            } else {
                $latestDate = $db->table('maximos_minimos_acciones')
                    ->where('codigo_seb', strtoupper(trim($codigoSeb)))
                    ->max('fecha_informacion');

                if (!$latestDate) {
                    return [
                        'success' => false,
                        'message' => "No se encontraron datos para el nemotécnico '{$codigoSeb}'."
                    ];
                }

                $startDate = match (strtolower($periodo)) {
                    '1m' => date('Y-m-d', strtotime('-30 days', strtotime($latestDate))),
                    '3m' => date('Y-m-d', strtotime('-90 days', strtotime($latestDate))),
                    '6m' => date('Y-m-d', strtotime('-180 days', strtotime($latestDate))),
                    '1y' => date('Y-m-d', strtotime('-365 days', strtotime($latestDate))),
                    '2y' => date('Y-m-d', strtotime('-730 days', strtotime($latestDate))),
                    '3y' => date('Y-m-d', strtotime('-1095 days', strtotime($latestDate))),
                    '5y' => date('Y-m-d', strtotime('-1825 days', strtotime($latestDate))),
                    'all' => '2019-01-01',
                    default => date('Y-m-d', strtotime('-365 days', strtotime($latestDate)))
                };

                $query->whereBetween('fecha_informacion', [$startDate, $latestDate]);
            }

            $rows = $query->orderBy('fecha_informacion', 'asc')
                ->get([
                    'fecha_informacion',
                    'precio_cierre',
                    'precio_maximo',
                    'precio_minimo',
                    'num_acc_ult_cierre',
                    'fecha_ult_cierre',
                    'fecha_ult_negoc',
                    'emisor',
                    'sector',
                    'es_liquido'
                ]);

            if ($rows->isEmpty()) {
                return [
                    'success' => false,
                    'message' => "No hay registros disponibles para '{$codigoSeb}' en el período seleccionado."
                ];
            }

            $firstRow = $rows->first();
            $lastRow = $rows->last();

            // 1. Preparación de series y cálculo de estadísticas cuantitativas
            $series = [];
            $precios = [];
            $logReturns = [];
            $volumenNominalTotal = 0;
            $volumenAccionesTotal = 0;
            $precioMaxPeriodo = -INF;
            $precioMinPeriodo = INF;

            foreach ($rows as $idx => $r) {
                $cierre = (float) $r->precio_cierre;
                $maximo = (float) ($r->precio_maximo ?? ($cierre * 1.10));
                $minimo = (float) ($r->precio_minimo ?? ($cierre * 0.90));
                $acc = (float) ($r->num_acc_ult_cierre ?? 0);

                if ($cierre > $precioMaxPeriodo) $precioMaxPeriodo = $cierre;
                if ($cierre < $precioMinPeriodo) $precioMinPeriodo = $cierre;

                $volumenNominalTotal += ($cierre * $acc);
                $volumenAccionesTotal += $acc;

                $precios[] = $cierre;
                if ($idx > 0 && $precios[$idx - 1] > 0) {
                    $logReturns[] = log($cierre / $precios[$idx - 1]);
                }

                $series[] = [
                    'fecha' => $r->fecha_informacion,
                    'precio_cierre' => round($cierre, 4),
                    'precio_maximo' => round($maximo, 4),
                    'precio_minimo' => round($minimo, 4),
                    'num_acciones' => round($acc, 2),
                    'volumen_estimado_usd' => round($cierre * $acc, 2),
                    'fecha_ult_negoc' => $r->fecha_ult_negoc,
                    'es_liquido' => (bool) $r->es_liquido
                ];
            }

            // Estadísticas
            $n = count($logReturns);
            $retornoMedioDiario = $n > 0 ? array_sum($logReturns) / $n : 0;
            $varianza = 0;
            foreach ($logReturns as $ret) {
                $varianza += pow($ret - $retornoMedioDiario, 2);
            }
            $desvEstandarDiaria = $n > 1 ? sqrt($varianza / ($n - 1)) : 0;
            $volatilidadAnualizada = $desvEstandarDiaria * sqrt(252) * 100.0;

            $precioInicial = (float) $firstRow->precio_cierre;
            $precioActual = (float) $lastRow->precio_cierre;
            $retornoAcumuladoPct = $precioInicial > 0 ? (($precioActual - $precioInicial) / $precioInicial) * 100.0 : 0.0;

            $vwap = $volumenAccionesTotal > 0 ? ($volumenNominalTotal / $volumenAccionesTotal) : $precioActual;

            // Días de inactividad a la última fecha
            $diasInactividad = 0;
            if (!empty($lastRow->fecha_ult_negoc) && !empty($lastRow->fecha_informacion)) {
                $d1 = new \DateTime($lastRow->fecha_ult_negoc);
                $d2 = new \DateTime($lastRow->fecha_informacion);
                $diasInactividad = max(0, (int) $d1->diff($d2)->format("%r%a"));
            }

            // Detección de tensión de banda en el último cierre
            $ultimoMax = (float) ($lastRow->precio_maximo ?? ($precioActual * 1.10));
            $ultimoMin = (float) ($lastRow->precio_minimo ?? ($precioActual * 0.90));
            $cercaTecho = ($ultimoMax > 0 && ($precioActual / $ultimoMax) >= 0.98);
            $cercaSuelo = ($ultimoMin > 0 && ($precioActual / $ultimoMin) <= 1.02);

            $tensionBanda = 'NEUTRO';
            if ($cercaTecho) $tensionBanda = 'TECHO_SOBRECOMPRA';
            elseif ($cercaSuelo) $tensionBanda = 'SUELO_VENTA';

            // 2. Simulación Monte Carlo Acotada por Regulación BVQ (+-10%)
            $proyeccion = null;
            if ($incluirProyeccion && $precioActual > 0) {
                $proyeccion = $this->calcularSimulacionMonteCarloBvq(
                    $precioActual,
                    $retornoMedioDiario,
                    $desvEstandarDiaria,
                    $lastRow->fecha_informacion,
                    min(180, max(15, $diasProyeccion))
                );
            }

            return [
                'success' => true,
                'metadata' => [
                    'codigo_seb' => strtoupper(trim($codigoSeb)),
                    'emisor' => $lastRow->emisor,
                    'sector' => $lastRow->sector ?? 'COMPAÑÍAS',
                    'es_liquido' => (bool) $lastRow->es_liquido,
                    'periodo_consultado' => $periodo,
                    'fecha_inicio' => $firstRow->fecha_informacion,
                    'fecha_fin' => $lastRow->fecha_informacion,
                    'total_sesiones' => count($series)
                ],
                'metricas' => [
                    'precio_actual' => round($precioActual, 4),
                    'precio_anterior' => count($precios) > 1 ? round($precios[count($precios) - 2], 4) : round($precioActual, 4),
                    'retorno_acumulado_periodo_pct' => round($retornoAcumuladoPct, 2),
                    'retorno_medio_diario_pct' => round($retornoMedioDiario * 100.0, 4),
                    'volatilidad_diaria_pct' => round($desvEstandarDiaria * 100.0, 4),
                    'volatilidad_anualizada_pct' => round($volatilidadAnualizada, 2),
                    'precio_maximo_periodo' => round($precioMaxPeriodo, 4),
                    'precio_minimo_periodo' => round($precioMinPeriodo, 4),
                    'vwap_precio_ponderado' => round($vwap, 4),
                    'banda_actual_bvq' => [
                        'minimo_autorizado' => round($ultimoMin, 4),
                        'maximo_autorizado' => round($ultimoMax, 4),
                        'tension_banda' => $tensionBanda
                    ],
                    'dias_inactividad_mercado' => $diasInactividad,
                    'volumen_total_periodo_usd' => round($volumenNominalTotal, 2),
                    'acciones_totales_periodo' => round($volumenAccionesTotal, 0)
                ],
                'series' => $series,
                'proyeccion_monte_carlo' => $proyeccion
            ];
        } catch (\Exception $e) {
            Log::error('Error en MaximosMinimosAnalyticsService::getCanalHistorico: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Error al generar el canal histórico de precios y bandas',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Ejecuta el algoritmo estocástico de Monte Carlo (GBM) acotado por la regulación de la BVQ (+-10% por día)
     */
    public function calcularSimulacionMonteCarloBvq(
        float $precioBase,
        float $muDiaria,
        float $sigmaDiaria,
        string $fechaBaseStr,
        int $diasFuturos = 90,
        int $numSimulaciones = 500
    ): array {
        // Asegurar parámetros mínimos sensatos si la volatilidad es muy baja
        $sigma = max(0.008, $sigmaDiaria);
        $mu = $muDiaria;
        $dt = 1.0;

        $simulaciones = [];
        for ($sim = 0; $sim < $numSimulaciones; $sim++) {
            $trayectoria = [$precioBase];
            $st = $precioBase;

            for ($d = 1; $d <= $diasFuturos; $d++) {
                // Generador normal Box-Muller
                $u1 = max(1e-10, mt_rand() / mt_getrandmax());
                $u2 = max(1e-10, mt_rand() / mt_getrandmax());
                $z = sqrt(-2.0 * log($u1)) * cos(2.0 * M_PI * $u2);

                $drift = ($mu - 0.5 * pow($sigma, 2)) * $dt;
                $shock = $sigma * sqrt($dt) * $z;
                $st_next = $st * exp($drift + $shock);

                // CLAMPING REGULATORIO BVQ: cada sesión futura solo puede variar en un +-10% respecto a la anterior
                $st_next = max($st * 0.90, min($st * 1.10, $st_next));
                $trayectoria[] = round($st_next, 4);
                $st = $st_next;
            }
            $simulaciones[] = $trayectoria;
        }

        // Extracción de percentiles por día
        $curvaProyeccion = [];
        $fechaCur = new \DateTime($fechaBaseStr);

        for ($d = 0; $d <= $diasFuturos; $d++) {
            $valoresDia = array_column($simulaciones, $d);
            sort($valoresDia);

            $p10 = $valoresDia[(int) floor(0.10 * $numSimulaciones)];
            $p50 = $valoresDia[(int) floor(0.50 * $numSimulaciones)];
            $p90 = $valoresDia[(int) floor(0.90 * $numSimulaciones)];

            $curvaProyeccion[] = [
                'dia_t' => $d,
                'fecha_estimada' => $fechaCur->format('Y-m-d'),
                'p10_conservador' => round($p10, 4),
                'p50_mediana' => round($p50, 4),
                'p90_optimista' => round($p90, 4)
            ];

            // Avanzar fecha (omitiendo fines de semana)
            do {
                $fechaCur->modify('+1 day');
            } while ($fechaCur->format('N') >= 6);
        }

        // Resumen ejecutivo de hitos a 30d, 60d y 90d
        $hitos = [];
        foreach ([30, 60, 90] as $hDias) {
            if ($hDias <= $diasFuturos && isset($curvaProyeccion[$hDias])) {
                $pt = $curvaProyeccion[$hDias];
                $hitos["{$hDias}d"] = [
                    'dias' => $hDias,
                    'fecha_estimada' => $pt['fecha_estimada'],
                    'escenario_pesimista_p10' => $pt['p10_conservador'],
                    'escenario_base_p50' => $pt['p50_mediana'],
                    'escenario_optimista_p90' => $pt['p90_optimista'],
                    'variacion_base_pct' => round((($pt['p50_mediana'] - $precioBase) / $precioBase) * 100.0, 2),
                    'variacion_optimista_pct' => round((($pt['p90_optimista'] - $precioBase) / $precioBase) * 100.0, 2),
                    'variacion_pesimista_pct' => round((($pt['p10_conservador'] - $precioBase) / $precioBase) * 100.0, 2)
                ];
            }
        }

        return [
            'precio_base' => round($precioBase, 4),
            'fecha_base' => $fechaBaseStr,
            'dias_proyectados' => $diasFuturos,
            'iteraciones_monte_carlo' => $numSimulaciones,
            'hitos_resumen' => $hitos,
            'hitos' => $hitos,
            'curva_diaria' => $curvaProyeccion,
            'curva_proyeccion' => $curvaProyeccion
        ];
    }
}
