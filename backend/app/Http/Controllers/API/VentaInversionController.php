<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\VentaInversion;
use App\Models\VentaInversionDetalle;
use App\Models\Inversion;
use App\Models\MovimientoCapital;
use App\Events\VentaInversionRegistrada;
use App\Services\VentaAgrupadaCalculator;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class VentaInversionController extends Controller
{
    protected $ventaCalculator;

    public function __construct(VentaAgrupadaCalculator $ventaCalculator)
    {
        $this->ventaCalculator = $ventaCalculator;
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = VentaInversion::with(['inversion', 'instrumento', 'tipoVenta', 'detalles.inversion'])
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
        $venta = VentaInversion::with(['inversion', 'instrumento', 'tipoVenta', 'detalles.inversion'])->find($id);

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

    /**
     * Crear venta agrupada de múltiples inversiones (Notas de Crédito)
     */
    public function storeVentaAgrupada(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'inversiones' => 'required|array|min:1',
            'inversiones.*' => 'exists:inversion,id_inversion',
            'porcentaje_venta' => 'nullable|numeric|min:0|max:100',
            'valor_total_recibido' => 'nullable|numeric|min:0',
            'fecha_venta' => 'required|date',
            'liquidacion_venta' => 'nullable|string|max:50',
            'comision_operador' => 'nullable|numeric|min:0',
            'comision_bolsa' => 'nullable|numeric|min:0',
            'id_cuenta_bancaria' => 'nullable|exists:cuenta_bancaria,id_cuenta_bancaria',
            'observacion' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Validar que se proporcione porcentaje_venta o valor_total_recibido
        if (!$request->porcentaje_venta && !$request->valor_total_recibido) {
            return response()->json([
                'success' => false,
                'message' => 'Debe proporcionar porcentaje_venta o valor_total_recibido'
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        DB::beginTransaction();
        try {
            // Usar el servicio de cálculo para obtener la distribución
            $distribucion = $this->ventaCalculator->calcularDistribucionVenta(
                $request->inversiones,
                $request->porcentaje_venta ?? 0,
                $request->valor_total_recibido ?? 0,
                $request->comision_operador ?? 0,
                $request->comision_bolsa ?? 0
            );

            if (!$distribucion['success']) {
                return response()->json($distribucion, Response::HTTP_BAD_REQUEST);
            }

            $data = $distribucion['data'];
            $resumenCompra = $data['resumen_compra'];

            // Crear venta principal
            $venta = VentaInversion::create([
                'id_inversion' => null, // NULL para ventas agrupadas
                'id_instrumento' => Inversion::find($request->inversiones[0])->id_instrumento ?? null,
                'id_tipo_venta' => null,
                'porcentaje_vendido' => $request->porcentaje_venta ?? 0,
                'fecha_venta' => $request->fecha_venta,
                'liquidacion_venta' => $request->liquidacion_venta,
                'precio_venta' => 0,
                'precio_neto_venta' => 0,
                'interes_previo_venta' => 0,
                'valor_venta_sin_comision' => $data['valor_venta_total'],
                'comision_operador' => $data['comision_operador'],
                'comision_bolsa' => $data['comision_bolsa'],
                'valor_venta_con_comision' => $data['valor_neto_recibido'],
                'utilidad_sin_comision' => $data['valor_venta_total'] - $resumenCompra['valor_compra_total'],
                'utilidad_con_comision' => $data['utilidad_total'],
                'ganancia_perdida' => $data['utilidad_total'],
                'rendimiento_total' => $data['roi_total'],
                'dias_transcurridos' => 0,
                'roi' => $data['roi_total'],
                'ganancia_anual' => 0,
                'comisiones_santa_fe' => 0,
                'retenciones' => 0,
                'observacion' => $request->observacion,
                'activo' => true,
                'eliminado' => false,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);

            // Crear detalles para cada inversión
            foreach ($data['detalles_distribucion'] as $detalle) {
                VentaInversionDetalle::create([
                    'id_venta_inversion' => $venta->id_venta_inversion,
                    'id_inversion' => $detalle['id_inversion'],
                    'valor_nominal' => $detalle['valor_nominal'],
                    'valor_compra' => $detalle['valor_compra'],
                    'porcentaje_compra' => $detalle['porcentaje_compra'],
                    'valor_venta_asignado' => $detalle['valor_venta_asignado'],
                    'porcentaje_venta' => $detalle['porcentaje_venta'],
                    'utilidad' => $detalle['utilidad'],
                    'rendimiento' => $detalle['rendimiento'],
                    'fecha_creacion' => now(),
                    'fecha_actualizacion' => now()
                ]);

                // Actualizar estado de la inversión
                $inversion = Inversion::find($detalle['id_inversion']);
                if ($inversion) {
                    $inversion->update([
                        'fecha_venta' => $request->fecha_venta,
                        'fecha_actualizacion' => now()
                    ]);
                }
            }

            // Crear movimiento de capital único
            $tipoVentaInversion = CatalogoValor::where('id_catalogo_valor', 182)->first();
            $tipoPositivo = CatalogoValor::where('codigo', 'POSITIVO')->first();

            $movimiento = MovimientoCapital::create([
                'fecha_movimiento' => $request->fecha_venta,
                'id_tipo_movimiento' => $tipoVentaInversion ? $tipoVentaInversion->id_catalogo_valor : 182, // VENTA_INVERSION
                'id_signo' => $tipoPositivo ? $tipoPositivo->id_catalogo_valor : 190, // POSITIVO
                'monto' => $data['valor_neto_recibido'],
                'id_inversion' => null, // NULL para ventas agrupadas
                'id_venta_inversion' => $venta->id_venta_inversion,
                'id_cuenta_bancaria' => $request->id_cuenta_bancaria,
                'descripcion' => 'Venta agrupada de notas de crédito',
                'conciliado' => false,
                'fecha_conciliacion' => null,
                'activo' => true,
                'eliminado' => false,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Venta agrupada registrada exitosamente',
                'data' => [
                    'venta' => $venta->load(['detalles.inversion']),
                    'movimiento_capital' => $movimiento,
                    'resumen' => [
                        'inversiones_count' => $resumenCompra['inversiones_count'],
                        'valor_nominal_total' => $resumenCompra['valor_nominal_total'],
                        'valor_compra_total' => $resumenCompra['valor_compra_total'],
                        'valor_venta_total' => $data['valor_venta_total'],
                        'valor_neto_recibido' => $data['valor_neto_recibido'],
                        'utilidad_total' => $data['utilidad_total'],
                        'comisiones_total' => $data['total_comisiones'],
                        'roi_total' => $data['roi_total']
                    ]
                ]
            ], Response::HTTP_CREATED);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar venta agrupada: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Calcular resumen de compra para inversiones seleccionadas
     */
    public function calcularResumenCompra(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'inversiones' => 'required|array|min:1',
            'inversiones.*' => 'exists:inversion,id_inversion'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $resultado = $this->ventaCalculator->calcularResumenCompra($request->inversiones);

        return response()->json($resultado, $resultado['success'] ? Response::HTTP_OK : Response::HTTP_NOT_FOUND);
    }

    /**
     * Previsualizar venta agrupada
     */
    public function previsualizarVentaAgrupada(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'inversiones' => 'required|array|min:1',
            'inversiones.*' => 'exists:inversion,id_inversion',
            'porcentaje_venta' => 'nullable|numeric|min:0|max:100',
            'valor_total_recibido' => 'nullable|numeric|min:0',
            'comision_operador' => 'nullable|numeric|min:0',
            'comision_bolsa' => 'nullable|numeric|min:0'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $resultado = $this->ventaCalculator->previsualizarVenta(
            $request->inversiones,
            $request->porcentaje_venta,
            $request->valor_total_recibido,
            $request->comision_operador ?? 0,
            $request->comision_bolsa ?? 0
        );

        return response()->json($resultado, $resultado['success'] ? Response::HTTP_OK : Response::HTTP_BAD_REQUEST);
    }
}
