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
                'frecuencia_pago' => 'required|integer|min:1|max:12',
                'cuotas_diferir' => 'required|integer|min:0|max:12',
                'tipo_amortizacion' => 'required|in:A,F'
            ]);

            $inversion = Inversion::with(['instrumento', 'emisor'])->findOrFail($request->id_inversion);

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
                'frecuencia_pago' => 'required|integer|min:1|max:12',
                'cuotas_diferir' => 'required|integer|min:0|max:12',
                'tipo_amortizacion' => 'required|in:A,F'
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

        DB::beginTransaction();
        try {
            foreach ($tabla['cuotas'] as $cuota) {
                Amortizacion::create([
                    'id_inversion' => $inversion->id_inversion,
                    'numero_cuota' => $cuota['numero_cuota'],
                    'fecha_pago' => $cuota['fecha_pago'],
                    'interes' => $cuota['interes_parcial'],
                    'capital' => $cuota['capital_devuelto'],
                    'descuento' => $cuota['premio'],
                    'total' => $cuota['interes_total'],
                    'int_parcial' => $cuota['interes_parcial'],
                    'retencion' => 0,
                    'id_estado_amortizacion' => 1, // Pendiente
                    'pagada' => false,
                    'activo' => true,
                    'eliminado' => false,
                    'fecha_creacion' => now(),
                    'fecha_actualizacion' => now()
                ]);
            }

            DB::commit();

            return [
                'cuotas_generadas' => count($tabla['cuotas']),
                'fecha_inicio' => $tabla['fecha_inicio'],
                'fecha_fin' => $tabla['fecha_fin'],
                'total_intereses' => $tabla['total_intereses'],
                'total_capital' => $tabla['total_capital'],
                'total_descuento' => $tabla['total_descuento']
            ];

        } catch (Exception $e) {
            DB::rollback();
            throw $e;
        }
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

        $numCuotasCapital = count($fechasPagosCapital);

        // Validar que tengamos cuotas de capital para evitar división por cero
        if ($numCuotasCapital <= 0) {
            throw new Exception('No se encontraron fechas válidas para el pago de capital. Verifique las fechas de emisión y vencimiento.');
        }

        \Log::info('Configuración de capital:', [
            'num_cuotas_capital' => $numCuotasCapital,
            'fechas_capital' => array_map(fn($f) => $f->format('Y-m-d'), $fechasPagosCapital),
            'principal' => $principal,
            'montoPagado' => $montoPagado
        ]);

        $tasaMensual = $tasaAnual / 100 / 12 * $frecuenciaPago;

        // Calcular montos
        $montoAmortizacion = round($principal / $numCuotasCapital, 2);
        $capitalDevuelto = round($montoPagado / $numCuotasCapital, 2);

        // Para amortización francesa
        $cuotaFija = 0;
        if ($tipoAmortizacion === 'F') {
            $cuotaFija = ($principal * $tasaMensual * pow(1 + $tasaMensual, $numCuotasCapital)) /
                        (pow(1 + $tasaMensual, $numCuotasCapital) - 1);
        }

        $cuotas = [];
        $capitalRestante = $principal;
        $numeroCuota = 1;

        foreach ($fechasPago as $fecha) {
            $interesParcial = $capitalRestante * $tasaMensual;
            $interesParcial = round($interesParcial, 2);

            $capitalRetorno = 0;
            $capitalDevueltoCuota = 0;
            $premio = 0;

            if (in_array($fecha, $fechasPagosCapital)) {
                if ($tipoAmortizacion === 'A') {
                    // Amortización alemana
                    $capitalRestante -= $montoAmortizacion;
                    $capitalRetorno = $montoAmortizacion;
                    $capitalDevueltoCuota = $capitalDevuelto;
                    $premio = round($capitalRetorno - $capitalDevueltoCuota, 2);
                } else {
                    // Amortización francesa
                    $capitalRetornoCuota = $cuotaFija - $interesParcial;
                    $capitalRestante -= $capitalRetornoCuota;
                    $capitalRetorno = round($capitalRetornoCuota, 2);
                    $capitalEquivalente = round($capitalDevuelto * $capitalRetornoCuota / $montoAmortizacion, 2);
                    $capitalDevueltoCuota = $capitalEquivalente;
                    $premio = round($capitalRetorno - $capitalEquivalente, 2);
                }
            }

            // Ajustar primera cuota con valores de BD
            if ($numeroCuota === 1 && $fechaPrimerPago && $fecha >= $fechaPrimerPago) {
                $capitalDevueltoCuota = $interesAcumuladoPrevio;
                $interesParcial = $primerMesInteres;
                $premio = 0;
            }

            $interesTotal = $interesParcial + $premio;

            $cuotas[] = [
                'numero_cuota' => $numeroCuota,
                'fecha_pago' => $fecha->format('Y-m-d'),
                'capital_restante' => round($capitalRestante, 2),
                'capital_retorno' => $capitalRetorno,
                'capital_devuelto' => $capitalDevueltoCuota,
                'interes_parcial' => $interesParcial,
                'premio' => $premio,
                'interes_total' => round($interesTotal, 2),
                'flujo' => round($interesParcial + $capitalDevueltoCuota + $premio, 2)
            ];

            $numeroCuota++;
        }

        // Calcular totales
        $totalIntereses = array_sum(array_column($cuotas, 'interes_parcial'));
        $totalCapital = array_sum(array_column($cuotas, 'capital_devuelto'));
        $totalDescuento = array_sum(array_column($cuotas, 'premio'));

        return [
            'cuotas' => $cuotas,
            'fecha_inicio' => $fechasPago[0]->format('Y-m-d'),
            'fecha_fin' => end($fechasPago)->format('Y-m-d'),
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
