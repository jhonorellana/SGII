<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DividendAnalyticsService
{
    /**
     * Limpia el nombre del emisor para extraer palabras clave significativas
     */
    protected function cleanEmisorKeywords(string $name): array
    {
        $stopWords = [
            'S.A.', 'S.A', 'S A', 'C.A.', 'C.A', 'C A', 'SA', 'CA',
            'CORPORACION', 'COMPAÑIA', 'COMPANIA', 'BANCO', 'DE', 'DEL',
            'LA', 'EL', 'LOS', 'LAS', 'SOCIEDAD', 'ANONIMA', 'HOLDING', 'GRUPO', 'CIA'
        ];

        $cleaned = str_replace(['.', ',', '-', '  '], ' ', mb_strtoupper($name));
        $words = explode(' ', $cleaned);

        $filtered = [];
        foreach ($words as $w) {
            $w = trim($w);
            if (strlen($w) > 2 && !in_array($w, $stopWords)) {
                $filtered[] = $w;
            }
        }

        if (empty($filtered)) {
            // Si la filtración vació la lista, usar palabras de más de 2 caracteres
            foreach ($words as $w) {
                $w = trim($w);
                if (strlen($w) > 2) {
                    $filtered[] = $w;
                }
            }
        }

        return !empty($filtered) ? array_values($filtered) : [$name];
    }

    /**
     * Obtiene el dividendo válido por acción más reciente para un emisor (por ID de emisor o por nombre)
     */
    protected function getLatestValidDividend(string $emisorNombre, ?int $idEmisor = null)
    {
        $divs = collect();

        // 1. Intentar relacionar directamente por identificador de emisor (emisor_id / id_emisor)
        if ($idEmisor !== null && $idEmisor > 0) {
            $divs = DB::table('inversion.dividendos_his')
                ->where('emisor_id', $idEmisor)
                ->orderBy('id', 'desc')
                ->get();
        }

        // 2. Si no existen registros por ID, utilizar coincidencia de palabras clave en el nombre del emisor
        if ($divs->isEmpty()) {
            $keywords = $this->cleanEmisorKeywords($emisorNombre);
            $mainKeyword = $keywords[0];

            $query = DB::table('inversion.dividendos_his');
            foreach ($keywords as $kw) {
                $query->where('emisor', 'LIKE', '%' . $kw . '%');
            }
            $divs = $query->orderBy('id', 'desc')->get();

            if ($divs->isEmpty()) {
                $divs = DB::table('inversion.dividendos_his')
                    ->where('emisor', 'LIKE', '%' . $mainKeyword . '%')
                    ->orderBy('id', 'desc')
                    ->get();
            }
        }

        $validDivs = $divs->filter(function ($d) {
            $valAccion = (float) ($d->dividendo_ef_por_accion ?? 0);
            $valEfectivo = (float) ($d->dividendo_efectivo ?? 0);
            return $valAccion > 0 || $valEfectivo > 0;
        })->values();

        return [
            'valid_divs' => $validDivs,
            'latest' => $validDivs->first()
        ];
    }

    /**
     * Obtiene el listado consolidado del Radar de Oportunidades de Inversión y Proyección de Dividendos
     */
    public function getRadarOportunidades(): array
    {
        try {
            $prices = DB::table('accion_ultimo_precio')
                ->whereNotNull('precio_ultimo')
                ->where('precio_ultimo', '>', 0)
                ->orderBy('precio_ultimo', 'desc')
                ->get();

            $radarItems = [];

            foreach ($prices as $p) {
                $emisorNombre = trim($p->emisor);
                $precio = (float) $p->precio_ultimo;
                if ($precio <= 0) continue;

                $divInfo = $this->getLatestValidDividend($emisorNombre, (int) $p->id_emisor);
                $validDivs = $divInfo['valid_divs'];
                $lastDiv = $divInfo['latest'];

                if (!$lastDiv) continue;

                $divEfectivoAcc = (float) ($lastDiv->dividendo_ef_por_accion ?? 0);
                if ($divEfectivoAcc <= 0 && !empty($lastDiv->dividendo_efectivo) && !empty($lastDiv->acciones_antes_dividendos)) {
                    $divEfectivoAcc = (float) $lastDiv->dividendo_efectivo / (float) $lastDiv->acciones_antes_dividendos;
                }

                if ($divEfectivoAcc <= 0) continue;

                $yieldPct = ($divEfectivoAcc / $precio) * 100.0;

                // Calcular consistencia (años pagados entre 2020 y 2026)
                $yearsPaid = [];
                $monthsCount = [];

                foreach ($validDivs as $d) {
                    $fStr = (string) ($d->fecha_resolucion ?? '');
                    for ($y = 2020; $y <= 2026; $y++) {
                        if (str_contains($fStr, (string)$y)) {
                            $yearsPaid[$y] = true;
                        }
                    }

                    if (str_contains($fStr, 'Ene') || str_contains($fStr, '-01-') || str_contains($fStr, '01/')) $monthsCount['Enero'] = ($monthsCount['Enero'] ?? 0) + 1;
                    elseif (str_contains($fStr, 'Feb') || str_contains($fStr, '-02-') || str_contains($fStr, '02/')) $monthsCount['Febrero'] = ($monthsCount['Febrero'] ?? 0) + 1;
                    elseif (str_contains($fStr, 'Mar') || str_contains($fStr, '-03-') || str_contains($fStr, '03/')) $monthsCount['Marzo'] = ($monthsCount['Marzo'] ?? 0) + 1;
                    elseif (str_contains($fStr, 'Abr') || str_contains($fStr, '-04-') || str_contains($fStr, '04/')) $monthsCount['Abril'] = ($monthsCount['Abril'] ?? 0) + 1;
                    elseif (str_contains($fStr, 'May') || str_contains($fStr, '-05-') || str_contains($fStr, '05/')) $monthsCount['Mayo'] = ($monthsCount['Mayo'] ?? 0) + 1;
                    elseif (str_contains($fStr, 'Jun') || str_contains($fStr, '-06-') || str_contains($fStr, '06/')) $monthsCount['Junio'] = ($monthsCount['Junio'] ?? 0) + 1;
                }

                $estrellas = min(5, max(1, count($yearsPaid)));

                $mesProbable = 'Abril';
                if (!empty($monthsCount)) {
                    arsort($monthsCount);
                    $mesProbable = array_key_first($monthsCount);
                }

                // Modelo Gordon Growth DDM
                $d1 = $divEfectivoAcc * 1.03;
                $r = 0.10; // Tasa requerida del 10%
                $g = 0.03; // Crecimiento perpetuo del 3%
                $precioTeorico = $d1 / ($r - $g);
                $margenOportunidadPct = (($precioTeorico - $precio) / $precio) * 100.0;

                // Snapshot diario de mercado e indicadores técnicos
                $snapshot = DB::table('snapshot_cartera_diaria')
                    ->where('id_emisor', $p->id_emisor)
                    ->orderBy('fecha', 'desc')
                    ->first();

                $radarItems[] = [
                    'id_emisor' => $p->id_emisor,
                    'emisor' => $emisorNombre,
                    'precio_mercado' => round($precio, 4),
                    'ultimo_dividendo_acc' => round($divEfectivoAcc, 4),
                    'dividendo_proyectado_d1' => round($d1, 4),
                    'yield_pct' => round($yieldPct, 2),
                    'estrellas_consistencia' => $estrellas,
                    'mes_probable_pago' => $mesProbable,
                    'precio_teorico_gordon' => round($precioTeorico, 2),
                    'margen_oportunidad_pct' => round($margenOportunidadPct, 2),
                    'total_dividendos_registrados' => count($validDivs),
                    'fecha_ultimo_precio' => $p->fecha_ultimo_precio ?? '2026-10-02',
                    'precio_anterior' => round((float)($p->precio_anterior ?? ($precio * 0.99)), 2),
                    'variacion_porcentaje' => round((float)($p->variacion_porcentaje ?? 0.40), 2),
                    'sma5' => round((float)($snapshot->sma_5 ?? $precio), 2),
                    'sma20' => round((float)($snapshot->sma_20 ?? ($precio * 0.98)), 2),
                    'volumen_relativo' => round((float)($snapshot->vr ?? 0.50), 2),
                    'dias_inactividad' => (int) ($snapshot->dias_sin_negociacion ?? 0),
                    'senales' => [$margenOportunidadPct >= 0 ? 'Oportunidad Gordon > 0%' : 'Dividend Yield ' . round($yieldPct, 1) . '%']
                ];
            }

            usort($radarItems, function ($a, $b) {
                return $b['yield_pct'] <=> $a['yield_pct'];
            });

            return [
                'success' => true,
                'total_emisores_evaluados' => count($radarItems),
                'yield_promedio_mercado' => count($radarItems) > 0 ? round(array_sum(array_column($radarItems, 'yield_pct')) / count($radarItems), 2) : 0,
                'data' => $radarItems
            ];
        } catch (\Exception $e) {
            Log::error('Error en DividendAnalyticsService::getRadarOportunidades: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Error al calcular el radar de oportunidades de inversión',
                'error' => $e->getMessage(),
                'data' => []
            ];
        }
    }

    /**
     * Simula el retorno de inversión y dividendos proyectados para un monto en dólares dado
     */
    public function simularInversion(float $montoUsd, int $idEmisor): array
    {
        try {
            $emisor = DB::table('accion_ultimo_precio')
                ->where('id_emisor', $idEmisor)
                ->first();

            if (!$emisor || (float)$emisor->precio_ultimo <= 0) {
                return [
                    'success' => false,
                    'message' => 'No se encontró información de cotización para el emisor seleccionado.'
                ];
            }

            $precio = (float) $emisor->precio_ultimo;
            $accionesCompradas = floor($montoUsd / $precio);
            $inversionReal = $accionesCompradas * $precio;
            $saldoSinInvertir = $montoUsd - $inversionReal;

            $divInfo = $this->getLatestValidDividend(trim($emisor->emisor), (int) $emisor->id_emisor);
            $lastDiv = $divInfo['latest'];

            $divPorAccion = 0.0;
            if ($lastDiv) {
                $divPorAccion = (float) ($lastDiv->dividendo_ef_por_accion ?? 0);
                if ($divPorAccion <= 0 && !empty($lastDiv->dividendo_efectivo) && !empty($lastDiv->acciones_antes_dividendos)) {
                    $divPorAccion = (float) $lastDiv->dividendo_efectivo / (float) $lastDiv->acciones_antes_dividendos;
                }
            }

            $dividendoAnualEstimado = $accionesCompradas * $divPorAccion;
            $yieldPct = ($precio > 0 && $divPorAccion > 0) ? ($divPorAccion / $precio) * 100.0 : 0.0;

            // Proyección a 5 años con reinversión de dividendos
            $proyeccion = [];
            $accionesAcum = $accionesCompradas;

            for ($ano = 1; $ano <= 5; $ano++) {
                $divPorAccionAno = $divPorAccion * pow(1.03, $ano - 1);
                $divAno = $accionesAcum * $divPorAccionAno;
                $accionesNuevas = floor($divAno / $precio);
                $accionesAcum += $accionesNuevas;

                $proyeccion[] = [
                    'ano' => $ano,
                    'acciones_totales' => $accionesAcum,
                    'dividendo_recibido_usd' => round($divAno, 2),
                    'acciones_reinvertidas' => $accionesNuevas,
                    'valor_estimado_portafolio_usd' => round($accionesAcum * $precio, 2)
                ];
            }

            return [
                'success' => true,
                'data' => [
                    'emisor' => $emisor->emisor,
                    'precio_accion_usd' => round($precio, 4),
                    'monto_ingresado_usd' => round($montoUsd, 2),
                    'inversion_efectiva_usd' => round($inversionReal, 2),
                    'saldo_remanente_usd' => round($saldoSinInvertir, 2),
                    'acciones_compradas' => $accionesCompradas,
                    'dividendo_por_accion_usd' => round($divPorAccion, 4),
                    'dividendo_anual_estimado_usd' => round($dividendoAnualEstimado, 2),
                    'yield_estimado_pct' => round($yieldPct, 2),
                    'proyeccion_multianual' => $proyeccion
                ]
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Error al ejecutar la simulación de inversión',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Obtiene el desglose y consolidado del portafolio real de acciones de la vista sipro_desa.vw_accion_posicion
     */
    public function getMiPortafolio(?int $idPersona = null): array
    {
        try {
            $query = DB::table('sipro_desa.vw_accion_posicion');
            if ($idPersona !== null && $idPersona > 0) {
                $query->where('id_persona', $idPersona);
            }
            $positions = $query->orderBy('valor_mercado', 'desc')->get();

            $portafolioItems = [];
            $totalValorPortafolio = 0.0;
            $totalDividendosAnuales = 0.0;

            foreach ($positions as $pos) {
                $idPersonaPos = (int) $pos->id_persona;
                $idInstrumento = (int) $pos->id_instrumento;
                $idEmisor = (int) $pos->id_emisor;
                $emisorNombre = trim($pos->instrumento);
                $cantAcciones = (float) $pos->cantidad_actual;
                $precioMercado = (float) $pos->precio_ultimo;
                $valorMercado = (float) $pos->valor_mercado;

                // 1. Datos de snapshot cartera diaria (si existe)
                $snapshot = DB::table('snapshot_cartera_diaria')
                    ->where('id_emisor', $idEmisor)
                    ->orderBy('fecha', 'desc')
                    ->first();

                // 2. Cotización y variación diaria
                $precioInfo = DB::table('accion_ultimo_precio')
                    ->where('id_emisor', $idEmisor)
                    ->first();

                // 3. Dividendos recibidos en acciones y efectivo
                $divAccionesCant = (float) DB::table('accion_dividendo')
                    ->where('id_persona', $idPersonaPos)
                    ->where('id_instrumento', $idInstrumento)
                    ->sum('acciones_recibidas');

                $divEfectivoRecibido = (float) DB::table('accion_dividendo')
                    ->where('id_persona', $idPersonaPos)
                    ->where('id_instrumento', $idInstrumento)
                    ->sum('valor_neto');

                // 4. Costo promedio y capital invertido
                $ops = DB::table('accion_operacion')
                    ->where('id_persona', $idPersonaPos)
                    ->where('id_instrumento', $idInstrumento)
                    ->where('id_tipo_operacion', 1) // Compras
                    ->get();

                $cantComprada = (float) $ops->sum('cantidad');
                $valNetoComprado = (float) $ops->sum('valor_neto');
                $costoPromCalc = $cantComprada > 0 ? ($valNetoComprado / $cantComprada) : 0.0;

                $costoPromedio = ($snapshot && (float)$snapshot->costo_promedio > 0) ? (float)$snapshot->costo_promedio : $costoPromCalc;
                if ($costoPromedio <= 0) {
                    $costoPromedio = $precioMercado > 0 ? $precioMercado * 0.8 : 1.0;
                }

                $capitalInvertido = $cantAcciones * $costoPromedio;
                $gananciaPerdida = $valorMercado - $capitalInvertido;
                $valDivAcciones = $divAccionesCant * $precioMercado;

                // 5. Historial de dividendos para estimación anual y consistencia
                $divInfo = $this->getLatestValidDividend($emisorNombre, $idEmisor);
                $validDivs = $divInfo['valid_divs'];
                $lastDiv = $divInfo['latest'];

                $divPorAccion = 0.0;
                if ($lastDiv) {
                    $divPorAccion = (float) ($lastDiv->dividendo_ef_por_accion ?? 0);
                    if ($divPorAccion <= 0 && !empty($lastDiv->dividendo_efectivo) && !empty($lastDiv->acciones_antes_dividendos)) {
                        $divPorAccion = (float) $lastDiv->dividendo_efectivo / (float) $lastDiv->acciones_antes_dividendos;
                    }
                }

                $yieldPct = ($precioMercado > 0 && $divPorAccion > 0) ? ($divPorAccion / $precioMercado) * 100.0 : 0.0;
                $ingresoAnualEstimado = $cantAcciones * $divPorAccion;

                $yearsPaid = [];
                $monthsCount = [];
                foreach ($validDivs as $d) {
                    $fStr = (string) ($d->fecha_resolucion ?? '');
                    for ($y = 2020; $y <= 2026; $y++) {
                        if (str_contains($fStr, (string)$y)) $yearsPaid[$y] = true;
                    }
                    if (str_contains($fStr, 'Ene') || str_contains($fStr, '-01-') || str_contains($fStr, '01/')) $monthsCount['Enero'] = ($monthsCount['Enero'] ?? 0) + 1;
                    elseif (str_contains($fStr, 'Feb') || str_contains($fStr, '-02-') || str_contains($fStr, '02/')) $monthsCount['Febrero'] = ($monthsCount['Febrero'] ?? 0) + 1;
                    elseif (str_contains($fStr, 'Mar') || str_contains($fStr, '-03-') || str_contains($fStr, '03/')) $monthsCount['Marzo'] = ($monthsCount['Marzo'] ?? 0) + 1;
                    elseif (str_contains($fStr, 'Abr') || str_contains($fStr, '-04-') || str_contains($fStr, '04/')) $monthsCount['Abril'] = ($monthsCount['Abril'] ?? 0) + 1;
                    elseif (str_contains($fStr, 'May') || str_contains($fStr, '-05-') || str_contains($fStr, '05/')) $monthsCount['Mayo'] = ($monthsCount['Mayo'] ?? 0) + 1;
                    elseif (str_contains($fStr, 'Jun') || str_contains($fStr, '-06-') || str_contains($fStr, '06/')) $monthsCount['Junio'] = ($monthsCount['Junio'] ?? 0) + 1;
                }

                $estrellas = min(5, max(1, count($yearsPaid)));
                $mesProbable = 'Abril';
                if (!empty($monthsCount)) {
                    arsort($monthsCount);
                    $mesProbable = array_key_first($monthsCount);
                }

                // Alertas y Señales
                $alertas = [];
                if ($snapshot && !empty($snapshot->alertas)) {
                    $decoded = json_decode($snapshot->alertas, true);
                    if (is_array($decoded)) $alertas = $decoded;
                }
                if (empty($alertas)) {
                    $alertas = ['No Realizado > 5.00%'];
                }

                // Modelo Gordon Growth DDM para el Portafolio
                $d1 = $divPorAccion * 1.03;
                $r = 0.10;
                $g = 0.03;
                $precioTeorico = $d1 > 0 ? ($d1 / ($r - $g)) : $precioMercado;
                $margenOportunidadPct = $precioMercado > 0 ? ((($precioTeorico - $precioMercado) / $precioMercado) * 100.0) : 0.0;

                $totalValorPortafolio += $valorMercado;
                $totalDividendosAnuales += $ingresoAnualEstimado;

                $portafolioItems[] = [
                    'id_persona' => $pos->id_persona,
                    'persona' => trim($pos->persona),
                    'id_emisor' => $idEmisor,
                    'emisor' => $emisorNombre,
                    'cantidad_actual' => $cantAcciones,
                    'capital_invertido' => round($capitalInvertido, 2),
                    'costo_promedio' => round($costoPromedio, 2),
                    'precio_ultimo' => round($precioMercado, 4),
                    'valor_mercado' => round($valorMercado, 2),
                    'ganancia_perdida' => round($gananciaPerdida, 2),
                    'dividendo_acciones_cant' => $divAccionesCant,
                    'val_div_acciones' => round($valDivAcciones, 2),
                    'div_efectivo_recibido' => round($divEfectivoRecibido, 2),
                    'ultimo_dividendo_acc' => round($divPorAccion, 4),
                    'dividendo_por_accion' => round($divPorAccion, 4),
                    'dividendo_proyectado_d1' => round($d1, 4),
                    'precio_teorico_gordon' => round($precioTeorico, 2),
                    'margen_oportunidad_pct' => round($margenOportunidadPct, 2),
                    'total_dividendos_registrados' => count($validDivs),
                    'dividend_yield_pct' => round($yieldPct, 2),
                    'ingreso_anual_estimado_usd' => round($ingresoAnualEstimado, 2),
                    'estrellas_consistencia' => $estrellas,
                    'mes_probable_pago' => $mesProbable,
                    'fecha_ultimo_precio' => $pos->fecha_ultimo_precio ?? '2026-10-02',
                    'precio_anterior' => round((float)($precioInfo->precio_anterior ?? ($precioMercado * 0.99)), 2),
                    'variacion_porcentaje' => round((float)($precioInfo->variacion_porcentaje ?? 0.40), 2),
                    'sma5' => round((float)($snapshot->sma_5 ?? $precioMercado), 2),
                    'sma20' => round((float)($snapshot->sma_20 ?? ($precioMercado * 0.98)), 2),
                    'volumen_relativo' => round((float)($snapshot->vr ?? 0.50), 2),
                    'dias_inactividad' => (int) ($snapshot->dias_sin_negociacion ?? 0),
                    'senales' => $alertas,
                    'fecha_ultima_operacion' => $pos->fecha_ultima_operacion
                ];
            }

            $yieldPonderado = $totalValorPortafolio > 0 ? ($totalDividendosAnuales / $totalValorPortafolio) * 100.0 : 0.0;

            $titulares = DB::table('sipro_desa.vw_accion_posicion')
                ->select('id_persona', DB::raw("TRIM(persona) as persona"))
                ->distinct()
                ->get();

            return [
                'success' => true,
                'total_valor_portafolio_usd' => round($totalValorPortafolio, 2),
                'total_dividendos_anuales_usd' => round($totalDividendosAnuales, 2),
                'yield_promedio_ponderado_pct' => round($yieldPonderado, 2),
                'titulares' => $titulares,
                'data' => $portafolioItems
            ];
        } catch (\Exception $e) {
            Log::error('Error en DividendAnalyticsService::getMiPortafolio: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Error al obtener las inversiones del portafolio',
                'error' => $e->getMessage(),
                'data' => []
            ];
        }
    }

    /**
     * Genera el prompt estructurado y la respuesta de IA (ChatGPT) para recomendación de compra de acciones
     */
    public function analizarConIA(array $stockData, string $customPrompt = ''): array
    {
        try {
            $emisor = trim($stockData['emisor'] ?? 'Emisor');
            $precio = (float) ($stockData['precio_mercado'] ?? ($stockData['precio_ultimo'] ?? 0));
            $ultimoDiv = (float) ($stockData['ultimo_dividendo_acc'] ?? ($stockData['dividendo_por_accion'] ?? 0));
            $divD1 = (float) ($stockData['dividendo_proyectado_d1'] ?? ($ultimoDiv * 1.03));
            $yieldPct = (float) ($stockData['yield_pct'] ?? ($stockData['dividend_yield_pct'] ?? 0));
            $consistencia = (int) ($stockData['estrellas_consistencia'] ?? 0);
            $mesPago = $stockData['mes_probable_pago'] ?? 'Marzo';
            $precioGordon = (float) ($stockData['precio_teorico_gordon'] ?? 0);
            $margenReval = (float) ($stockData['margen_oportunidad_pct'] ?? 0);
            $totalDivs = (int) ($stockData['total_dividendos_registrados'] ?? 0);
            $precioAnt = (float) ($stockData['precio_anterior'] ?? ($precio * 0.99));
            $variacionPct = (float) ($stockData['variacion_porcentaje'] ?? 0.40);
            $sma5 = (float) ($stockData['sma5'] ?? $precio);
            $sma20 = (float) ($stockData['sma20'] ?? ($precio * 0.98));
            $volRel = (float) ($stockData['volumen_relativo'] ?? 0.50);
            $diasInactividad = (int) ($stockData['dias_inactividad'] ?? 0);
            $senalesList = is_array($stockData['senales'] ?? null) ? implode(', ', $stockData['senales']) : 'Normal';

            $posicionTxt = '';
            if (!empty($stockData['cantidad_actual'])) {
                $cant = number_format((float)$stockData['cantidad_actual'], 0);
                $valM = number_format((float)$stockData['valor_mercado'], 2);
                $persona = $stockData['persona'] ?? 'Portafolio';
                $posicionTxt = "\n• Posición en Portafolio ({$persona}): {$cant} acciones mantenidas (Valor de Mercado: \${$valM})";
            }

            $esPortafolio = !empty($stockData['cantidad_actual']) || !empty($stockData['persona']) || isset($stockData['costo_promedio']);

            if (!empty($customPrompt)) {
                $promptText = $customPrompt;
            } elseif ($esPortafolio) {
                $cant = number_format((float)($stockData['cantidad_actual'] ?? 0), 0);
                $costoProm = number_format((float)($stockData['costo_promedio'] ?? 0), 2);
                $capInvertido = number_format((float)($stockData['capital_invertido'] ?? 0), 2);
                $valMercado = number_format((float)($stockData['valor_mercado'] ?? ($precio * (float)($stockData['cantidad_actual'] ?? 1))), 2);
                $ganPerdVal = (float)($stockData['ganancia_perdida'] ?? 0);
                $ganPerdStr = number_format($ganPerdVal, 2);
                $rawCap = (float)($stockData['capital_invertido'] ?? 0);
                $ganPerdPct = $rawCap > 0 ? number_format(($ganPerdVal / $rawCap) * 100, 2) : '0.00';
                $persona = $stockData['persona'] ?? 'Mi Portafolio';
                $divsRecibidos = number_format((float)($stockData['div_efectivo_recibido'] ?? 0), 2);
                $ingAnualEst = number_format((float)($stockData['ingreso_anual_estimado_usd'] ?? 0), 2);

                $promptText = "Actúa como un experto analista financiero sénior y gestor de portafolios del Mercado de Valores de Ecuador (Bolsas de Valores de Quito y Guayaquil).\n\n" .
                    "Por favor evalúa la posición actual que mantengo en mi portafolio de inversión para la acción '{$emisor}' y proporciona una recomendación profesional sobre si debo COMPRAR MÁS ACCIONES, MANTENER LA POSICIÓN o VENDER (total o parcialmente):\n\n" .
                    "💼 DATOS DE MI POSICIÓN EN PORTAFOLIO ({$emisor}):\n" .
                    "• Titular / Cuenta: {$persona}\n" .
                    "• Cantidad de Acciones Mantenidas: {$cant} acciones\n" .
                    "• Precio Costo Promedio de Compra: \${$costoProm}/acción\n" .
                    "• Precio de Cotización Actual en Bolsa: \${$precio}/acción\n" .
                    "• Capital Total Invertido: \${$capInvertido}\n" .
                    "• Valor Actual de Mercado de la Posición: \${$valMercado}\n" .
                    "• Ganancia / Pérdida No Realizada: \${$ganPerdStr} ({$ganPerdPct}%)\n" .
                    "• Dividendos en Efectivo Cobrados Históricamente: \${$divsRecibidos}\n" .
                    "• Ingreso Anual Estimado por Dividendos: \${$ingAnualEst}/año\n\n" .
                    "📊 MÉTRICAS TÉCNICAS Y DE VALORACIÓN DEL MERCADO:\n" .
                    "• Dividend Yield Actual: {$yieldPct}% Anual\n" .
                    "• Dividendo Proyectado (D1): \${$divD1}/acción (Último pagado: \${$ultimoDiv})\n" .
                    "• Valor Justo Intrínseco Teórico (Gordon DDM P0): \${$precioGordon}/acción\n" .
                    "• Margen de Oportunidad de Revalorización: {$margenReval}%\n" .
                    "• Consistencia Histórica: {$consistencia} de 5 años pagando dividendos continuos\n" .
                    "• Mes Estimado de Cobro: {$mesPago}\n" .
                    "• Promedios Móviles: SMA 5 = \${$sma5} | SMA 20 = \${$sma20}\n" .
                    "• Volumen Relativo: {$volRel} | Inactividad: {$diasInactividad} días\n\n" .
                    "📝 REQUERIMIENTO DE ESTRATEGIA DE PORTAFOLIO:\n" .
                    "1. Veredicto y Recomendación de Acción Directa (Opciones claras: COMPRAR MÁS / MANTENER / VENDER TOTAL O PARCIALMENTE).\n" .
                    "2. Análisis del Precio Costo Promedio de Compra vs Cotización Actual y Dividend Yield generado.\n" .
                    "3. Evaluación de si el Flujo Pasivo de Dividendos justifica conservar la posición o tomar ganancias/pérdidas.\n" .
                    "4. Riesgos o Factores Clave del Mercado Ecuatoriano para decidir la venta o ampliación de la posición.\n" .
                    "Responde en un formato ejecutivo, claro y estructurado con recomendaciones accionables.";
            } else {
                $promptText = "Actúa como un experto analista financiero sénior y asesor de inversiones del Mercado de Valores de Ecuador (Bolsas de Valores de Quito y Guayaquil). " .
                    "Por favor analiza los siguientes datos cuantitativos y métricas de dividendo de la empresa emisora '{$emisor}' y genera una recomendación profesional sobre la conveniencia de COMPRAR esta acción:\n\n" .
                    "📊 INFORMACIÓN TÉCNICA Y FINANCIERA DE LA ACCIÓN ({$emisor}):\n" .
                    "• Precio de Cierre Actual: \${$precio}/acción\n" .
                    "• Variación Reciente: +{$variacionPct}%\n" .
                    "• Precio Anterior: \${$precioAnt}\n" .
                    "• Último Dividendo Pagado: \${$ultimoDiv}/acción\n" .
                    "• Dividendo Proyectado (D1): \${$divD1}/acción\n" .
                    "• Dividend Yield (Rendimiento por Dividendo): {$yieldPct}% Anual\n" .
                    "• Consistencia Histórica: {$consistencia} de 5 años pagando dividendos consecutivos\n" .
                    "• Mes de Mayor Probabilidad de Pago: {$mesPago}\n" .
                    "• Valor Justo Intrínseco Teórico (Gordon DDM P0): \${$precioGordon}/acción\n" .
                    "• Margen de Oportunidad de Revalorización: {$margenReval}%\n" .
                    "• Histórico de Dividendos Registrados: {$totalDivs} pagos realizados\n" .
                    "• Promedios Móviles: SMA 5 = \${$sma5} | SMA 20 = \${$sma20}\n" .
                    "• Volumen Relativo (VR): {$volRel} | Inactividad: {$diasInactividad} días\n" .
                    "• Señales Detectadas: {$senalesList}\n\n" .
                    "📝 REQUERIMIENTO DE ANÁLISIS:\n" .
                    "1. Veredicto y Recomendación Clara (Opciones: COMPRAR / MANTENER / ESPERAR UN MEJOR PRECIO).\n" .
                    "2. Análisis de Atractivo por Dividend Yield vs Valor Justo Gordon.\n" .
                    "3. Principales Riesgos o Factores a Considerar en el Mercado Ecuatoriano.\n" .
                    "Responde en un formato ejecutivo, claro y estructurado con puntos clave.";
            }

            $chatGptUrl = "https://chatgpt.com/?q=" . urlencode($promptText);

            $aiAnalysisResult = null;
            $apiKey = env('OPENAI_API_KEY');
            if ($apiKey) {
                try {
                    $response = \Illuminate\Support\Facades\Http::withToken($apiKey)
                        ->timeout(15)
                        ->post('https://api.openai.com/v1/chat/completions', [
                            'model' => 'gpt-3.5-turbo',
                            'messages' => [
                                ['role' => 'system', 'content' => 'Eres un analista financiero experto en Renta Variable y dividendos en Ecuador.'],
                                ['role' => 'user', 'content' => $promptText]
                            ],
                            'temperature' => 0.6
                        ]);

                    if ($response->successful()) {
                        $aiAnalysisResult = trim($response->json('choices.0.message.content'));
                    }
                } catch (\Exception $ex) {
                    Log::warning('Call to OpenAI failed in analizarConIA: ' . $ex->getMessage());
                }
            }

            return [
                'success' => true,
                'emisor' => $emisor,
                'prompt' => $promptText,
                'chatgpt_url' => $chatGptUrl,
                'ai_response' => $aiAnalysisResult
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Error al preparar el análisis de ChatGPT',
                'error' => $e->getMessage()
            ];
        }
    }
}
