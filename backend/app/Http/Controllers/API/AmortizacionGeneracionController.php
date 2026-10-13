<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Inversion;
use App\Models\Amortizacion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Exception;

class AmortizacionGeneracionController extends Controller
{
    /**
     * Generar tabla de amortización para una inversión
     */
    public function generar(Request $request)
    {
        try {
            $request->validate([
                'id_inversion' => 'required|exists:inversion,id_inversion',
                'frecuencia_pago' => 'required|integer|min:0|max:12',
                'cuotas_diferir' => 'required|integer|min:0|max:12',
                'tipo_amortizacion' => 'required|in:A,F,V'
            ]);

            $inversion = Inversion::with(['instrumento'])->findOrFail($request->id_inversion);

            // Verificar si ya existe una tabla de amortización
            $existente = Amortizacion::where('id_inversion', $request->id_inversion)->exists();
            if ($existente) {
                return response()->json([
                    'message' => 'Ya existe una tabla de amortización para esta inversión',
                    'error' => 'TABLE_EXISTS'
                ], 422);
            }

            // Generar tabla de amortización
            $resultado = $this->generarTablaAmortizacion($inversion, $request->all());

            return response()->json([
                'message' => 'Tabla de amortización generada exitosamente',
                'data' => $resultado
            ]);

        } catch (Exception $e) {
            return response()->json([
                'message' => 'Error al generar tabla de amortización',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener parámetros para generación
     */
    public function getParametros($id_inversion)
    {
        try {
            $inversion = Inversion::with(['instrumento.tipoInversion'])->findOrFail($id_inversion);

            return response()->json([
                'data' => [
                    'id_inversion' => $inversion->id_inversion,
                    'valor_nominal' => $inversion->valor_nominal,
                    'tasa_interes' => $inversion->tasa_interes,
                    'fecha_emision' => $inversion->instrumento ? $inversion->instrumento->fecha_emision : $inversion->fecha_emision,
                    'fecha_vencimiento' => $inversion->instrumento ? $inversion->instrumento->fecha_vencimiento : $inversion->fecha_vencimiento,
                    'fecha_primer_pago' => $inversion->fecha_primer_pago,
                    'capital_invertido' => $inversion->capital_invertido,
                    'valor_interes' => $inversion->instrumento ? $inversion->instrumento->valor_interes : 0,
                    'tipo_instrumento' => $inversion->instrumento && $inversion->instrumento->tipoInversion ?
                        $inversion->instrumento->tipoInversion->descripcion : 'Desconocido',
                    'tipo_instrumento_codigo' => $inversion->instrumento && $inversion->instrumento->tipoInversion ?
                        $inversion->instrumento->tipoInversion->valor : 'N/A',
                    'fechas_recuperacion' => $inversion->instrumento ? $inversion->instrumento->fechas_recuperacion : null,
                    'interes_primer_mes' => $inversion->interes_primer_mes,
                    'interes_acumulado_previo' => $inversion->interes_acumulado_previo,
                    'fechas_pagos_capital' => $inversion->fechas_pagos_capital,
                    'fecha_compra' => $inversion->fecha_compra
                ]
            ]);

        } catch (Exception $e) {
            return response()->json([
                'message' => 'Error al obtener parámetros',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Previsualizar tabla sin guardar
     */
    public function previsualizar(Request $request)
    {
        try {
            $request->validate([
                'id_inversion' => 'required|exists:inversion,id_inversion',
                'frecuencia_pago' => 'required|integer|min:0|max:12',
                'cuotas_diferir' => 'required|integer|min:0|max:12',
                'tipo_amortizacion' => 'required|in:A,F,V'
            ]);

            $inversion = Inversion::with(['instrumento', 'instrumento.tipoInversion'])->findOrFail($request->id_inversion);
            $tabla = $this->calcularTablaAmortizacion($inversion, $request->all());

            return response()->json([
                'message' => 'Previsualización generada',
                'data' => $tabla
            ]);

        } catch (Exception $e) {
            return response()->json([
                'message' => 'Error al generar previsualización',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar tabla existente
     */
    public function eliminar($id_inversion)
    {
        try {
            $eliminados = Amortizacion::where('id_inversion', $id_inversion)->delete();

            return response()->json([
                'message' => "Se eliminaron {$eliminados} registros de amortización"
            ]);

        } catch (Exception $e) {
            return response()->json([
                'message' => 'Error al eliminar tabla',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generar y guardar tabla de amortización
     */
    private function generarTablaAmortizacion($inversion, $params)
    {
        $tabla = $this->calcularTablaAmortizacion($inversion, $params);
        $tipoAmortizacion = $params['tipo_amortizacion'];

        // Filtrar cuotas para solo incluir fechas de pago >= fecha de compra
        $fechaCompra = $inversion->fecha_compra ? new Carbon($inversion->fecha_compra) : null;
        $cuotasAGuardar = $tabla['cuotas'];
        $fechasPagosCapital = $tabla['fechas_capital'] ?? [];

        if ($fechaCompra) {
            $cuotasAGuardar = array_filter($tabla['cuotas'], function($cuota) use ($fechaCompra) {
                $fechaPago = new Carbon($cuota['fecha_pago']);
                return $fechaPago >= $fechaCompra;
            });

            // Reindexar array después del filtrado
            $cuotasAGuardar = array_values($cuotasAGuardar);

            \Log::info('Filtrando cuotas para generación', [
                'fecha_compra' => $fechaCompra->format('Y-m-d'),
                'cuotas_totales' => count($tabla['cuotas']),
                'cuotas_filtradas' => count($cuotasAGuardar),
                'cuotas_omitidas' => count($tabla['cuotas']) - count($cuotasAGuardar)
            ]);
        }

        DB::beginTransaction();
        try {
            // Calcular fecha límite para cuotas activas: último día del undécimo mes después de la fecha actual
            $fechaActual = new Carbon();
            $fechaLimiteActiva = $fechaActual->copy()->addMonths(11)->endOfMonth();

            \Log::info('Lógica de activación de cuotas', [
                'fecha_actual' => $fechaActual->format('Y-m-d'),
                'fecha_limite_activa' => $fechaLimiteActiva->format('Y-m-d')
            ]);

            foreach ($cuotasAGuardar as $cuota) {
                // Obtener el siguiente ID manualmente
                $maxId = DB::table('amortizacion')->max('id_amortizacion') ?? 0;
                $nextId = $maxId + 1;

                // Determinar si la cuota está activa basada en la fecha de pago
                $fechaPago = new Carbon($cuota['fecha_pago']);
                $esActiva = $fechaPago <= $fechaLimiteActiva;

                // Determinar el valor correcto para el campo interes
            $interesParaGuardar = $cuota['interes_parcial'];
            if (in_array($cuota['fecha_pago'], $fechasPagosCapital) && $tipoAmortizacion === 'A') {
                // En cuotas de capital, el campo interes debe ser interés normal + descuento
                $interesParaGuardar = $cuota['interes_parcial'] + $cuota['premio'];
            }

                Amortizacion::create([
                    'id_amortizacion' => $nextId,
                    'id_inversion' => $inversion->id_inversion,
                    'numero_cuota' => $cuota['numero_cuota'],
                    'fecha_pago' => $cuota['fecha_pago'],
                    'interes' => $interesParaGuardar,
                    'capital' => $cuota['capital_retorno'], // Usar capital_retorno que incluye interés acumulado previo
                    'descuento' => $cuota['premio'],
                    'total' => round($interesParaGuardar + $cuota['capital_retorno'], 2), // Total = interes + capital
                    'int_parcial' => $cuota['interes_parcial'],
                    'retencion' => 0,
                    'id_estado_amortizacion' => 134, // Pendiente de pago
                    'eliminado' => false,
                    'fecha_creacion' => now(),
                    'fecha_actualizacion' => now()
                ]);
            }

            DB::commit();

            // Calcular totales solo de las cuotas guardadas
            $totalesFiltrados = $this->calcularTotalesCuotas($cuotasAGuardar);

            return [
                'cuotas_generadas' => count($cuotasAGuardar),
                'cuotas_totales_calculadas' => count($tabla['cuotas']),
                'cuotas_omitidas' => count($tabla['cuotas']) - count($cuotasAGuardar),
                'fecha_inicio' => !empty($cuotasAGuardar) ? $cuotasAGuardar[0]['fecha_pago'] : null,
                'fecha_fin' => !empty($cuotasAGuardar) ? end($cuotasAGuardar)['fecha_pago'] : null,
                'total_intereses' => $totalesFiltrados['total_intereses'],
                'total_capital' => $totalesFiltrados['total_capital'],
                'total_descuento' => $totalesFiltrados['total_descuento']
            ];

        } catch (Exception $e) {
            DB::rollback();
            throw $e;
        }
    }

    /**
     * Calcular totales de un conjunto de cuotas
     */
    private function calcularTotalesCuotas($cuotas)
    {
        $totalIntereses = array_sum(array_column($cuotas, 'interes_parcial'));
        $totalCapital = array_sum(array_column($cuotas, 'capital_retorno')); // Usar capital_retorno
        $totalDescuento = array_sum(array_column($cuotas, 'premio'));

        return [
            'total_intereses' => round($totalIntereses, 2),
            'total_capital' => round($totalCapital, 2),
            'total_descuento' => round($totalDescuento, 2)
        ];
    }

    /**
     * Calcular tabla de amortización (lógica principal)
     */
    private function calcularTablaAmortizacion($inversion, $params)
    {
        $frecuenciaPago = $params['frecuencia_pago'];
        $cuotasDiferir = $params['cuotas_diferir'];
        $tipoAmortizacion = $params['tipo_amortizacion'];

        // Datos de la inversión
        $principal = $inversion->valor_nominal;
        $tasaAnual = $inversion->tasa_interes;
        $capitalInvertido = $inversion->capital_invertido;

        // Validar datos básicos (más permisivo para pruebas)
        if (is_null($principal) || $principal <= 0) {
            // Usar capital_invertido como fallback para pruebas
            if (!is_null($capitalInvertido) && $capitalInvertido > 0) {
                $principal = $capitalInvertido;
                \Log::warning('Valor nominal nulo, usando capital_invertido como fallback', [
                    'id_inversion' => $inversion->id_inversion,
                    'valor_nominal_original' => $inversion->valor_nominal,
                    'principal_usado' => $principal
                ]);
            } else {
                return response()->json([
                    'message' => 'Error al generar previsualización',
                    'error' => 'No se puede generar la tabla sin un valor nominal válido o capital invertido. Valor nominal: ' . $principal . ', Capital invertido: ' . $capitalInvertido
                ], 400);
            }
        }

        if (is_null($capitalInvertido) || $capitalInvertido <= 0) {
            return response()->json([
                'message' => 'Error al generar previsualización',
                'error' => 'El capital invertido es inválido o nulo. Valor: ' . $capitalInvertido . '. Por favor, verifique que la inversión tenga un capital invertido válido.'
            ], 400);
        }

        // Datos del instrumento (con fallback a inversión si no hay instrumento)
        $instrumento = $inversion->instrumento;
        $valorInteres = $instrumento ? $instrumento->valor_interes : ($inversion->interes_mensual ?? 0);
        $montoPagado = $capitalInvertido - $valorInteres;

        // Fechas desde instrumento (con fallback)
        $fechaEmision = $instrumento ? Carbon::parse($instrumento->fecha_emision) : Carbon::parse($inversion->fecha_emision);
        $fechaVencimiento = $instrumento ? Carbon::parse($instrumento->fecha_vencimiento) : Carbon::parse($inversion->fecha_vencimiento);
        $fechaPrimerPago = $inversion->fecha_primer_pago ? Carbon::parse($inversion->fecha_primer_pago) : null;

        // Valores especiales para primera cuota
        $primerMesInteres = $inversion->interes_primer_mes ?? 0;
        $interesAcumuladoPrevio = $inversion->interes_acumulado_previo ?? 0;

        // Fechas específicas de pago de capital desde instrumento
        $fechasPagosCapital = [];
        if ($instrumento && $instrumento->fechas_recuperacion) {
            // Parsear fechas de recuperación del instrumento (formato CSV)
            $fechasArray = explode(',', $instrumento->fechas_recuperacion);
            foreach ($fechasArray as $fecha) {
                $fechaTrim = trim($fecha);
                if (!empty($fechaTrim)) {
                    $fechasPagosCapital[] = Carbon::parse($fechaTrim);
                }
            }
            \Log::info('Fechas de recuperación del instrumento:', [
                'fechas_recuperacion_raw' => $instrumento->fechas_recuperacion,
                'fechas_parseadas' => array_map(fn($f) => $f->format('Y-m-d'), $fechasPagosCapital)
            ]);
        } else {
            // Fallback: usar fechas generadas si no hay fechas de recuperación
            if ($inversion->fechas_pagos_capital) {
                $fechasArray = explode(',', $inversion->fechas_pagos_capital);
                foreach ($fechasArray as $fecha) {
                    $fechasPagosCapital[] = Carbon::parse(trim($fecha));
                }
            }
        }

        // Caso especial: Amortización Al Vencimiento (Pago Único / Papel Comercial / Bullet)
        if ($frecuenciaPago == 0 || $tipoAmortizacion === 'V') {
            $fechaPagoUnica = !empty($fechasPagosCapital) ? $fechasPagosCapital[0] : $fechaVencimiento;

            $capitalRetorno = $capitalInvertido;
            $capitalDevueltoCuota = $capitalInvertido;

            if ($principal > $capitalInvertido) {
                // Comprado a descuento (caso estándar de papel comercial)
                $interesCuota = round($principal - $capitalInvertido, 2);
            } else {
                // Comprado a la par o rendimiento sobre nominal: calcular según tasa anual y plazo
                $dias = $fechaEmision->diffInDays($fechaPagoUnica);
                $interesCuota = round($principal * ($tasaAnual / 100) * ($dias / 360), 2);
            }

            $premio = 0.00;
            $flujo = round($capitalRetorno + $interesCuota, 2);

            $cuotas = [
                [
                    'numero_cuota' => 1,
                    'fecha_pago' => $fechaPagoUnica->format('Y-m-d'),
                    'capital_restante' => round($principal, 2),
                    'capital_retorno' => round($capitalRetorno, 2),
                    'capital_devuelto' => round($capitalDevueltoCuota, 2),
                    'interes_parcial' => round($interesCuota, 2),
                    'premio' => 0.00,
                    'interes_total' => round($interesCuota, 2),
                    'flujo' => round($flujo, 2),
                    'tiene_interes_acumulado_previo' => false,
                    'interes_acumulado_previo_aplicado' => 0
                ]
            ];

            return [
                'cuotas' => $cuotas,
                'fechas_capital' => [$fechaPagoUnica->format('Y-m-d')],
                'fecha_inicio' => $fechaPagoUnica->format('Y-m-d'),
                'fecha_fin' => $fechaPagoUnica->format('Y-m-d'),
                'total_intereses' => round($interesCuota, 2),
                'total_capital' => round($capitalRetorno, 2),
                'total_descuento' => 0.00
            ];
        }

        // Calcular fechas de pago
        \Log::info('Generando fechas de pago', [
            'fechaEmision' => $fechaEmision->format('Y-m-d'),
            'fechaVencimiento' => $fechaVencimiento->format('Y-m-d'),
            'frecuenciaPago' => $frecuenciaPago
        ]);

        $fechasPago = $this->generarFechasPago($fechaEmision, $fechaVencimiento, $frecuenciaPago);

        \Log::info('Fechas de pago generadas', [
            'totalFechas' => count($fechasPago),
            'fechas' => array_map(fn($f) => $f->format('Y-m-d'), $fechasPago)
        ]);

        // Determinar fechas de pago de capital
        if (empty($fechasPagosCapital)) {
            // Si no hay fechas de recuperación específicas, usar fechas generadas
            \Log::warning('No hay fechas de recuperación específicas, usando fechas generadas');
            $fechasPago = $this->generarFechasPago($fechaEmision, $fechaVencimiento, $frecuenciaPago);
            $fechasPagosCapital = array_slice($fechasPago, $cuotasDiferir);
        } else {
            // Usar fechas de recuperación del instrumento
            \Log::info('Usando fechas de recuperación del instrumento:', [
                'total_fechas' => count($fechasPagosCapital),
                'cuotas_diferir' => $cuotasDiferir
            ]);

            // Aplicar cuotas diferidas si es necesario
            if ($cuotasDiferir > 0 && count($fechasPagosCapital) > $cuotasDiferir) {
                $fechasPagosCapital = array_slice($fechasPagosCapital, $cuotasDiferir);
            }
        }

        // Filtrar fechas de capital vigentes para la inversión (>= fecha_compra)
        $fechaCompra = $inversion->fecha_compra ? Carbon::parse($inversion->fecha_compra) : null;
        $fechasCapitalVigentes = [];
        foreach ($fechasPagosCapital as $fc) {
            if (!$fechaCompra || $fc >= $fechaCompra) {
                $fechasCapitalVigentes[] = $fc;
            }
        }

        $numCuotasCapital = count($fechasCapitalVigentes) > 0 ? count($fechasCapitalVigentes) : count($fechasPagosCapital);

        // Validar que tengamos cuotas de capital para evitar división por cero
        if ($numCuotasCapital <= 0) {
            throw new Exception('No se encontraron fechas válidas para el pago de capital. Verifique las fechas de emisión y vencimiento.');
        }

        \Log::info('Configuración de capital:', [
            'num_cuotas_capital' => $numCuotasCapital,
            'fechas_capital_vigentes' => array_map(fn($f) => $f->format('Y-m-d'), $fechasCapitalVigentes),
            'principal' => $principal,
            'montoPagado' => $montoPagado
        ]);

        $tasaMensual = $tasaAnual / 100 / 12 * $frecuenciaPago;

        // Calcular montos
        $montoAmortizacion = round($principal / $numCuotasCapital, 2);
        $capitalDevuelto = round($montoPagado / $numCuotasCapital, 2);

        // Premio / Descuento: solo aplica si se adquirió con descuento (bajo la par: principal > montoPagado)
        $premio = 0.00;
        if ($principal > $montoPagado) {
            $premio = round($montoAmortizacion - $capitalDevuelto, 2);
        } else {
            $capitalDevuelto = $montoAmortizacion;
            $premio = 0.00;
        }

        // Para amortización francesa
        $cuotaFija = 0;
        if ($tipoAmortizacion === 'F') {
            $cuotaFija = ($principal * $tasaMensual * pow(1 + $tasaMensual, $numCuotasCapital)) /
                        (pow(1 + $tasaMensual, $numCuotasCapital) - 1);
        }

        $cuotas = [];
        $capitalRestante = $principal;
        $capitalAcumulado = 0;
        $capitalDevueltoAcumulado = 0;
        $primeraCuotaVigenteEncontrada = false;

        $fechasCapVigentesStr = array_map(fn($f) => $f->format('Y-m-d'), $fechasCapitalVigentes);

        foreach ($fechasPago as $idx => $fecha) {
            $nroCupon = $idx + 1;
            $fechaStr = $fecha->format('Y-m-d');

            // Filtrar: solo cuotas vigentes para la inversión (>= fecha_compra)
            if ($fechaCompra && $fecha < $fechaCompra) {
                continue;
            }

            $esPagoCapital = in_array($fechaStr, $fechasCapVigentesStr);

            $interesNormal = round($capitalRestante * $tasaMensual, 2);
            $interesParcial = $interesNormal;

            $capitalRetornoCuota = 0;
            $capitalDevueltoCuota = 0;
            $premioCuota = 0;

            if ($esPagoCapital) {
                if ($tipoAmortizacion === 'A') {
                    // Amortización alemana
                    $isLastCapital = ($fechaStr === end($fechasCapVigentesStr) || ($capitalAcumulado + $montoAmortizacion >= $principal));

                    if ($isLastCapital) {
                        $capitalRetornoCuota = round($principal - $capitalAcumulado, 2);
                        $capitalDevueltoCuota = round($montoPagado - $capitalDevueltoAcumulado, 2);
                        if ($premio > 0) {
                            $premioCuota = round($capitalRetornoCuota - $capitalDevueltoCuota, 2);
                        } else {
                            $capitalDevueltoCuota = $capitalRetornoCuota;
                            $premioCuota = 0.00;
                        }
                    } else {
                        $capitalRetornoCuota = $montoAmortizacion;
                        $capitalDevueltoCuota = $capitalDevuelto;
                        $premioCuota = $premio;
                    }

                    $capitalAcumulado += $capitalRetornoCuota;
                    $capitalDevueltoAcumulado += $capitalDevueltoCuota;
                    $capitalRestante -= $capitalRetornoCuota;
                } else {
                    // Amortización francesa
                    $capitalRetornoCuota = $cuotaFija - $interesParcial;
                    $capitalRestante -= $capitalRetornoCuota;
                    $capitalRetornoCuota = round($capitalRetornoCuota, 2);
                    $capitalEquivalente = round($capitalDevuelto * $capitalRetornoCuota / $montoAmortizacion, 2);
                    $capitalDevueltoCuota = $capitalEquivalente;
                    $premioCuota = round($capitalRetornoCuota - $capitalEquivalente, 2);
                }
            }

            // Lógica de interés acumulado previo en la primera cuota vigente
            $esPrimeraCuota = false;
            $interesPrevioAplicado = 0;

            if (!$primeraCuotaVigenteEncontrada) {
                $primeraCuotaVigenteEncontrada = true;
                $esPrimeraCuota = true;

                if ($interesAcumuladoPrevio > 0) {
                    $interesParcialAjustado = max(0, round($interesParcial - $interesAcumuladoPrevio, 2));
                    $capitalRetornoCuota = round($capitalRetornoCuota + $interesAcumuladoPrevio, 2);
                    $capitalDevueltoCuota = round($capitalDevueltoCuota + $interesAcumuladoPrevio, 2);
                    $interesParcial = $interesParcialAjustado;
                    $interesPrevioAplicado = $interesAcumuladoPrevio;

                    \Log::info('Ajuste por interés acumulado previo en primera cuota vigente:', [
                        'numero_cuota' => $nroCupon,
                        'fecha_pago' => $fechaStr,
                        'interes_normal' => $interesNormal,
                        'interes_acumulado_previo' => $interesAcumuladoPrevio,
                        'interes_parcial_ajustado' => $interesParcial,
                        'capital_retorno_ajustado' => $capitalRetornoCuota
                    ]);
                }
            }

            // En cuotas de capital con amortización alemana, interes incluye premio
            $interesParaGuardar = $interesParcial + $premioCuota;
            $flujo = round($interesParcial + $capitalDevueltoCuota + $premioCuota, 2);

            $cuotas[] = [
                'numero_cuota' => $nroCupon,
                'fecha_pago' => $fechaStr,
                'capital_restante' => round($capitalRestante + ($esPagoCapital ? $capitalRetornoCuota : 0), 2),
                'capital_retorno' => round($capitalRetornoCuota, 2),
                'capital_devuelto' => round($capitalDevueltoCuota, 2),
                'interes_parcial' => round($interesParcial, 2),
                'premio' => round($premioCuota, 2),
                'interes_total' => round($interesParaGuardar + $capitalRetornoCuota, 2),
                'flujo' => round($flujo, 2),
                'tiene_interes_acumulado_previo' => $interesPrevioAplicado > 0,
                'interes_acumulado_previo_aplicado' => $interesPrevioAplicado
            ];
        }

        // Calcular totales
        $totalIntereses = array_sum(array_column($cuotas, 'interes_parcial'));
        $totalCapital = array_sum(array_column($cuotas, 'capital_retorno'));
        $totalDescuento = array_sum(array_column($cuotas, 'premio'));

        return [
            'cuotas' => $cuotas,
            'fechas_capital' => $fechasCapVigentesStr,
            'fecha_inicio' => !empty($cuotas) ? $cuotas[0]['fecha_pago'] : null,
            'fecha_fin' => !empty($cuotas) ? end($cuotas)['fecha_pago'] : null,
            'total_intereses' => round($totalIntereses, 2),
            'total_capital' => round($totalCapital, 2),
            'total_descuento' => round($totalDescuento, 2)
        ];
    }

    /**
     * Generar fechas de pago según frecuencia
     */
    private function generarFechasPago($fechaInicio, $fechaFin, $frecuencia)
    {
        $fechas = [];
        $fechaActual = $fechaInicio->copy()->addMonths($frecuencia);

        while ($fechaActual <= $fechaFin) {
            $fechas[] = $fechaActual->copy();
            $fechaActual->addMonths($frecuencia);
        }

        return $fechas;
    }
}
