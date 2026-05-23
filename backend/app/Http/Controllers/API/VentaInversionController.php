<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\VentaInversion;
use App\Models\Inversion;
use App\Models\MovimientoCapital;
use App\Events\VentaInversionRegistrada;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class VentaInversionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = VentaInversion::with(['inversion', 'instrumento', 'tipoVenta'])
            ->where('eliminado', false);

        // Filtros
        if ($request->has('id_inversion') && $request->id_inversion) {
            $query->where('id_inversion', $request->id_inversion);
        }
        if ($request->has('fecha_desde') && $request->fecha_desde) {
            $query->where('fecha_venta', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta') && $request->fecha_hasta) {
            $query->where('fecha_venta', '<=', $request->fecha_hasta);
        }

        $ventas = $query->orderBy('fecha_venta', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $ventas
        ], Response::HTTP_OK);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_inversion' => 'required|exists:inversion,id_inversion',
            'id_instrumento' => 'nullable|exists:instrumento,id_instrumento',
            'id_tipo_venta' => 'nullable|exists:catalogo_valor,id_catalogo_valor',
            'porcentaje_vendido' => 'nullable|numeric',
            'fecha_venta' => 'required|date',
            'liquidacion_venta' => 'nullable|string|max:50',
            'precio_venta' => 'nullable|numeric',
            'precio_neto_venta' => 'nullable|numeric',
            'interes_previo_venta' => 'nullable|numeric',
            'valor_venta_sin_comision' => 'nullable|numeric',
            'comision_operador' => 'nullable|numeric',
            'comision_bolsa' => 'nullable|numeric',
            'valor_venta_con_comision' => 'nullable|numeric',
            'utilidad_sin_comision' => 'nullable|numeric',
            'utilidad_con_comision' => 'nullable|numeric',
            'ganancia_perdida' => 'nullable|numeric',
            'rendimiento_total' => 'nullable|numeric',
            'dias_transcurridos' => 'nullable|numeric',
            'roi' => 'nullable|numeric',
            'ganancia_anual' => 'nullable|numeric',
            'comisiones_santa_fe' => 'nullable|numeric',
            'retenciones' => 'nullable|numeric',
            'observacion' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], Response::HTTP_BAD_REQUEST);
        }

        DB::beginTransaction();
        try {
            $venta = VentaInversion::create([
                'id_inversion' => $request->id_inversion,
                'id_instrumento' => $request->id_instrumento,
                'id_tipo_venta' => $request->id_tipo_venta,
                'porcentaje_vendido' => $request->porcentaje_vendido ?? 0,
                'fecha_venta' => $request->fecha_venta,
                'liquidacion_venta' => $request->liquidacion_venta,
                'precio_venta' => $request->precio_venta ?? 0,
                'precio_neto_venta' => $request->precio_neto_venta ?? 0,
                'interes_previo_venta' => $request->interes_previo_venta ?? 0,
                'valor_venta_sin_comision' => $request->valor_venta_sin_comision ?? 0,
                'comision_operador' => $request->comision_operador ?? 0,
                'comision_bolsa' => $request->comision_bolsa ?? 0,
                'valor_venta_con_comision' => $request->valor_venta_con_comision ?? 0,
                'utilidad_sin_comision' => $request->utilidad_sin_comision ?? 0,
                'utilidad_con_comision' => $request->utilidad_con_comision ?? 0,
                'ganancia_perdida' => $request->ganancia_perdida ?? 0,
                'rendimiento_total' => $request->rendimiento_total ?? 0,
                'dias_transcurridos' => $request->dias_transcurridos ?? 0,
                'roi' => $request->roi ?? 0,
                'ganancia_anual' => $request->ganancia_anual ?? 0,
                'comisiones_santa_fe' => $request->comisiones_santa_fe ?? 0,
                'retenciones' => $request->retenciones ?? 0,
                'observacion' => $request->observacion,
                'activo' => true,
                'eliminado' => false,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);

            // Actualizar estado de la inversión
            $inversion = Inversion::find($request->id_inversion);
            if ($inversion) {
                $inversion->update([
                    'fecha_venta' => $request->fecha_venta,
                    'fecha_actualizacion' => now()
                ]);
            }

            // Disparar evento para crear movimiento contable automáticamente
            event(new VentaInversionRegistrada($venta));

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Venta registrada exitosamente',
                'data' => $venta->load(['inversion', 'instrumento', 'tipoVenta'])
            ], Response::HTTP_CREATED);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar venta: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $venta = VentaInversion::with(['inversion', 'instrumento', 'tipoVenta'])->find($id);

        if (!$venta) {
            return response()->json([
                'success' => false,
                'message' => 'Venta no encontrada'
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'success' => true,
            'data' => $venta
        ], Response::HTTP_OK);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $venta = VentaInversion::find($id);

        if (!$venta) {
            return response()->json([
                'success' => false,
                'message' => 'Venta no encontrada'
            ], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'id_inversion' => 'required|exists:inversion,id_inversion',
            'id_instrumento' => 'nullable|exists:instrumento,id_instrumento',
            'id_tipo_venta' => 'nullable|exists:catalogo_valor,id_catalogo_valor',
            'porcentaje_vendido' => 'nullable|numeric',
            'fecha_venta' => 'required|date',
            'liquidacion_venta' => 'nullable|string|max:50',
            'precio_venta' => 'nullable|numeric',
            'precio_neto_venta' => 'nullable|numeric',
            'interes_previo_venta' => 'nullable|numeric',
            'valor_venta_sin_comision' => 'nullable|numeric',
            'comision_operador' => 'nullable|numeric',
            'comision_bolsa' => 'nullable|numeric',
            'valor_venta_con_comision' => 'nullable|numeric',
            'utilidad_sin_comision' => 'nullable|numeric',
            'utilidad_con_comision' => 'nullable|numeric',
            'ganancia_perdida' => 'nullable|numeric',
            'rendimiento_total' => 'nullable|numeric',
            'dias_transcurridos' => 'nullable|numeric',
            'roi' => 'nullable|numeric',
            'ganancia_anual' => 'nullable|numeric',
            'comisiones_santa_fe' => 'nullable|numeric',
            'retenciones' => 'nullable|numeric',
            'observacion' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], Response::HTTP_BAD_REQUEST);
        }

        DB::beginTransaction();
        try {
            $venta->update([
                'id_inversion' => $request->id_inversion,
                'id_instrumento' => $request->id_instrumento,
                'id_tipo_venta' => $request->id_tipo_venta,
                'porcentaje_vendido' => $request->porcentaje_vendido,
                'fecha_venta' => $request->fecha_venta,
                'liquidacion_venta' => $request->liquidacion_venta,
                'precio_venta' => $request->precio_venta,
                'precio_neto_venta' => $request->precio_neto_venta,
                'interes_previo_venta' => $request->interes_previo_venta,
                'valor_venta_sin_comision' => $request->valor_venta_sin_comision,
                'comision_operador' => $request->comision_operador,
                'comision_bolsa' => $request->comision_bolsa,
                'valor_venta_con_comision' => $request->valor_venta_con_comision,
                'utilidad_sin_comision' => $request->utilidad_sin_comision,
                'utilidad_con_comision' => $request->utilidad_con_comision,
                'ganancia_perdida' => $request->ganancia_perdida,
                'rendimiento_total' => $request->rendimiento_total,
                'dias_transcurridos' => $request->dias_transcurridos,
                'roi' => $request->roi,
                'ganancia_anual' => $request->ganancia_anual,
                'comisiones_santa_fe' => $request->comisiones_santa_fe,
                'retenciones' => $request->retenciones,
                'observacion' => $request->observacion,
                'fecha_actualizacion' => now()
            ]);

            // Actualizar movimiento contable asociado
            $movimiento = MovimientoCapital::where('id_venta_inversion', $id)->first();
            if ($movimiento) {
                $movimiento->update([
                    'fecha_movimiento' => $request->fecha_venta,
                    'id_inversion' => $request->id_inversion,
                    'fecha_actualizacion' => now()
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Venta actualizada exitosamente',
                'data' => $venta->load(['inversion', 'instrumento', 'tipoVenta'])
            ], Response::HTTP_OK);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar venta: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Remove the specified resource from storage (soft delete).
     */
    public function destroy($id)
    {
        $venta = VentaInversion::find($id);

        if (!$venta) {
            return response()->json([
                'success' => false,
                'message' => 'Venta no encontrada'
            ], Response::HTTP_NOT_FOUND);
        }

        DB::beginTransaction();
        try {
            $venta->update([
                'activo' => false,
                'eliminado' => true,
                'fecha_actualizacion' => now()
            ]);

            // Desactivar movimiento contable asociado
            $movimiento = MovimientoCapital::where('id_venta_inversion', $id)->first();
            if ($movimiento) {
                $movimiento->update([
                    'activo' => false,
                    'eliminado' => true,
                    'fecha_actualizacion' => now()
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Venta desactivada correctamente'
            ], Response::HTTP_OK);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al desactivar venta: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Calcular utilidad/pérdida de una venta
     */
    public function calcularUtilidad(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_inversion' => 'required|exists:inversion,id_inversion',
            'precio_venta' => 'required|numeric',
            'porcentaje_vendido' => 'required|numeric|min:0|max:100'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], Response::HTTP_BAD_REQUEST);
        }

        $inversion = Inversion::find($request->id_inversion);

        if (!$inversion) {
            return response()->json([
                'success' => false,
                'message' => 'Inversión no encontrada'
            ], Response::HTTP_NOT_FOUND);
        }

        $capitalInvertido = $inversion->capital_invertido;
        $porcentajeVendido = $request->porcentaje_vendido;
        $precioVenta = $request->precio_venta;

        // Calcular valor de venta
        $valorVenta = ($capitalInvertido * $porcentajeVendido / 100) * $precioVenta;

        // Calcular utilidad/pérdida
        $utilidad = $valorVenta - ($capitalInvertido * $porcentajeVendido / 100);

        // Calcular días transcurridos
        $diasTranscurridos = 0;
        if ($inversion->fecha_compra) {
            $fechaCompra = \Carbon\Carbon::parse($inversion->fecha_compra);
            $diasTranscurridos = $fechaCompra->diffInDays(now());
        }

        // Calcular ROI
        $roi = 0;
        if ($capitalInvertido > 0) {
            $roi = ($utilidad / $capitalInvertido) * 100;
        }

        // Calcular ganancia anualizada
        $gananciaAnual = 0;
        if ($diasTranscurridos > 0) {
            $gananciaAnual = ($utilidad / $diasTranscurridos) * 365;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'capital_invertido' => $capitalInvertido,
                'porcentaje_vendido' => $porcentajeVendido,
                'valor_venta' => $valorVenta,
                'utilidad' => $utilidad,
                'dias_transcurridos' => $diasTranscurridos,
                'roi' => $roi,
                'ganancia_anual' => $gananciaAnual
            ]
        ], Response::HTTP_OK);
    }
}
