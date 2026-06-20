<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\AccionOperacion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

class AccionOperacionController extends Controller
{
    /**
     * Display a listing of stock operations.
     */
    public function index(Request $request)
    {
        $query = AccionOperacion::with(['instrumento', 'persona', 'tipoOperacion', 'inversion', 'movimientoCapital'])
            ->where('activo', true)
            ->where('eliminado', false);

        if ($request->has('id_persona') && $request->id_persona) {
            $query->where('id_persona', $request->id_persona);
        }

        if ($request->has('id_instrumento') && $request->id_instrumento) {
            $query->where('id_instrumento', $request->id_instrumento);
        }

        if ($request->has('id_emisor') && $request->id_emisor) {
            $query->whereHas('instrumento', function ($q) use ($request) {
                $q->where('id_emisor', $request->id_emisor);
            });
        }

        if ($request->has('id_tipo_operacion') && $request->id_tipo_operacion) {
            $query->where('id_tipo_operacion', $request->id_tipo_operacion);
        }

        if ($request->has('fecha_desde') && $request->fecha_desde) {
            $query->where('fecha_operacion', '>=', $request->fecha_desde);
        }

        if ($request->has('fecha_hasta') && $request->fecha_hasta) {
            $query->where('fecha_operacion', '<=', $request->fecha_hasta);
        }

        $operaciones = $query->orderBy('fecha_operacion', 'desc')
            ->orderBy('id_accion_operacion', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $operaciones
        ], Response::HTTP_OK);
    }

    /**
     * Store a newly created stock operation.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_instrumento' => 'required|exists:instrumento,id_instrumento',
            'id_persona' => 'required|exists:persona,id_persona',
            'id_tipo_operacion' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'fecha_operacion' => 'required|date',
            'cantidad' => 'required|numeric|gt:0',
            'precio_unitario' => 'required|numeric|gte:0',
            'valor_bruto' => 'required|numeric',
            'comision_bolsa' => 'nullable|numeric',
            'comision_operador' => 'nullable|numeric',
            'total_comisiones' => 'nullable|numeric',
            'valor_neto' => 'required|numeric',
            'costo_promedio_unitario' => 'nullable|numeric',
            'utilidad_perdida' => 'nullable|numeric',
            'observacion' => 'nullable|string|max:500',
            'id_inversion' => 'nullable|exists:inversion,id_inversion',
            'liquidacion' => 'nullable|string|max:50'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $tipoOp = (int)$request->id_tipo_operacion;

        // Validar cantidad disponible para Ventas (205) o Ajustes Negativos (208)
        if ($tipoOp === 205 || $tipoOp === 208) {
            $posicion = DB::table('vw_accion_posicion')
                ->where('id_persona', $request->id_persona)
                ->where('id_instrumento', $request->id_instrumento)
                ->first();

            $cantidadDisponible = $posicion ? (float)$posicion->cantidad_actual : 0.0;

            if ($cantidadDisponible < (float)$request->cantidad) {
                return response()->json([
                    'success' => false,
                    'message' => 'La cantidad a vender/ajustar (' . number_format($request->cantidad, 2) . ') supera la cantidad de acciones disponibles (' . number_format($cantidadDisponible, 2) . ') para este socio.'
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        $operacion = AccionOperacion::create($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Operación registrada exitosamente',
            'data' => $operacion->load(['instrumento', 'persona', 'tipoOperacion'])
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $operacion = AccionOperacion::with(['instrumento', 'persona', 'tipoOperacion', 'inversion', 'movimientoCapital'])->find($id);

        if (!$operacion) {
            return response()->json([
                'success' => false,
                'message' => 'Operación no encontrada'
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'success' => true,
            'data' => $operacion
        ], Response::HTTP_OK);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $operacion = AccionOperacion::find($id);

        if (!$operacion) {
            return response()->json([
                'success' => false,
                'message' => 'Operación no encontrada'
            ], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'id_instrumento' => 'required|exists:instrumento,id_instrumento',
            'id_persona' => 'required|exists:persona,id_persona',
            'id_tipo_operacion' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'fecha_operacion' => 'required|date',
            'cantidad' => 'required|numeric|gt:0',
            'precio_unitario' => 'required|numeric|gte:0',
            'valor_bruto' => 'required|numeric',
            'comision_bolsa' => 'nullable|numeric',
            'comision_operador' => 'nullable|numeric',
            'total_comisiones' => 'nullable|numeric',
            'valor_neto' => 'required|numeric',
            'costo_promedio_unitario' => 'nullable|numeric',
            'utilidad_perdida' => 'nullable|numeric',
            'observacion' => 'nullable|string|max:500',
            'id_inversion' => 'nullable|exists:inversion,id_inversion',
            'liquidacion' => 'nullable|string|max:50'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $tipoOp = (int)$request->id_tipo_operacion;

        // Validar cantidad disponible para Ventas (205) o Ajustes Negativos (208)
        if ($tipoOp === 205 || $tipoOp === 208) {
            $posicion = DB::table('vw_accion_posicion')
                ->where('id_persona', $request->id_persona)
                ->where('id_instrumento', $request->id_instrumento)
                ->first();

            // Sumar la cantidad de la propia operación para calcular el stock real disponible para cambio
            $cantidadOriginal = 0.0;
            if ((int)$operacion->id_tipo_operacion === 205 || (int)$operacion->id_tipo_operacion === 208) {
                $cantidadOriginal = (float)$operacion->cantidad;
            }

            $cantidadDisponible = ($posicion ? (float)$posicion->cantidad_actual : 0.0) + $cantidadOriginal;

            if ($cantidadDisponible < (float)$request->cantidad) {
                return response()->json([
                    'success' => false,
                    'message' => 'La cantidad a vender/ajustar (' . number_format($request->cantidad, 2) . ') supera la cantidad de acciones disponibles (' . number_format($cantidadDisponible, 2) . ') para este socio.'
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        $operacion->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Operación actualizada exitosamente',
            'data' => $operacion->load(['instrumento', 'persona', 'tipoOperacion'])
        ], Response::HTTP_OK);
    }

    /**
     * Remove the specified resource (soft delete).
     */
    public function destroy($id)
    {
        $operacion = AccionOperacion::find($id);

        if (!$operacion) {
            return response()->json([
                'success' => false,
                'message' => 'Operación no encontrada'
            ], Response::HTTP_NOT_FOUND);
        }

        // Si es una compra, validar que al revertirla/eliminarla no deje la cantidad neta en negativo
        if ((int)$operacion->id_tipo_operacion === 204 || (int)$operacion->id_tipo_operacion === 206 || (int)$operacion->id_tipo_operacion === 207 || (int)$operacion->id_tipo_operacion === 212) {
            $posicion = DB::table('vw_accion_posicion')
                ->where('id_persona', $operacion->id_persona)
                ->where('id_instrumento', $operacion->id_instrumento)
                ->first();

            $cantidadActual = $posicion ? (float)$posicion->cantidad_actual : 0.0;

            if ($cantidadActual < (float)$operacion->cantidad) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede eliminar esta operación de adquisición porque dejaría la posición de acciones del socio en negativo (Cantidad actual: ' . number_format($cantidadActual, 2) . ').'
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        $operacion->update([
            'activo' => false,
            'eliminado' => true,
            'fecha_actualizacion' => now()
        ]);

        // Disparar evento deleted manualmente en el observer ya que Eloquent soft deletes con update no disparan deleted() por defecto
        $observer = new \App\Observers\AccionOperacionObserver();
        $observer->deleted($operacion);

        return response()->json([
            'success' => true,
            'message' => 'Operación eliminada exitosamente'
        ], Response::HTTP_OK);
    }
}
