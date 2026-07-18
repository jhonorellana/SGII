<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Amortizacion;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
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
}
