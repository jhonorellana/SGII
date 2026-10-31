<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Amortizacion;
use App\Models\AmortizacionPagoHistorial;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class AmortizacionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $amortizaciones = Amortizacion::with(['inversion', 'inversion.instrumento.emisor', 'inversion.propietario', 'estadoAmortizacion'])
            ->whereHas('inversion.instrumento', function ($query) {
                $query->whereNotIn('id_tipo_inversion', [91, 203]);
            })
            ->orderBy('id_amortizacion', 'desc')
            ->get();

        return response()->json($amortizaciones, Response::HTTP_OK);
    }

    /**
     * Obtener próximas amortizaciones a vencer (optimizado para Dashboard)
     */
    public function getProximas(Request $request)
    {
        $limit = (int) $request->input('limit', 5);
        $hoy = date('Y-m-d');

        $amortizaciones = Amortizacion::with(['inversion', 'inversion.instrumento.emisor', 'inversion.propietario', 'estadoAmortizacion'])
            ->where('eliminado', 0)
            ->whereIn('id_estado_amortizacion', [134, 135, 136])
            ->where('fecha_pago', '>=', $hoy)
            ->whereHas('inversion', function ($q) {
                $q->whereNull('fecha_venta')->where('eliminado', 0);
            })
            ->whereHas('inversion.instrumento', function ($query) {
                $query->whereNotIn('id_tipo_inversion', [91, 203]);
            })
            ->orderBy('fecha_pago', 'asc')
            ->limit($limit)
            ->get();

        return response()->json($amortizaciones, Response::HTTP_OK);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_inversion' => 'required|exists:inversion,id_inversion',
            'numero_cuota' => 'nullable|integer',
            'fecha_pago' => 'required|date',
            'interes' => 'nullable|numeric',
            'capital' => 'nullable|numeric',
            'descuento' => 'nullable|numeric',
            'total' => 'nullable|numeric',
            'int_parcial' => 'nullable|numeric',
            'retencion' => 'nullable|numeric',
            'id_estado_amortizacion' => 'required|exists:catalogo_valor,id_catalogo_valor'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], Response::HTTP_BAD_REQUEST);
        }

        $amortizacion = Amortizacion::create([
            'id_inversion' => $request->id_inversion,
            'numero_cuota' => $request->numero_cuota,
            'fecha_pago' => $request->fecha_pago,
            'interes' => $request->interes,
            'capital' => $request->capital,
            'descuento' => $request->descuento,
            'total' => $request->total ?? (($request->interes ?? 0) + ($request->capital ?? 0) + ($request->descuento ?? 0)), // Calcular total si no se proporciona
            'int_parcial' => $request->int_parcial,
            'retencion' => $request->retencion,
            'id_estado_amortizacion' => $request->id_estado_amortizacion,
            'eliminado' => false,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);

        return response()->json($amortizacion->load(['inversion', 'inversion.instrumento.emisor', 'inversion.propietario', 'estadoAmortizacion']), Response::HTTP_CREATED);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $amortizacion = Amortizacion::with(['inversion', 'inversion.instrumento.emisor', 'inversion.propietario', 'estadoAmortizacion'])->find($id);

        if (!$amortizacion) {
            return response()->json(['message' => 'Amortización no encontrada'], Response::HTTP_NOT_FOUND);
        }

        return response()->json($amortizacion, Response::HTTP_OK);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $amortizacion = Amortizacion::find($id);

        if (!$amortizacion) {
            return response()->json(['message' => 'Amortización no encontrada'], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'id_inversion' => 'required|exists:inversion,id_inversion',
            'numero_cuota' => 'nullable|integer',
            'fecha_pago' => 'required|date',
            'interes' => 'nullable|numeric',
            'capital' => 'nullable|numeric',
            'descuento' => 'nullable|numeric',
            'total' => 'nullable|numeric',
            'int_parcial' => 'nullable|numeric',
            'retencion' => 'nullable|numeric',
            'id_estado_amortizacion' => 'required|exists:catalogo_valor,id_catalogo_valor'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], Response::HTTP_BAD_REQUEST);
        }

        $amortizacion->update([
            'id_inversion' => $request->id_inversion,
            'numero_cuota' => $request->numero_cuota,
            'fecha_pago' => $request->fecha_pago,
            'interes' => $request->interes,
            'capital' => $request->capital,
            'descuento' => $request->descuento,
            'total' => $request->total ?? (($request->interes ?? 0) + ($request->capital ?? 0) + ($request->descuento ?? 0)), // Calcular total si no se proporciona
            'int_parcial' => $request->int_parcial,
            'retencion' => $request->retencion,
            'id_estado_amortizacion' => $request->id_estado_amortizacion,
            'fecha_actualizacion' => now()
        ]);

        return response()->json($amortizacion->load(['inversion', 'inversion.instrumento.emisor', 'inversion.propietario', 'estadoAmortizacion']), Response::HTTP_OK);
    }

    /**
     * Remove the specified resource from storage (soft delete).
     */
    public function destroy($id)
    {
        $amortizacion = Amortizacion::find($id);

        if (!$amortizacion) {
            return response()->json(['message' => 'Amortización no encontrada'], Response::HTTP_NOT_FOUND);
        }

        $amortizacion->update([
            'id_estado_amortizacion' => 137, // Anulada
            'eliminado' => true,
            'fecha_actualizacion' => now()
        ]);

        return response()->json(['message' => 'Amortización desactivada correctamente'], Response::HTTP_OK);
    }

    /**
     * Get amortizaciones by inversion
     */
    public function getByInversion($idInversion)
    {
        $amortizaciones = Amortizacion::with(['estadoAmortizacion'])
            ->where('id_inversion', $idInversion)
            ->where('eliminado', false)
            ->orderBy('fecha_pago', 'asc')
            ->get();

        return response()->json($amortizaciones, Response::HTTP_OK);
    }

    /**
     * Desactivar amortizaciones por inversión y fecha de venta
     */
    public function desactivarPorFechaInversion(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_inversion' => 'required|exists:inversion,id_inversion',
            'fecha_venta' => 'required|date'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], Response::HTTP_BAD_REQUEST);
        }

        try {
            // Buscar todas las amortizaciones activas de la inversión con fecha_pago > fecha_venta
            $amortizaciones = Amortizacion::where('id_inversion', $request->id_inversion)
                ->where('fecha_pago', '>', $request->fecha_venta)
                ->where('activo', true)
                ->where('eliminado', false)
                ->get();

            $count = 0;

            // Actualizar cada amortización para desactivarla
            foreach ($amortizaciones as $amortizacion) {
                $amortizacion->update([
                    'activo' => false,
                    'fecha_actualizacion' => now()
                ]);
                $count++;
            }

            return response()->json([
                'success' => true,
                'message' => 'Amortizaciones actualizadas correctamente',
                'count' => $count,
                'details' => "Se desactivaron {$count} amortizaciones para la inversión {$request->id_inversion} con fecha de pago > {$request->fecha_venta}"
            ], Response::HTTP_OK);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar amortizaciones',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Registrar un pago parcial y dividir la amortización en dos:
     * 1. Cuota original actualizada con los valores pagados hoy y estado = 135 (Pagada).
     * 2. Nueva cuota con los valores restantes pendientes, fecha de compromiso y estado = 134 (Pendiente).
     */
    public function pagoParcial(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'pago_actual.fecha_pago' => 'required|date',
            'pago_actual.capital' => 'required|numeric|min:0',
            'pago_actual.interes' => 'required|numeric|min:0',
            'pago_actual.descuento' => 'nullable|numeric',
            'saldo_restante.fecha_pago' => 'required|date',
            'saldo_restante.capital' => 'required|numeric|min:0',
            'saldo_restante.interes' => 'required|numeric|min:0',
            'saldo_restante.descuento' => 'nullable|numeric',
            'observacion' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $validator->errors()
            ], Response::HTTP_BAD_REQUEST);
        }

        $amortizacionOriginal = Amortizacion::find($id);

        if (!$amortizacionOriginal || $amortizacionOriginal->eliminado) {
            return response()->json([
                'success' => false,
                'message' => 'Amortización no encontrada o eliminada'
            ], Response::HTTP_NOT_FOUND);
        }

        $pagoActual = $request->input('pago_actual');
        $saldoRestante = $request->input('saldo_restante');

        $capitalPagado = (float) $pagoActual['capital'];
        $interesPagado = (float) $pagoActual['interes'];
        $descuentoPagado = (float) ($pagoActual['descuento'] ?? 0);
        $totalPagado = round($capitalPagado + $interesPagado + $descuentoPagado, 2);

        $capitalRestante = (float) $saldoRestante['capital'];
        $interesRestante = (float) $saldoRestante['interes'];
        $descuentoRestante = (float) ($saldoRestante['descuento'] ?? 0);
        $totalRestante = round($capitalRestante + $interesRestante + $descuentoRestante, 2);

        DB::beginTransaction();
        try {
            // 1. Actualizar la cuota original con lo pagado hoy y marcarla como PAGADA (ID 135)
            $amortizacionOriginal->update([
                'fecha_pago' => $pagoActual['fecha_pago'],
                'capital' => $capitalPagado,
                'interes' => $interesPagado,
                'descuento' => $descuentoPagado,
                'total' => $totalPagado,
                'id_estado_amortizacion' => 135, // Pagada
                'fecha_actualizacion' => now()
            ]);

            // 2. Crear nueva cuota para el saldo restante con la fecha de compromiso y estado PENDIENTE (ID 134)
            $nuevaCuota = Amortizacion::create([
                'id_inversion' => $amortizacionOriginal->id_inversion,
                'numero_cuota' => $amortizacionOriginal->numero_cuota,
                'fecha_pago' => $saldoRestante['fecha_pago'],
                'capital' => $capitalRestante,
                'interes' => $interesRestante,
                'descuento' => $descuentoRestante,
                'total' => $totalRestante,
                'int_parcial' => 0,
                'retencion' => 0,
                'id_estado_amortizacion' => 134, // Pendiente de pago
                'eliminado' => false,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);

            // 3. Registrar en la bitácora histórica de pagos parciales
            $historial = AmortizacionPagoHistorial::create([
                'id_inversion' => $amortizacionOriginal->id_inversion,
                'numero_cuota' => $amortizacionOriginal->numero_cuota,
                'id_amortizacion_pagada' => $amortizacionOriginal->id_amortizacion,
                'id_amortizacion_restante' => $nuevaCuota->id_amortizacion,
                'fecha_pago' => $pagoActual['fecha_pago'],
                'capital_pagado' => $capitalPagado,
                'interes_pagado' => $interesPagado,
                'descuento_pagado' => $descuentoPagado,
                'total_pagado' => $totalPagado,
                'saldo_restante' => $totalRestante,
                'fecha_compromiso' => $saldoRestante['fecha_pago'],
                'observacion' => $request->input('observacion'),
                'id_usuario' => auth()->id() ?? $request->input('id_usuario'),
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Pago parcial registrado y cuota dividida exitosamente',
                'cuota_pagada' => $amortizacionOriginal->fresh(['inversion', 'inversion.instrumento.emisor', 'inversion.propietario', 'estadoAmortizacion']),
                'cuota_restante' => $nuevaCuota->load(['inversion', 'inversion.instrumento.emisor', 'inversion.propietario', 'estadoAmortizacion']),
                'historial' => $historial
            ], Response::HTTP_OK);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error en AmortizacionController::pagoParcial: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error al procesar el pago parcial',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Obtener el historial de pagos parciales/abonos de una amortización.
     */
    public function obtenerHistorialPagos($id)
    {
        $amortizacion = Amortizacion::find($id);
        if (!$amortizacion) {
            return response()->json([
                'success' => false,
                'message' => 'Amortización no encontrada'
            ], Response::HTTP_NOT_FOUND);
        }

        $historial = AmortizacionPagoHistorial::with(['usuario'])
            ->where(function ($q) use ($amortizacion, $id) {
                $q->where('id_amortizacion_pagada', $id)
                  ->orWhere('id_amortizacion_restante', $id);
                if ($amortizacion->numero_cuota) {
                    $q->orWhere(function ($sub) use ($amortizacion) {
                        $sub->where('id_inversion', $amortizacion->id_inversion)
                            ->where('numero_cuota', $amortizacion->numero_cuota);
                    });
                }
            })
            ->orderBy('fecha_pago', 'asc')
            ->orderBy('id_pago_historial', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $historial
        ], Response::HTTP_OK);
    }
}
