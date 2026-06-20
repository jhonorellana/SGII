<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\AccionDividendo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

class AccionDividendoController extends Controller
{
    /**
     * Display a listing of dividends.
     */
    public function index(Request $request)
    {
        $query = AccionDividendo::with(['persona', 'instrumento', 'tipoDividendo', 'cuentaBancaria', 'movimientoCapital'])
            ->where('activo', true)
            ->where('eliminado', false);

        if ($request->has('id_persona') && $request->id_persona) {
            $query->where('id_persona', $request->id_persona);
        }

        if ($request->has('id_instrumento') && $request->id_instrumento) {
            $query->where('id_instrumento', $request->id_instrumento);
        }

        if ($request->has('id_tipo_dividendo') && $request->id_tipo_dividendo) {
            $query->where('id_tipo_dividendo', $request->id_tipo_dividendo);
        }

        if ($request->has('fecha_desde') && $request->fecha_desde) {
            $query->where('fecha_pago', '>=', $request->fecha_desde);
        }

        if ($request->has('fecha_hasta') && $request->fecha_hasta) {
            $query->where('fecha_pago', '<=', $request->fecha_hasta);
        }

        $dividendos = $query->orderBy('fecha_pago', 'desc')
            ->orderBy('id_accion_dividendo', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $dividendos
        ], Response::HTTP_OK);
    }

    /**
     * Store a newly created dividend record.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_persona' => 'required|exists:persona,id_persona',
            'id_instrumento' => 'required|exists:instrumento,id_instrumento',
            'id_tipo_dividendo' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'fecha_declaracion' => 'nullable|date',
            'fecha_corte' => 'nullable|date',
            'fecha_pago' => 'required|date',
            'cantidad_acciones_base' => 'required|numeric|gt:0',
            'dividendo_por_accion' => 'nullable|numeric',
            'valor_bruto' => 'nullable|numeric',
            'retencion' => 'nullable|numeric',
            'valor_neto' => 'nullable|numeric',
            'acciones_recibidas' => 'nullable|numeric',
            'factor_acciones' => 'nullable|numeric',
            'precio_referencial_accion' => 'nullable|numeric',
            'valor_referencial_acciones' => 'nullable|numeric',
            'id_cuenta_bancaria' => 'nullable|exists:cuenta_bancaria,id_cuenta_bancaria',
            'observacion' => 'nullable|string|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $dividendo = AccionDividendo::create($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Dividendo registrado exitosamente',
            'data' => $dividendo->load(['persona', 'instrumento', 'tipoDividendo'])
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $dividendo = AccionDividendo::with(['persona', 'instrumento', 'tipoDividendo', 'cuentaBancaria', 'movimientoCapital'])->find($id);

        if (!$dividendo) {
            return response()->json([
                'success' => false,
                'message' => 'Dividendo no encontrado'
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'success' => true,
            'data' => $dividendo
        ], Response::HTTP_OK);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $dividendo = AccionDividendo::find($id);

        if (!$dividendo) {
            return response()->json([
                'success' => false,
                'message' => 'Dividendo no encontrado'
            ], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'id_persona' => 'required|exists:persona,id_persona',
            'id_instrumento' => 'required|exists:instrumento,id_instrumento',
            'id_tipo_dividendo' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'fecha_declaracion' => 'nullable|date',
            'fecha_corte' => 'nullable|date',
            'fecha_pago' => 'required|date',
            'cantidad_acciones_base' => 'required|numeric|gt:0',
            'dividendo_por_accion' => 'nullable|numeric',
            'valor_bruto' => 'nullable|numeric',
            'retencion' => 'nullable|numeric',
            'valor_neto' => 'nullable|numeric',
            'acciones_recibidas' => 'nullable|numeric',
            'factor_acciones' => 'nullable|numeric',
            'precio_referencial_accion' => 'nullable|numeric',
            'valor_referencial_acciones' => 'nullable|numeric',
            'id_cuenta_bancaria' => 'nullable|exists:cuenta_bancaria,id_cuenta_bancaria',
            'observacion' => 'nullable|string|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $dividendo->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Dividendo actualizado exitosamente',
            'data' => $dividendo->load(['persona', 'instrumento', 'tipoDividendo'])
        ], Response::HTTP_OK);
    }

    /**
     * Remove the specified resource (soft delete).
     */
    public function destroy($id)
    {
        $dividendo = AccionDividendo::find($id);

        if (!$dividendo) {
            return response()->json([
                'success' => false,
                'message' => 'Dividendo no encontrado'
            ], Response::HTTP_NOT_FOUND);
        }

        $dividendo->update([
            'activo' => false,
            'eliminado' => true,
            'fecha_actualizacion' => now()
        ]);

        // Disparar evento deleted manualmente en el observer ya que Eloquent soft deletes con update no disparan deleted() por defecto
        $observer = new \App\Observers\AccionDividendoObserver();
        $observer->deleted($dividendo);

        return response()->json([
            'success' => true,
            'message' => 'Dividendo eliminado exitosamente'
        ], Response::HTTP_OK);
    }
}
