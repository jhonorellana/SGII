<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class NotasCreditoAnalyticsService
{
    /**
     * Obtiene el listado de filtros disponibles para el Radar de Oportunidades
     */
    public function getFiltrosRadar(): array
    {
        try {
            $db = DB::connection('mysql_inversion');

            $fechas = $db->table('notas_credito_his')
                ->selectRaw('MIN(FECHA) as fecha_min, MAX(FECHA) as fecha_max, COUNT(*) as total_registros')
                ->first();

            $casasVendedoras = $db->table('notas_credito_his')
                ->whereNotNull('CASA_VENDEDORA')
                ->where('CASA_VENDEDORA', '!=', '')
                ->select('CASA_VENDEDORA')
                ->distinct()
                ->orderBy('CASA_VENDEDORA')
                ->pluck('CASA_VENDEDORA');

            $casasCompradoras = $db->table('notas_credito_his')
                ->whereNotNull('CASA_COMPRADORA')
                ->where('CASA_COMPRADORA', '!=', '')
                ->select('CASA_COMPRADORA')
                ->distinct()
                ->orderBy('CASA_COMPRADORA')
                ->pluck('CASA_COMPRADORA');

            $bolsas = $db->table('notas_credito_his')
                ->whereNotNull('BOLSA')
                ->select('BOLSA')
                ->distinct()
                ->pluck('BOLSA');

            $titulos = $db->table('notas_credito_his')
                ->whereNotNull('TITULO')
                ->select('TITULO')
                ->distinct()
                ->pluck('TITULO');

            $maxDate = $fechas->fecha_max ?? date('Y-m-d');
            // Por defecto, fecha inicio = 30 días antes de la fecha máxima registrada
            $defaultFechaInicio = date('Y-m-d', strtotime($maxDate . ' -30 days'));

            return [
                'success' => true,
                'fecha_minima' => $fechas->fecha_min ?? '2019-01-01',
                'fecha_maxima' => $maxDate,
                'default_fecha_inicio' => $defaultFechaInicio,
                'default_fecha_fin' => $maxDate,
                'total_registros_historicos' => (int) ($fechas->total_registros ?? 0),
                'casas_vendedoras' => $casasVendedoras,
                'casas_compradoras' => $casasCompradoras,
                'bolsas' => $bolsas,
                'titulos' => $titulos
            ];
        } catch (\Exception $e) {
            Log::error('Error en getFiltrosRadar: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'fecha_minima' => '2019-01-01',
                'fecha_maxima' => date('Y-m-d'),
                'default_fecha_inicio' => date('Y-m-d', strtotime('-30 days')),
                'default_fecha_fin' => date('Y-m-d'),
                'casas_vendedoras' => [],
                'casas_compradoras' => [],
                'bolsas' => ['BVG', 'BVQ'],
                'titulos' => ['NOTA DE CREDITO']
            ];
        }
    }

    /**
     * Consulta el Radar de Oportunidades y Arbitraje Diario según los filtros aplicados
     */
    public function getRadarOportunidades(array $filters): array
    {
        try {
            $db = DB::connection('mysql_inversion');

            $fechaInicio = $filters['fecha_inicio'] ?? date('Y-m-d', strtotime('-30 days'));
            $fechaFin = $filters['fecha_fin'] ?? date('Y-m-d');
            $precioMaxOportunidad = isset($filters['precio_max_oportunidad']) ? (float) $filters['precio_max_oportunidad'] : 97.50;
            $soloOportunidades = !empty($filters['solo_oportunidades']);
            $tramoNominal = $filters['tramo_nominal'] ?? 'todos';
            $casaVendedora = !empty($filters['casa_vendedora']) ? trim($filters['casa_vendedora']) : null;
            $casaCompradora = !empty($filters['casa_compradora']) ? trim($filters['casa_compradora']) : null;
            $bolsa = (!empty($filters['bolsa']) && strtoupper($filters['bolsa']) !== 'TODAS') ? strtoupper(trim($filters['bolsa'])) : null;
            $titulo = (!empty($filters['titulo']) && strtoupper($filters['titulo']) !== 'TODOS') ? trim($filters['titulo']) : null;

            // 1. Construir query base
            $query = $db->table('notas_credito_his')
                ->whereBetween('FECHA', [$fechaInicio, $fechaFin])
                ->whereBetween('PRECIO_PORC', [50.0, 105.0]); // Limitar a precios válidos en mercado bursátil

            // Filtro por tramo de valor nominal
            if ($tramoNominal === 'micro') {
                $query->where('VALOR_NOMINAL', '<', 2000);
            } elseif ($tramoNominal === 'pequeno') {
                $query->whereBetween('VALOR_NOMINAL', [2000, 9999.99]);
            } elseif ($tramoNominal === 'mediano') {
                $query->whereBetween('VALOR_NOMINAL', [10000, 49999.99]);
            } elseif ($tramoNominal === 'grande') {
                $query->where('VALOR_NOMINAL', '>=', 50000);
            }

            if ($casaVendedora) {
                $query->where('CASA_VENDEDORA', 'LIKE', "%{$casaVendedora}%");
            }

            if ($casaCompradora) {
                $query->where('CASA_COMPRADORA', 'LIKE', "%{$casaCompradora}%");
            }

            if ($bolsa) {
                $query->where('BOLSA', $bolsa);
            }

            if ($titulo) {
                $query->where('TITULO', $titulo);
            }

            // Si se solicita únicamente oportunidades
            if ($soloOportunidades) {
                $query->where('PRECIO_PORC', '<=', $precioMaxOportunidad);
            }

            // 2. Obtener precio de referencia mayorista (promedio de operaciones >= $50k en el período o globalmente)
            $refMayoristaQuery = $db->table('notas_credito_his')
                ->where('VALOR_NOMINAL', '>=', 50000)
                ->whereBetween('PRECIO_PORC', [70.0, 102.0]);
            
            // Si el período filtrado tiene operaciones mayoristas, usar ese; de lo contrario último año
            $precioRefMayorista = (float) (clone $refMayoristaQuery)->whereBetween('FECHA', [$fechaInicio, $fechaFin])->avg('PRECIO_PORC');
            if ($precioRefMayorista <= 0) {
                $precioRefMayorista = (float) $refMayoristaQuery->where('FECHA', '>=', date('Y-m-d', strtotime($fechaFin . ' -1 year')))->avg('PRECIO_PORC');
            }
            if ($precioRefMayorista <= 0) {
                $precioRefMayorista = 99.00; // Benchmark institucional típico
            }
            $precioRefMayorista = round($precioRefMayorista, 2);

            // 3. Calcular KPIs Consolidados
            $kpiStats = (clone $query)->selectRaw('
                COUNT(*) as total_operaciones,
                IFNULL(SUM(VALOR_NOMINAL), 0) as volumen_nominal,
                IFNULL(SUM(VALOR_EFECTIVO), 0) as volumen_efectivo,
                IFNULL(MIN(PRECIO_PORC), 0) as precio_minimo,
                IFNULL(MAX(PRECIO_PORC), 0) as precio_maximo,
                IFNULL(AVG(PRECIO_PORC), 0) as precio_promedio_simple,
                SUM(CASE WHEN PRECIO_PORC <= ? THEN 1 ELSE 0 END) as total_oportunidades,
                IFNULL(SUM(CASE WHEN PRECIO_PORC <= ? THEN VALOR_NOMINAL ELSE 0 END), 0) as volumen_oportunidades_nominal
            ', [$precioMaxOportunidad, $precioMaxOportunidad])->first();

            $totalOps = (int) ($kpiStats->total_operaciones ?? 0);
            $volNominal = (float) ($kpiStats->volumen_nominal ?? 0);
            $volEfectivo = (float) ($kpiStats->volumen_efectivo ?? 0);
            $precioMin = (float) ($kpiStats->precio_minimo ?? 0);
            $precioMax = (float) ($kpiStats->precio_maximo ?? 0);
            $precioPromSimple = round((float) ($kpiStats->precio_promedio_simple ?? 0), 2);
            $precioPromPonderado = $volNominal > 0 ? round(($volEfectivo / $volNominal) * 100, 2) : 0;
            $totalOportunidades = (int) ($kpiStats->total_oportunidades ?? 0);
            $volOportunidades = (float) ($kpiStats->volumen_oportunidades_nominal ?? 0);
            $ahorroDescuentoTotal = round($volNominal - $volEfectivo, 2);
            $spreadPeriodo = round($precioMax - $precioMin, 2);

            // Mejor oportunidad (registro con el precio más bajo en el período)
            $mejorOportunidad = null;
            if ($totalOps > 0) {
                $mejorOpRow = (clone $query)->orderBy('PRECIO_PORC', 'ASC')
                    ->orderBy('VALOR_NOMINAL', 'DESC')
                    ->first();
                if ($mejorOpRow) {
                    $mejorOportunidad = [
                        'fecha' => $mejorOpRow->FECHA,
                        'precio_porc' => (float) $mejorOpRow->PRECIO_PORC,
                        'valor_nominal' => (float) $mejorOpRow->VALOR_NOMINAL,
                        'casa_vendedora' => $mejorOpRow->CASA_VENDEDORA,
                        'bolsa' => $mejorOpRow->BOLSA,
                        'descuento_pct' => round(100 - (float) $mejorOpRow->PRECIO_PORC, 2)
                    ];
                }
            }

            // 4. Obtener registros detallados (ordenados por defecto por PRECIO ascendente para ver mejores oportunidades arriba)
            $records = (clone $query)
                ->select([
                    'id',
                    'FECHA',
                    'TITULO',
                    'EMISOR',
                    'PRECIO_PORC',
                    'MERCADO',
                    'VALOR_NOMINAL',
                    'VALOR_EFECTIVO',
                    'CASA_COMPRADORA',
                    'CASA_VENDEDORA',
                    'BOLSA'
                ])
                ->orderBy('FECHA', 'DESC')
                ->orderBy('PRECIO_PORC', 'ASC')
                ->limit(2000) // Límite seguro para visualización ágil en UI
                ->get()
                ->map(function ($row) use ($precioMaxOportunidad, $precioRefMayorista) {
                    $precio = (float) $row->PRECIO_PORC;
                    $nominal = (float) $row->VALOR_NOMINAL;
                    $efectivo = (float) $row->VALOR_EFECTIVO;
                    $descuentoUsd = round($nominal - $efectivo, 2);
                    $descuentoPct = round(100 - $precio, 2);
                    $spreadVsMayorista = max(0, round($precioRefMayorista - $precio, 2));
                    $gananciaPotencial = round($nominal * ($spreadVsMayorista / 100), 2);

                    // Categoría semántica
                    if ($precio <= 96.50) {
                        $categoria = 'ORO';
                        $categoriaBadge = 'bg-success text-white';
                        $categoriaTexto = 'Oportunidad Oro (<= 96.5%)';
                    } elseif ($precio <= 97.50) {
                        $categoria = 'PLATA';
                        $categoriaBadge = 'bg-primary text-white';
                        $categoriaTexto = 'Oportunidad Plata (96.5% - 97.5%)';
                    } elseif ($precio <= 98.20) {
                        $categoria = 'BRONCE';
                        $categoriaBadge = 'bg-info text-dark';
                        $categoriaTexto = 'Oportunidad Bronce (97.5% - 98.2%)';
                    } else {
                        $categoria = 'REGULAR';
                        $categoriaBadge = 'bg-light text-muted border';
                        $categoriaTexto = 'Precio Regular (> 98.2%)';
                    }

                    return [
                        'id' => $row->id,
                        'fecha' => $row->FECHA,
                        'titulo' => $row->TITULO,
                        'emisor' => $row->EMISOR,
                        'precio_porc' => $precio,
                        'mercado' => $row->MERCADO ?? 'Secundario',
                        'valor_nominal' => $nominal,
                        'valor_efectivo' => $efectivo,
                        'descuento_usd' => $descuentoUsd,
                        'descuento_pct' => $descuentoPct,
                        'casa_vendedora' => $row->CASA_VENDEDORA ?? 'No Especificada',
                        'casa_compradora' => $row->CASA_COMPRADORA ?? 'No Especificada',
                        'bolsa' => $row->BOLSA,
                        'es_oportunidad' => $precio <= $precioMaxOportunidad,
                        'categoria' => $categoria,
                        'categoria_badge' => $categoriaBadge,
                        'categoria_texto' => $categoriaTexto,
                        'spread_vs_mayorista' => $spreadVsMayorista,
                        'ganancia_potencial_usd' => $gananciaPotencial
                    ];
                });

            // 5. Distribución por tramos de valor nominal para este período
            $distribucionTramos = $db->table('notas_credito_his')
                ->whereBetween('FECHA', [$fechaInicio, $fechaFin])
                ->whereBetween('PRECIO_PORC', [50.0, 105.0])
                ->selectRaw('
                    CASE 
                        WHEN VALOR_NOMINAL < 2000 THEN "1. Micro (< $2k)"
                        WHEN VALOR_NOMINAL BETWEEN 2000 AND 9999.99 THEN "2. Pequeño ($2k - $10k)"
                        WHEN VALOR_NOMINAL BETWEEN 1000 AND 49999.99 THEN "3. Mediano ($10k - $50k)"
                        ELSE "4. Institucional (>= $50k)"
                    END as tramo,
                    COUNT(*) as total_ops,
                    ROUND(SUM(VALOR_NOMINAL), 2) as nominal,
                    ROUND(AVG(PRECIO_PORC), 2) as precio_promedio,
                    ROUND(MIN(PRECIO_PORC), 2) as precio_minimo,
                    ROUND(MAX(PRECIO_PORC), 2) as precio_maximo
                ')
                ->groupBy('tramo')
                ->orderBy('tramo')
                ->get();

            // 6. Top Casas Vendedoras con mayores oportunidades en el período
            $topVendedoras = $db->table('notas_credito_his')
                ->whereBetween('FECHA', [$fechaInicio, $fechaFin])
                ->whereBetween('PRECIO_PORC', [50.0, 105.0])
                ->whereNotNull('CASA_VENDEDORA')
                ->where('CASA_VENDEDORA', '!=', '')
                ->selectRaw('
                    CASA_VENDEDORA,
                    COUNT(*) as ops,
                    ROUND(SUM(VALOR_NOMINAL), 2) as nominal_total,
                    ROUND(AVG(PRECIO_PORC), 2) as precio_promedio,
                    ROUND(MIN(PRECIO_PORC), 2) as precio_minimo,
                    SUM(CASE WHEN PRECIO_PORC <= ? THEN 1 ELSE 0 END) as ops_oportunidad
                ', [$precioMaxOportunidad])
                ->groupBy('CASA_VENDEDORA')
                ->orderBy('ops_oportunidad', 'DESC')
                ->orderBy('precio_promedio', 'ASC')
                ->limit(6)
                ->get();

            return [
                'success' => true,
                'filtros_aplicados' => [
                    'fecha_inicio' => $fechaInicio,
                    'fecha_fin' => $fechaFin,
                    'precio_max_oportunidad' => $precioMaxOportunidad,
                    'solo_oportunidades' => $soloOportunidades,
                    'tramo_nominal' => $tramoNominal,
                    'casa_vendedora' => $casaVendedora,
                    'casa_compradora' => $casaCompradora,
                    'bolsa' => $bolsa,
                    'titulo' => $titulo
                ],
                'kpis' => [
                    'total_operaciones' => $totalOps,
                    'volumen_nominal' => $volNominal,
                    'volumen_efectivo' => $volEfectivo,
                    'ahorro_descuento_total' => $ahorroDescuentoTotal,
                    'precio_minimo' => $precioMin,
                    'precio_maximo' => $precioMax,
                    'precio_promedio_simple' => $precioPromSimple,
                    'precio_promedio_ponderado' => $precioPromPonderado,
                    'spread_periodo' => $spreadPeriodo,
                    'total_oportunidades' => $totalOportunidades,
                    'volumen_oportunidades_nominal' => $volOportunidades,
                    'precio_referencia_mayorista' => $precioRefMayorista,
                    'mejor_oportunidad' => $mejorOportunidad
                ],
                'items' => $records,
                'distribucion_tramos' => $distribucionTramos,
                'top_vendedoras_oportunidad' => $topVendedoras
            ];

        } catch (\Exception $e) {
            Log::error('Error en getRadarOportunidades: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'kpis' => null,
                'items' => []
            ];
        }
    }

    /**
     * Simula la rentabilidad de comprar una o varias notas y venderlas a un precio mayorista
     */
    public function simularArbitraje(
        float $valorNominal,
        float $precioCompra,
        ?float $precioVenta = 98.90,
        ?float $comisionCompraPct = 0.15,
        ?float $comisionVentaPct = 0.15,
        int $diasEstimadosRotacion = 25
    ): array {
        $precioVenta = $precioVenta ?: 98.90;
        $comisionCompraPct = $comisionCompraPct !== null ? $comisionCompraPct : 0.15;
        $comisionVentaPct = $comisionVentaPct !== null ? $comisionVentaPct : 0.15;
        $diasEstimadosRotacion = max(1, $diasEstimadosRotacion ?: 25);

        // Costo de compra
        $inversionBruta = round($valorNominal * ($precioCompra / 100), 2);
        $comisionCompraUsd = round($valorNominal * ($comisionCompraPct / 100), 2);
        $totalInvertido = round($inversionBruta + $comisionCompraUsd, 2);

        // Venta consolidada
        $ingresoBrutoVenta = round($valorNominal * ($precioVenta / 100), 2);
        $comisionVentaUsd = round($valorNominal * ($comisionVentaPct / 100), 2);
        $ingresoNetoVenta = round($ingresoBrutoVenta - $comisionVentaUsd, 2);

        // Utilidad y rendimiento
        $utilidadNeta = round($ingresoNetoVenta - $totalInvertido, 2);
        $roiDirectoPct = $totalInvertido > 0 ? round(($utilidadNeta / $totalInvertido) * 100, 2) : 0;
        
        // TIR Anualizada proyectada por rotación
        $rotacionesAlAnio = 365 / $diasEstimadosRotacion;
        $tirAnualizada = $roiDirectoPct > 0 ? round((pow(1 + ($roiDirectoPct / 100), $rotacionesAlAnio) - 1) * 100, 2) : 0;

        return [
            'valor_nominal' => $valorNominal,
            'precio_compra_porc' => $precioCompra,
            'precio_venta_porc' => $precioVenta,
            'dias_rotacion' => $diasEstimadosRotacion,
            'inversion_total' => $totalInvertido,
            'ingreso_neto_venta' => $ingresoNetoVenta,
            'utilidad_neta_usd' => $utilidadNeta,
            'roi_directo_pct' => $roiDirectoPct,
            'tir_anualizada_pct' => $tirAnualizada,
            'desglose' => [
                'inversion_bruta' => $inversionBruta,
                'comision_compra_usd' => $comisionCompraUsd,
                'ingreso_bruto_venta' => $ingresoBrutoVenta,
                'comision_venta_usd' => $comisionVentaUsd,
                'spread_puntos_porc' => round($precioVenta - $precioCompra, 2)
            ]
        ];
    }

    /**
     * Reporte 2: Matriz de Precios por Tramo de Monto y Curva de Descuento
     */
    public function getCurvaDescuento(array $filters): array
    {
        try {
            $db = DB::connection('mysql_inversion');

            $preset = $filters['preset'] ?? 'todos';
            $fechaInicio = $filters['fecha_inicio'] ?? null;
            $fechaFin = $filters['fecha_fin'] ?? null;
            $bolsa = $filters['bolsa'] ?? 'TODAS';
            $titulo = $filters['titulo'] ?? 'TODOS';

            $maxFechaDb = $db->table('notas_credito_his')->max('FECHA') ?? date('Y-m-d');
            $minFechaDb = $db->table('notas_credito_his')->min('FECHA') ?? '2019-01-01';

            if ($preset === '2026') {
                $fechaInicio = '2026-01-01';
                $fechaFin = $maxFechaDb;
            } elseif ($preset === '12meses') {
                $fechaInicio = date('Y-m-d', strtotime('-12 months', strtotime($maxFechaDb)));
                $fechaFin = $maxFechaDb;
            } elseif ($preset === '90dias') {
                $fechaInicio = date('Y-m-d', strtotime('-90 days', strtotime($maxFechaDb)));
                $fechaFin = $maxFechaDb;
            } elseif ($preset === '30dias') {
                $fechaInicio = date('Y-m-d', strtotime('-30 days', strtotime($maxFechaDb)));
                $fechaFin = $maxFechaDb;
            } elseif ($preset === 'todos') {
                $fechaInicio = $minFechaDb;
                $fechaFin = $maxFechaDb;
            } else {
                $fechaInicio = $fechaInicio ?: $minFechaDb;
                $fechaFin = $fechaFin ?: $maxFechaDb;
            }

            // Consulta Base
            $baseQuery = $db->table('notas_credito_his')
                ->whereBetween('PRECIO_PORC', [70, 105])
                ->whereBetween('FECHA', [$fechaInicio, $fechaFin]);

            if ($bolsa !== 'TODAS') {
                $baseQuery->where('BOLSA', $bolsa);
            }
            if ($titulo !== 'TODOS') {
                $baseQuery->where('TITULO', $titulo);
            }

            // Global totals
            $globalStats = (clone $baseQuery)->selectRaw('
                COUNT(*) as total_ops,
                COALESCE(SUM(VALOR_NOMINAL), 0) as total_nominal,
                COALESCE(SUM(VALOR_EFECTIVO), 0) as total_efectivo,
                COALESCE(SUM(VALOR_NOMINAL - VALOR_EFECTIVO), 0) as total_ahorro,
                COALESCE(AVG(PRECIO_PORC), 0) as precio_promedio_simple,
                COALESCE(SUM(PRECIO_PORC * VALOR_NOMINAL) / NULLIF(SUM(VALOR_NOMINAL), 0), 0) as precio_promedio_ponderado,
                COALESCE(MIN(PRECIO_PORC), 0) as precio_min_global,
                COALESCE(MAX(PRECIO_PORC), 0) as precio_max_global
            ')->first();

            $totalOps = max(1, (int)($globalStats->total_ops ?? 0));
            $totalNominal = max(1, (float)($globalStats->total_nominal ?? 0));

            $tramosDef = [
                'micro' => [
                    'id' => 1,
                    'key' => 'micro',
                    'tramo' => '< $2,000',
                    'nombre' => 'Micro / Menudeo',
                    'descripcion' => 'Notas de personas naturales con máxima tasa de descuento',
                    'min' => 0,
                    'max' => 2000
                ],
                'pequeno' => [
                    'id' => 2,
                    'key' => 'pequeno',
                    'tramo' => '$2,000 - $10,000',
                    'nombre' => 'Pequeño',
                    'descripcion' => 'Notas de pequeños contribuyentes y PYMES',
                    'min' => 2000,
                    'max' => 10000
                ],
                'mediano' => [
                    'id' => 3,
                    'key' => 'mediano',
                    'tramo' => '$10,000 - $50,000',
                    'nombre' => 'Mediano',
                    'descripcion' => 'Empresas medianas con precios intermedios',
                    'min' => 10000.01,
                    'max' => 50000
                ],
                'grande' => [
                    'id' => 4,
                    'key' => 'grande',
                    'tramo' => '> $50,000',
                    'nombre' => 'Institucional / Mayorista',
                    'descripcion' => 'Paquetes consolidados comprados por tesorerías corporativas',
                    'min' => 50000.01,
                    'max' => 999999999
                ]
            ];

            $tramosResult = [];

            foreach ($tramosDef as $key => $def) {
                $q = (clone $baseQuery)
                    ->where('VALOR_NOMINAL', '>=', $def['min'])
                    ->where('VALOR_NOMINAL', '<=', $def['max']);

                $stats = (clone $q)->selectRaw('
                    COUNT(*) as ops,
                    COALESCE(SUM(VALOR_NOMINAL), 0) as nominal,
                    COALESCE(SUM(VALOR_EFECTIVO), 0) as efectivo,
                    COALESCE(MIN(PRECIO_PORC), 0) as min_p,
                    COALESCE(MAX(PRECIO_PORC), 0) as max_p,
                    COALESCE(AVG(PRECIO_PORC), 0) as avg_p,
                    COALESCE(SUM(PRECIO_PORC * VALOR_NOMINAL) / NULLIF(SUM(VALOR_NOMINAL), 0), 0) as ponderado_p
                ')->first();

                // Precios ordenados para percentiles
                $precios = (clone $q)->orderBy('PRECIO_PORC', 'asc')->pluck('PRECIO_PORC')->toArray();
                $c = count($precios);

                $p10 = $c > 0 ? (float)$precios[(int)floor($c * 0.10)] : 0;
                $p25 = $c > 0 ? (float)$precios[(int)floor($c * 0.25)] : 0;
                $p50 = $c > 0 ? (float)$precios[(int)floor($c * 0.50)] : 0;
                $p75 = $c > 0 ? (float)$precios[(int)floor($c * 0.75)] : 0;
                $p90 = $c > 0 ? (float)$precios[(int)floor($c * 0.90)] : 0;

                $tramosResult[$key] = [
                    'id' => $def['id'],
                    'key' => $def['key'],
                    'tramo' => $def['tramo'],
                    'nombre' => $def['nombre'],
                    'descripcion' => $def['descripcion'],
                    'ops' => $c,
                    'pct_ops' => round(($c / $totalOps) * 100, 1),
                    'nominal' => round((float)($stats->nominal ?? 0), 2),
                    'pct_nominal' => round(((float)($stats->nominal ?? 0) / $totalNominal) * 100, 1),
                    'efectivo' => round((float)($stats->efectivo ?? 0), 2),
                    'descuento_total' => round((float)($stats->nominal ?? 0) - (float)($stats->efectivo ?? 0), 2),
                    'precio_min' => round((float)($stats->min_p ?? 0), 2),
                    'p10' => round($p10, 2),
                    'p25' => round($p25, 2), // Compra sugerida
                    'mediana_p50' => round($p50, 2),
                    'precio_promedio' => round((float)($stats->avg_p ?? 0), 2),
                    'precio_ponderado' => round((float)($stats->ponderado_p ?? 0), 2),
                    'p75' => round($p75, 2), // Venta sugerida
                    'p90' => round($p90, 2),
                    'precio_max' => round((float)($stats->max_p ?? 0), 2),
                    'spread_interno' => round($p75 - $p25, 2),
                    'descuento_promedio_pct' => round(100 - (float)($stats->ponderado_p ?? 0), 2)
                ];
            }

            // Spread de Arbitraje Institucional: Vender a P75 de Grande vs Comprar a P25 de cada tramo
            $p75Institucional = $tramosResult['grande']['p75'] ?? 99.76;

            foreach ($tramosResult as $k => &$tr) {
                $spreadVsMayorista = round($p75Institucional - $tr['p25'], 2);
                $tr['spread_vs_mayorista'] = max(0, $spreadVsMayorista);
                $tr['ganancia_por_10k'] = round(($spreadVsMayorista / 100) * 10000, 2);
            }
            unset($tr);

            // Muestra representativa para scatter plot (hasta 150 puntos)
            $scatterSample = (clone $baseQuery)
                ->select(['VALOR_NOMINAL as nominal', 'PRECIO_PORC as precio', 'FECHA as fecha', 'CASA_VENDEDORA as vendedora', 'BOLSA as bolsa'])
                ->inRandomOrder()
                ->limit(150)
                ->get()
                ->map(function ($item) {
                    return [
                        'x' => round((float)$item->nominal, 2),
                        'y' => round((float)$item->precio, 2),
                        'fecha' => $item->fecha,
                        'vendedora' => $item->vendedora,
                        'bolsa' => $item->bolsa
                    ];
                });

            // Curva de puntos para Chart.js
            $chartCurva = [
                'labels' => array_column($tramosResult, 'tramo'),
                'datasets' => [
                    [
                        'label' => 'P25: Compra Sugerida (Margen Seguro)',
                        'data' => array_column($tramosResult, 'p25'),
                        'borderColor' => '#059669',
                        'backgroundColor' => 'rgba(5, 150, 105, 0.15)',
                        'borderWidth' => 3,
                        'fill' => false,
                        'tension' => 0.35,
                        'pointRadius' => 6,
                        'pointHoverRadius' => 8
                    ],
                    [
                        'label' => 'Precio Promedio Ponderado',
                        'data' => array_column($tramosResult, 'precio_ponderado'),
                        'borderColor' => '#0284c7',
                        'backgroundColor' => 'rgba(2, 132, 199, 0.15)',
                        'borderWidth' => 3,
                        'fill' => false,
                        'tension' => 0.35,
                        'pointRadius' => 6,
                        'pointHoverRadius' => 8
                    ],
                    [
                        'label' => 'P75: Venta Mayorista / Salida',
                        'data' => array_column($tramosResult, 'p75'),
                        'borderColor' => '#7c3aed',
                        'backgroundColor' => 'rgba(124, 58, 237, 0.15)',
                        'borderWidth' => 3,
                        'fill' => false,
                        'tension' => 0.35,
                        'pointRadius' => 6,
                        'pointHoverRadius' => 8
                    ]
                ]
            ];

            return [
                'success' => true,
                'filtros_aplicados' => [
                    'preset' => $preset,
                    'fecha_inicio' => $fechaInicio,
                    'fecha_fin' => $fechaFin,
                    'bolsa' => $bolsa,
                    'titulo' => $titulo,
                    'fecha_min_db' => $minFechaDb,
                    'fecha_max_db' => $maxFechaDb
                ],
                'kpis' => [
                    'total_operaciones' => (int)($globalStats->total_ops ?? 0),
                    'total_volumen_nominal' => round((float)($globalStats->total_nominal ?? 0), 2),
                    'total_volumen_efectivo' => round((float)($globalStats->total_efectivo ?? 0), 2),
                    'total_ahorro_mercado' => round((float)($globalStats->total_ahorro ?? 0), 2),
                    'precio_promedio_ponderado' => round((float)($globalStats->precio_promedio_ponderado ?? 0), 2),
                    'spread_max_arbitraje' => round($p75Institucional - ($tramosResult['micro']['p25'] ?? 97.0), 2),
                    'ganancia_max_por_10k' => round((($p75Institucional - ($tramosResult['micro']['p25'] ?? 97.0)) / 100) * 10000, 2),
                    'precio_ref_compra_micro' => $tramosResult['micro']['p25'] ?? 97.0,
                    'precio_ref_venta_grande' => $p75Institucional
                ],
                'tramos' => array_values($tramosResult),
                'chart_curva' => $chartCurva,
                'scatter_sample' => $scatterSample
            ];
        } catch (\Exception $e) {
            Log::error('Error en getCurvaDescuento: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'kpis' => null,
                'tramos' => []
            ];
        }
    }
}

