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
        $amortizaciones = Amortizacion::with(['inversion', 'inversion.instrumento', 'inversion.propietario', 'estadoAmortizacion'])
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
            'id_estado_amortizacion' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'pagada' => 'boolean',
            'activo' => 'boolean'
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
            'total' => $request->total,
            'int_parcial' => $request->int_parcial,
            'retencion' => $request->retencion,
            'id_estado_amortizacion' => $request->id_estado_amortizacion,
            'pagada' => $request->has('pagada') ? $request->pagada : false,
            'activo' => $request->has('activo') ? $request->activo : true,
            'eliminado' => false,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);

        return response()->json($amortizacion->load(['inversion', 'inversion.instrumento', 'inversion.propietario', 'estadoAmortizacion']), Response::HTTP_CREATED);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $amortizacion = Amortizacion::with(['inversion', 'inversion.instrumento', 'inversion.propietario', 'estadoAmortizacion'])->find($id);

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
            'id_estado_amortizacion' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'pagada' => 'boolean',
            'activo' => 'boolean'
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
            'total' => $request->total,
            'int_parcial' => $request->int_parcial,
            'retencion' => $request->retencion,
            'id_estado_amortizacion' => $request->id_estado_amortizacion,
            'pagada' => $request->has('pagada') ? $request->pagada : $amortizacion->pagada,
            'activo' => $request->has('activo') ? $request->activo : $amortizacion->activo,
            'fecha_actualizacion' => now()
        ]);

        return response()->json($amortizacion->load(['inversion', 'inversion.instrumento', 'inversion.propietario', 'estadoAmortizacion']), Response::HTTP_OK);
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
            'activo' => false,
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
            ->where('activo', true)
            ->where('eliminado', false)
            ->orderBy('numero_cuota', 'asc')
            ->get();

        return response()->json($amortizaciones, Response::HTTP_OK);
    }
}
