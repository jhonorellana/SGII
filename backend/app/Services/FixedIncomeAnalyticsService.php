<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FixedIncomeAnalyticsService
{
    /**
     * Devuelve los datos del Radar de Mercado para Renta Fija basados en el último Vector de Precios
     */
    public function getMarketRadar(array $filters = []): array
    {
        // Obtener la fecha más reciente disponible en vector_precio_diario
        $latestDate = DB::connection('mysql_inversion')->table('vector_precio_diario')->max('fecha_vector');

        if (!$latestDate) {
            return [
                'latest_date' => null,
                'kpis' => [
                    'total_titulos' => 0,
                    'tir_promedio' => 0,
                    'tasa_cupon_promedio' => 0,
                    'plazo_promedio_dias' => 0
                ],
                'instruments' => []
            ];
        }

        $fechaVector = $filters['fecha_vector'] ?? $latestDate;

        $query = DB::connection('mysql_inversion')->table('vector_precio_diario as v')
            ->leftJoin(DB::raw('sipro_desa.emisor as e'), function ($join) {
                $join->on('e.sigla', '=', 'v.nemo_emisor')
                     ->orOn('e.nombre', '=', 'v.nombre_emisor');
            })
            ->where('v.fecha_vector', $fechaVector);

        // Filtro por tipo/clase de título (Obligaciones, Papel Comercial, Titularización, Bonos, etc.)
        if (!empty($filters['clase_titulo'])) {
            $clase = strtoupper(trim($filters['clase_titulo']));
            $query->where(function ($q) use ($clase) {
                if ($clase === 'OBLIGACIONES' || $clase === 'OBL') {
                    $q->where('v.clase_titulo', 'LIKE', 'OBL%')
                      ->orWhere('v.clase_titulo', 'LIKE', '%OBLIGAC%');
                } elseif ($clase === 'PAPEL COMERCIAL' || $clase === 'PAPEL' || $clase === 'PC') {
                    $q->where('v.clase_titulo', 'LIKE', 'PC%')
                      ->orWhere('v.clase_titulo', 'LIKE', '%PAPEL%');
                } elseif ($clase === 'TITULARIZACION' || $clase === 'TIT' || $clase === 'VCC') {
                    $q->where('v.clase_titulo', 'LIKE', 'VCC%')
                      ->orWhere('v.clase_titulo', 'LIKE', '%TITULAR%');
                } elseif ($clase === 'BONOS' || $clase === 'BONO' || $clase === 'BE') {
                    $q->where('v.clase_titulo', 'LIKE', 'BE%')
                      ->orWhere('v.clase_titulo', 'LIKE', '%BONO%');
                } else {
                    $q->where('v.clase_titulo', 'LIKE', '%' . $clase . '%');
                }
            });
        }

        // Filtro por calificación de riesgo
        if (!empty($filters['calificacion_riesgo'])) {
            $query->where('v.calificacion_riesgo', $filters['calificacion_riesgo']);
        }

        // Filtro por búsqueda de texto
        if (!empty($filters['search'])) {
            $search = '%' . $filters['search'] . '%';
            $query->where(function ($q) use ($search) {
                $q->where('v.nombre_emisor', 'LIKE', $search)
                  ->orWhere('v.nemo_emisor', 'LIKE', $search)
                  ->orWhere('v.codigo_titulo_vector', 'LIKE', $search)
                  ->orWhere('v.clase_titulo', 'LIKE', $search);
            });
        }

        $instruments = $query->select([
            'v.id',
            'v.fecha_vector',
            'v.codigo_titulo_vector',
            'v.nemo_emisor',
            'v.nombre_emisor',
            'v.clase_titulo',
            'v.calificacion_riesgo',
            'v.precio_porcentaje',
            'v.tasa_descuento_tir',
            'v.tasa_cupon',
            'v.plazo_dias_remanentes',
            'v.fecha_emision',
            'v.fecha_vencimiento',
            'v.forma_reajuste'
        ])
        ->orderBy('v.tasa_descuento_tir', 'desc')
        ->get();

        // Calcular KPIs del Mercado de Renta Fija
        $totalTitulos = $instruments->count();
        $avgTir = $totalTitulos > 0 ? round($instruments->avg('tasa_descuento_tir'), 2) : 0;
        $avgCupon = $totalTitulos > 0 ? round($instruments->avg('tasa_cupon'), 2) : 0;
        $avgPlazo = $totalTitulos > 0 ? round($instruments->avg('plazo_dias_remanentes'), 0) : 0;

        return [
            'latest_date' => $fechaVector,
            'kpis' => [
                'total_titulos' => $totalTitulos,
                'tir_promedio' => $avgTir,
                'tasa_cupon_promedio' => $avgCupon,
                'plazo_promedio_dias' => $avgPlazo
            ],
            'instruments' => $instruments->map(function ($item) {
                return [
                    'id' => $item->id,
                    'fecha_vector' => $item->fecha_vector,
                    'codigo_titulo_vector' => $item->codigo_titulo_vector,
                    'nemo_emisor' => $item->nemo_emisor,
                    'nombre_emisor' => $item->nombre_emisor,
                    'clase_titulo' => $item->clase_titulo,
                    'calificacion_riesgo' => $item->calificacion_riesgo ?? 'S/C',
                    'precio_porcentaje' => round((float) $item->precio_porcentaje, 4),
                    'tasa_descuento_tir' => round((float) $item->tasa_descuento_tir, 2),
                    'tasa_cupon' => round((float) $item->tasa_cupon, 2),
                    'plazo_dias_remanentes' => (int) $item->plazo_dias_remanentes,
                    'fecha_emision' => $item->fecha_emision,
                    'fecha_vencimiento' => $item->fecha_vencimiento,
                    'forma_reajuste' => $item->forma_reajuste
                ];
            })
        ];
    }

    /**
     * Devuelve el Portafolio de Renta Fija del usuario valorado a Precios de Mercado (Mark-to-Market)
     */
    public function getUserPortfolioMarkToMarket(array $filters = []): array
    {
        $latestDate = DB::connection('mysql_inversion')->table('vector_precio_diario')->max('fecha_vector');

        // Consultar inversiones en Renta Fija con su saldo capital vigente (descontando cuotas amortizadas pagadas)
        $query = DB::table('inversion as i')
            ->join('instrumento as inst', 'i.id_instrumento', '=', 'inst.id_instrumento')
            ->leftJoin('emisor as e', 'inst.id_emisor', '=', 'e.id_emisor')
            ->leftJoin(DB::raw('inversion.vector_precio_diario as v'), function ($join) use ($latestDate) {
                $join->on(DB::raw("CASE WHEN inst.codigo_titulo_vector LIKE 'a%' THEN inst.codigo_titulo_vector ELSE CONCAT('a', inst.codigo_titulo_vector) END"), '=', 'v.codigo_titulo_vector')
                     ->where('v.fecha_vector', '=', $latestDate);
            })
            ->leftJoin(DB::raw('
                (SELECT id_inversion, 
                        SUM(CASE WHEN id_estado_amortizacion = 134 THEN capital ELSE 0 END) as capital_pendiente,
                        COUNT(*) as total_cuotas
                 FROM amortizacion 
                 WHERE eliminado = 0 
                 GROUP BY id_inversion) as a
            '), 'i.id_inversion', '=', 'a.id_inversion')
            ->where('i.eliminado', 0)
            // Excluir Notas de Crédito (id_tipo_inversion = 91) y Renta Variable / Acciones (203, 73)
            ->whereNotIn('inst.id_tipo_inversion', [91, 203, 73])
            ->where('inst.nombre', 'NOT LIKE', '%SRI%')
            // Excluir inversiones ya vendidas (130 = VENDIDA_TOTAL) o canceladas (132) o con fecha de venta
            ->whereNull('i.fecha_venta')
            ->whereNotIn('i.id_estado_inversion', [130, 132]);

        if (!empty($filters['propietario_id'])) {
            $query->where('i.id_propietario', $filters['propietario_id']);
        }

        if (!empty($filters['id_tipo_inversion'])) {
            $query->where('inst.id_tipo_inversion', $filters['id_tipo_inversion']);
        }

        if (!empty($filters['clase_titulo'])) {
            $clase = strtoupper(trim($filters['clase_titulo']));
            $query->where(function ($q) use ($clase) {
                if ($clase === 'OBLIGACIONES' || $clase === 'OBL') {
                    $q->where('v.clase_titulo', 'LIKE', 'OBL%')
                      ->orWhere('inst.nombre', 'LIKE', '%OBLIGAC%')
                      ->orWhere('inst.id_tipo_inversion', '=', 5);
                } elseif ($clase === 'PAPEL COMERCIAL' || $clase === 'PAPEL' || $clase === 'PC') {
                    $q->where('v.clase_titulo', 'LIKE', 'PC%')
                      ->orWhere('inst.nombre', 'LIKE', '%PAPEL%')
                      ->orWhere('inst.id_tipo_inversion', '=', 3);
                } elseif ($clase === 'TITULARIZACION' || $clase === 'TIT' || $clase === 'VCC') {
                    $q->where('v.clase_titulo', 'LIKE', 'VCC%')
                      ->orWhere('inst.nombre', 'LIKE', '%TITULAR%')
                      ->orWhere('inst.id_tipo_inversion', '=', 75);
                } elseif ($clase === 'BONOS' || $clase === 'BONO' || $clase === 'BE') {
                    $q->where('v.clase_titulo', 'LIKE', 'BE%')
                      ->orWhere('inst.nombre', 'LIKE', '%BONO%')
                      ->orWhere('inst.id_tipo_inversion', '=', 4);
                } else {
                    $q->where('v.clase_titulo', 'LIKE', '%' . $clase . '%')
                      ->orWhere('inst.nombre', 'LIKE', '%' . $clase . '%');
                }
            });
        }

        // Filtro por vencidos (por defecto solo vigentes)
        $includeExpired = !empty($filters['include_expired']) && ($filters['include_expired'] === 'true' || $filters['include_expired'] === true);
        if (!$includeExpired) {
            $today = date('Y-m-d');
            $query->where(function ($q) use ($today) {
                $q->whereNull('inst.fecha_vencimiento')
                  ->orWhere('inst.fecha_vencimiento', '>=', $today)
                  ->orWhere('v.plazo_dias_remanentes', '>', 0);
            });
        }

        $holdings = $query->select([
            'i.id_inversion',
            'i.id_propietario',
            'inst.id_instrumento',
            'inst.nombre as nombre_instrumento',
            'inst.codigo_titulo_vector',
            'inst.fecha_emision',
            'e.nombre as nombre_emisor',
            'e.sigla as nemo_emisor',
            'i.capital_invertido',
            'i.saldo_capital_actual',
            'i.precio_compra',
            'i.tasa_interes as tasa_cupon_compra',
            'i.rendimiento_efectivo',
            'i.rendimiento_nominal',
            'i.fecha_compra',
            'inst.fecha_vencimiento',
            'v.precio_porcentaje as precio_vector_porcentaje',
            'v.tasa_descuento_tir as tir_vector',
            'v.calificacion_riesgo as rating_vector',
            'v.plazo_dias_remanentes as plazo_vector_dias',
            'a.capital_pendiente',
            'a.total_cuotas'
        ])->get();

        $totalValorCompra = 0;
        $totalValorMercado = 0;
        $totalGananciaUsd = 0;

        $mappedHoldings = $holdings->map(function ($h) use ($latestDate, &$totalValorCompra, &$totalValorMercado, &$totalGananciaUsd) {
            $capitalOriginal = (float) $h->capital_invertido;
            // Saldo capital vigente guardado en DB (i.saldo_capital_actual), o calculado desde cuotas pendientes (a.capital_pendiente), o capital original
            $capitalVigente = $h->saldo_capital_actual !== null 
                ? (float) $h->saldo_capital_actual 
                : (($h->total_cuotas !== null && (int)$h->total_cuotas > 0)
                    ? (float) $h->capital_pendiente
                    : $capitalOriginal);

            $precioCompraPct = (float) ($h->precio_compra > 5 ? $h->precio_compra : ($h->precio_compra * 100));
            if ($precioCompraPct <= 0) $precioCompraPct = 100.0;

            $precioVectorPct = $h->precio_vector_porcentaje !== null ? (float) $h->precio_vector_porcentaje : $precioCompraPct;

            $rendimientoCompra = (float)($h->rendimiento_efectivo > 0 
                ? $h->rendimiento_efectivo 
                : ($h->rendimiento_nominal > 0 ? $h->rendimiento_nominal : $h->tasa_cupon_compra));

            // Búsqueda de Sugerencia de Vector si el código actual es genérico o no cruzó con el vector
            $sugerenciaVector = null;
            if ($h->precio_vector_porcentaje === null || strlen(trim($h->codigo_titulo_vector)) < 10) {
                $emisorName = $h->nombre_emisor ?? $h->nemo_emisor;
                $firstWordEmisor = explode(' ', trim($emisorName))[0];

                $candidate = DB::connection('mysql_inversion')->table('vector_precio_diario')
                    ->where('fecha_vector', $latestDate)
                    ->where(function($q) use ($h, $firstWordEmisor) {
                        if ($h->nemo_emisor) $q->where('nemo_emisor', '=', $h->nemo_emisor);
                        $q->orWhere('nombre_emisor', 'LIKE', '%' . $firstWordEmisor . '%');
                    })
                    ->where(function($q) use ($h) {
                        if ($h->fecha_vencimiento) $q->where('fecha_vencimiento', $h->fecha_vencimiento);
                        if ($h->fecha_emision) $q->orWhere('fecha_emision', $h->fecha_emision);
                    })
                    ->first();

                if ($candidate) {
                    $sugerenciaVector = [
                        'codigo_titulo_vector' => $candidate->codigo_titulo_vector,
                        'clase_titulo' => $candidate->clase_titulo,
                        'precio_porcentaje' => round((float)$candidate->precio_porcentaje, 4),
                        'tasa_descuento_tir' => round((float)$candidate->tasa_descuento_tir, 2),
                        'calificacion_riesgo' => $candidate->calificacion_riesgo ?? 'AAA'
                    ];
                }
            }

            // Mark-to-Market Valuation sobre el Saldo Capital Vigente:
            $valorMercado = $capitalVigente * ($precioVectorPct / $precioCompraPct);
            $gananciaUsd = $valorMercado - $capitalVigente;
            $gananciaPct = $capitalVigente > 0 ? ($gananciaUsd / $capitalVigente) * 100 : 0;

            $totalValorCompra += $capitalVigente;
            $totalValorMercado += $valorMercado;
            $totalGananciaUsd += $gananciaUsd;

            return [
                'id_inversion' => $h->id_inversion,
                'id_instrumento' => $h->id_instrumento,
                'nombre_emisor' => $h->nombre_emisor ?? $h->nemo_emisor ?? 'Emisor',
                'nombre_instrumento' => $h->nombre_instrumento,
                'codigo_titulo_vector' => $h->codigo_titulo_vector,
                'sugerencia_vector' => $sugerenciaVector,
                'capital_original' => round($capitalOriginal, 2),
                'capital_invertido' => round($capitalVigente, 2), // Representa el Saldo Capital Vigente actual
                'precio_compra_porcentaje' => round($precioCompraPct, 4),
                'precio_vector_porcentaje' => round($precioVectorPct, 4),
                'valor_mercado_actual' => round($valorMercado, 2),
                'ganancia_no_realizada_usd' => round($gananciaUsd, 2),
                'ganancia_no_realizada_pct' => round($gananciaPct, 2),
                'tasa_cupon_compra' => round((float) $h->tasa_cupon_compra, 2),
                'rendimiento_compra' => round($rendimientoCompra, 2),
                'tir_vector' => $h->tir_vector !== null ? round((float) $h->tir_vector, 2) : round($rendimientoCompra, 2),
                'calificacion_riesgo' => $h->rating_vector ?? 'AAA',
                'plazo_dias_remanentes' => $h->plazo_vector_dias !== null ? (int) $h->plazo_vector_dias : 0,
                'fecha_compra' => $h->fecha_compra,
                'fecha_emision' => $h->fecha_emision,
                'fecha_vencimiento' => $h->fecha_vencimiento
            ];
        });

        $totalGananciaPct = $totalValorCompra > 0 ? ($totalGananciaUsd / $totalValorCompra) * 100 : 0;

        return [
            'fecha_vector' => $latestDate,
            'summary' => [
                'total_valor_compra' => round($totalValorCompra, 2),
                'total_valor_mercado' => round($totalValorMercado, 2),
                'total_ganancia_usd' => round($totalGananciaUsd, 2),
                'total_ganancia_pct' => round($totalGananciaPct, 2),
                'total_posiciones' => $mappedHoldings->count()
            ],
            'holdings' => $mappedHoldings
        ];
    }

    /**
     * Obtiene el detalle completo de una inversión y su tabla de amortizaciones
     */
    public function getInvestmentDetail(int $idInversion): ?array
    {
        $latestDate = DB::connection('mysql_inversion')->table('vector_precio_diario')->max('fecha_vector');

        $inv = DB::table('inversion as i')
            ->join('instrumento as inst', 'i.id_instrumento', '=', 'inst.id_instrumento')
            ->leftJoin('emisor as e', 'inst.id_emisor', '=', 'e.id_emisor')
            ->leftJoin('persona as prop', 'i.id_propietario', '=', 'prop.id_persona')
            ->leftJoin(DB::raw('inversion.vector_precio_diario as v'), function ($join) use ($latestDate) {
                $join->on(DB::raw("CASE WHEN inst.codigo_titulo_vector LIKE 'a%' THEN inst.codigo_titulo_vector ELSE CONCAT('a', inst.codigo_titulo_vector) END"), '=', 'v.codigo_titulo_vector')
                     ->where('v.fecha_vector', '=', $latestDate);
            })
            ->where('i.id_inversion', $idInversion)
            ->select([
                'i.id_inversion',
                'inst.id_instrumento',
                'inst.nombre as nombre_instrumento',
                'inst.codigo_titulo_vector',
                'inst.fecha_emision',
                'inst.fecha_vencimiento',
                'e.nombre as nombre_emisor',
                'e.sigla as nemo_emisor',
                'e.calificacion_riesgo as rating_emisor',
                'prop.nombres as prop_nombres',
                'prop.apellidos as prop_apellidos',
                'i.valor_nominal',
                'i.capital_invertido',
                'i.saldo_capital_actual',
                'i.precio_compra',
                'i.tasa_interes as tasa_cupon_compra',
                'i.rendimiento_nominal',
                'i.rendimiento_efectivo',
                'i.fecha_compra',
                'v.precio_porcentaje as precio_vector_porcentaje',
                'v.tasa_descuento_tir as tir_vector',
                'v.calificacion_riesgo as rating_vector',
                'v.plazo_dias_remanentes as plazo_vector_dias'
            ])
            ->first();

        if (!$inv) return null;

        // Propietario de la inversión
        $propietarioNombre = trim(($inv->prop_nombres ?? '') . ' ' . ($inv->prop_apellidos ?? ''));
        if (!$propietarioNombre || $propietarioNombre === '') {
            $propietarioNombre = 'N/A';
        }

        // Búsqueda de sugerencia de vector si aplica
        $sugerenciaVector = null;
        if ($inv->precio_vector_porcentaje === null || strlen(trim($inv->codigo_titulo_vector)) < 10) {
            $emisorName = $inv->nombre_emisor ?? $inv->nemo_emisor;
            $firstWordEmisor = explode(' ', trim($emisorName))[0];

            $candidate = DB::connection('mysql_inversion')->table('vector_precio_diario')
                ->where('fecha_vector', $latestDate)
                ->where(function($q) use ($inv, $firstWordEmisor) {
                    if ($inv->nemo_emisor) $q->where('nemo_emisor', '=', $inv->nemo_emisor);
                    $q->orWhere('nombre_emisor', 'LIKE', '%' . $firstWordEmisor . '%');
                })
                ->where(function($q) use ($inv) {
                    if ($inv->fecha_vencimiento) $q->where('fecha_vencimiento', $inv->fecha_vencimiento);
                    if ($inv->fecha_emision) $q->orWhere('fecha_emision', $inv->fecha_emision);
                })
                ->first();

            if ($candidate) {
                $sugerenciaVector = [
                    'codigo_titulo_vector' => $candidate->codigo_titulo_vector,
                    'clase_titulo' => $candidate->clase_titulo,
                    'precio_porcentaje' => round((float)$candidate->precio_porcentaje, 4),
                    'tasa_descuento_tir' => round((float)$candidate->tasa_descuento_tir, 2),
                    'calificacion_riesgo' => $candidate->calificacion_riesgo ?? 'AAA'
                ];
            }
        }

        // Obtener la tabla de amortizaciones
        $amortizaciones = DB::table('amortizacion')
            ->where('id_inversion', $idInversion)
            ->where('eliminado', 0)
            ->orderBy('numero_cuota')
            ->orderBy('fecha_pago')
            ->get();

        $totalCapitalAmortizado = (float) $amortizaciones->where('id_estado_amortizacion', 135)->sum('capital');
        $totalCapitalPendiente = (float) $amortizaciones->where('id_estado_amortizacion', 134)->sum('capital');
        $totalInteresPagado = (float) $amortizaciones->where('id_estado_amortizacion', 135)->sum('interes');
        $totalInteresPendiente = (float) $amortizaciones->where('id_estado_amortizacion', 134)->sum('interes');
        $totalCuotas = $amortizaciones->count();
        $cuotasPagadasCount = $amortizaciones->where('id_estado_amortizacion', 135)->count();

        // Capital Original Real: si hay cuotas de amortización, el verdadero capital inicial es la suma total de cuotas (pagadas + pendientes)
        $capitalOriginalReal = ($totalCuotas > 0 && ($totalCapitalAmortizado + $totalCapitalPendiente) > 0)
            ? ($totalCapitalAmortizado + $totalCapitalPendiente)
            : (float)$inv->capital_invertido;

        $saldoCapitalVigente = $inv->saldo_capital_actual !== null 
            ? (float)$inv->saldo_capital_actual 
            : ($totalCuotas > 0 ? $totalCapitalPendiente : $capitalOriginalReal);

        $pctAmortizado = $capitalOriginalReal > 0 ? ($totalCapitalAmortizado / $capitalOriginalReal) * 100 : 0;

        $ratingFinal = $inv->rating_vector ?? $inv->rating_emisor;
        if (!$ratingFinal || trim($ratingFinal) === '' || trim($ratingFinal) === '-') {
            $ratingFinal = 'S/N';
        }

        $rendimientoCompraVal = round((float)($inv->rendimiento_efectivo > 0 ? $inv->rendimiento_efectivo : ($inv->rendimiento_nominal > 0 ? $inv->rendimiento_nominal : $inv->tasa_cupon_compra)), 2);
        $tirVectorVal = $inv->tir_vector !== null ? round((float)$inv->tir_vector, 2) : $rendimientoCompraVal;

        return [
            'inversion' => [
                'id_inversion' => $inv->id_inversion,
                'id_instrumento' => $inv->id_instrumento,
                'propietario_nombre' => $propietarioNombre,
                'nombre_emisor' => $inv->nombre_emisor ?? $inv->nemo_emisor ?? 'Emisor',
                'nombre_instrumento' => $inv->nombre_instrumento,
                'codigo_titulo_vector' => $inv->codigo_titulo_vector,
                'sugerencia_vector' => $sugerenciaVector,
                'valor_nominal' => round((float)$inv->valor_nominal, 2),
                'capital_invertido_original' => round($capitalOriginalReal, 2),
                'saldo_capital_actual' => round($saldoCapitalVigente, 2),
                'precio_compra_porcentaje' => round((float)($inv->precio_compra > 5 ? $inv->precio_compra : ($inv->precio_compra * 100)), 4),
                'precio_vector_porcentaje' => $inv->precio_vector_porcentaje !== null ? round((float)$inv->precio_vector_porcentaje, 4) : null,
                'rendimiento_compra' => $rendimientoCompraVal,
                'tir_vector' => $tirVectorVal,
                'tasa_cupon_compra' => round((float)$inv->tasa_cupon_compra, 2),
                'rendimiento' => $rendimientoCompraVal,
                'calificacion_riesgo' => $ratingFinal,
                'fecha_compra' => $inv->fecha_compra,
                'fecha_emision' => $inv->fecha_emision,
                'fecha_vencimiento' => $inv->fecha_vencimiento
            ],
            'amortizacion_summary' => [
                'total_cuotas' => $totalCuotas,
                'cuotas_pagadas' => $cuotasPagadasCount,
                'capital_pagado' => round($totalCapitalAmortizado, 2),
                'capital_pendiente' => round($totalCapitalPendiente, 2),
                'interes_pagado' => round($totalInteresPagado, 2),
                'interes_pendiente' => round($totalInteresPendiente, 2),
                'pct_amortizado' => round($pctAmortizado, 2)
            ],
            'cuotas' => $amortizaciones->map(function ($a) {
                return [
                    'id_amortizacion' => $a->id_amortizacion,
                    'numero_cuota' => $a->numero_cuota,
                    'fecha_pago' => $a->fecha_pago,
                    'capital' => round((float)$a->capital, 2),
                    'interes' => round((float)$a->interes, 2),
                    'total' => round((float)($a->capital + $a->interes), 2),
                    'id_estado_amortizacion' => $a->id_estado_amortizacion,
                    'estado_nombre' => $a->id_estado_amortizacion == 135 ? 'Pagada' : ($a->id_estado_amortizacion == 134 ? 'Pendiente' : 'Otro')
                ];
            })
        ];
    }

    /**
     * Actualiza el código de título del vector para un instrumento
     */
    public function updateInstrumentVectorCode(int $idInstrumento, string $codigoVector): bool
    {
        $updated = DB::table('instrumento')
            ->where('id_instrumento', $idInstrumento)
            ->update([
                'codigo_titulo_vector' => trim($codigoVector),
                'fecha_actualizacion' => now()
            ]);

        return $updated > 0;
    }
}
