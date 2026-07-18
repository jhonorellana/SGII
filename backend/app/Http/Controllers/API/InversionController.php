<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Inversion;
use App\Events\InversionCreada;
use App\Http\Resources\InversionResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class InversionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(\Illuminate\Http\Request $request)
    {
        $query = Inversion::with(['grupoFamiliar', 'instrumento.emisor', 'instrumento.tipoInversion', 'propietario', 'aportante', 'estadoInversion']);

        if ($request->has('id_instrumento')) {
            $query->where('id_instrumento', $request->query('id_instrumento'));
        }

        if ($request->has('tipo_inversion')) {
            $tipo = $request->query('tipo_inversion');
            $query->whereHas('instrumento', function ($q) use ($tipo) {
                $q->where('id_tipo_inversion', $tipo);
            });
        } elseif (!$request->boolean('incluir_notas_credito', false)) {
            // Excluir Notas de Crédito por defecto para pantallas de Renta Fija
            $query->whereHas('instrumento', function ($q) {
                $q->where('id_tipo_inversion', '!=', 91);
            });
        }

        $inversiones = $query->withSum(['amortizaciones as saldo_capital' => function($q) {
                $q->whereIn('id_estado_amortizacion', [134, 136]) // Pendiente de pago y morosa
                  ->where('eliminado', 0)
                  ->where('fecha_pago', '>', date('Y-m-d'));
            }], 'capital')
            ->orderBy('id_inversion', 'desc')
            ->get();

        return response()->json(InversionResource::collection($inversiones), Response::HTTP_OK);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_grupo_familiar' => 'required|exists:grupo_familiar,id_grupo_familiar',
            'id_instrumento' => 'nullable|exists:instrumento,id_instrumento',
            'id_propietario' => 'required|exists:persona,id_persona',
            'id_aportante' => 'nullable|exists:persona,id_persona',
            'liquidacion' => 'nullable|string|max:15',
            'id_estado_inversion' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'fecha_compra' => 'required|date',
            'fecha_venta' => 'nullable|date|after_or_equal:fecha_compra',
            'valor_nominal' => 'nullable|numeric',
            'monto_a_negociar' => 'nullable|numeric',
            'capital_invertido' => 'required|numeric',
            'tasa_interes' => 'nullable|numeric',
            'rendimiento_nominal' => 'nullable|numeric',
            'rendimiento_efectivo' => 'nullable|numeric',
            'valor_efectivo' => 'nullable|numeric',
            'valor_sin_comision' => 'nullable|numeric',
            'valor_con_interes' => 'nullable|numeric',
            'interes_acumulado_previo' => 'nullable|numeric',
            'interes_mensual' => 'nullable|numeric',
            'interes_primer_mes' => 'nullable|numeric',
            'total_comisiones' => 'nullable|numeric',
            'tasa_mensual_real' => 'nullable|numeric',
            'fecha_primer_pago' => 'nullable|date',
            'precio_compra' => 'nullable|numeric',
            'precio_neto_compra' => 'nullable|numeric',
            'comision_bolsa' => 'nullable|numeric',
            'comision_casa_valores' => 'nullable|numeric',
            'retencion_fuente' => 'nullable|numeric',
            'observacion' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], Response::HTTP_BAD_REQUEST);
        }

        DB::beginTransaction();
        try {
            $inversion = Inversion::create([
                'id_grupo_familiar' => $request->id_grupo_familiar,
                'id_instrumento' => $request->id_instrumento,
                'id_propietario' => $request->id_propietario,
                'id_aportante' => $request->id_aportante,
                'liquidacion' => $request->liquidacion,
                'id_estado_inversion' => $request->id_estado_inversion,
                'fecha_compra' => $request->fecha_compra,
                'fecha_venta' => $request->fecha_venta,
                'valor_nominal' => $request->valor_nominal,
                'monto_a_negociar' => $request->monto_a_negociar,
                'capital_invertido' => $request->capital_invertido,
                'tasa_interes' => $request->tasa_interes,
                'rendimiento_nominal' => $request->rendimiento_nominal,
                'rendimiento_efectivo' => $request->rendimiento_efectivo,
                'valor_efectivo' => $request->valor_efectivo,
                'valor_sin_comision' => $request->valor_sin_comision,
                'valor_con_interes' => $request->valor_con_interes,
                'interes_acumulado_previo' => $request->interes_acumulado_previo,
                'interes_mensual' => $request->interes_mensual,
                'interes_primer_mes' => $request->interes_primer_mes,
                'total_comisiones' => $request->total_comisiones,
                'tasa_mensual_real' => $request->tasa_mensual_real,
                'fecha_primer_pago' => $request->fecha_primer_pago,
                'precio_compra' => $request->precio_compra,
                'precio_neto_compra' => $request->precio_neto_compra,
                'comision_bolsa' => $request->comision_bolsa,
                'comision_casa_valores' => $request->comision_casa_valores,
                'retencion_fuente' => $request->retencion_fuente,
                'observacion' => $request->observacion,
                'eliminado' => false,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);

            // Disparar evento para crear movimiento contable automáticamente
            event(new InversionCreada($inversion));

            DB::commit();

            return response()->json($inversion->load(['grupoFamiliar', 'instrumento.emisor', 'instrumento.tipoInversion', 'propietario', 'aportante', 'estadoInversion']), Response::HTTP_CREATED);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al crear inversión: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $inversion = Inversion::with(['grupoFamiliar', 'instrumento.emisor', 'instrumento.tipoInversion', 'propietario', 'aportante', 'estadoInversion'])->find($id);

        if (!$inversion) {
            return response()->json(['message' => 'Inversión no encontrada'], Response::HTTP_NOT_FOUND);
        }

        return response()->json($inversion, Response::HTTP_OK);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $inversion = Inversion::find($id);

        if (!$inversion) {
            return response()->json(['message' => 'Inversión no encontrada'], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'id_grupo_familiar' => 'required|exists:grupo_familiar,id_grupo_familiar',
            'id_instrumento' => 'nullable|exists:instrumento,id_instrumento',
            'id_propietario' => 'required|exists:persona,id_persona',
            'id_aportante' => 'nullable|exists:persona,id_persona',
            'liquidacion' => 'nullable|string|max:15',
            'id_estado_inversion' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'fecha_compra' => 'required|date',
            'fecha_venta' => 'nullable|date|after_or_equal:fecha_compra',
            'valor_nominal' => 'nullable|numeric',
            'monto_a_negociar' => 'nullable|numeric',
            'capital_invertido' => 'required|numeric',
            'tasa_interes' => 'nullable|numeric',
            'rendimiento_nominal' => 'nullable|numeric',
            'rendimiento_efectivo' => 'nullable|numeric',
            'valor_efectivo' => 'nullable|numeric',
            'valor_sin_comision' => 'nullable|numeric',
            'valor_con_interes' => 'nullable|numeric',
            'interes_acumulado_previo' => 'nullable|numeric',
            'interes_mensual' => 'nullable|numeric',
            'interes_primer_mes' => 'nullable|numeric',
            'total_comisiones' => 'nullable|numeric',
            'tasa_mensual_real' => 'nullable|numeric',
            'fecha_primer_pago' => 'nullable|date',
            'precio_compra' => 'nullable|numeric',
            'precio_neto_compra' => 'nullable|numeric',
            'comision_bolsa' => 'nullable|numeric',
            'comision_casa_valores' => 'nullable|numeric',
            'retencion_fuente' => 'nullable|numeric',
            'observacion' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], Response::HTTP_BAD_REQUEST);
        }

        $inversion->update([
            'id_grupo_familiar' => $request->id_grupo_familiar,
            'id_instrumento' => $request->id_instrumento,
            'id_propietario' => $request->id_propietario,
            'id_aportante' => $request->id_aportante,
            'liquidacion' => $request->liquidacion,
            'id_estado_inversion' => $request->id_estado_inversion,
            'fecha_compra' => $request->fecha_compra,
            'fecha_venta' => $request->fecha_venta,
            'valor_nominal' => $request->valor_nominal,
            'monto_a_negociar' => $request->monto_a_negociar,
            'capital_invertido' => $request->capital_invertido,
            'tasa_interes' => $request->tasa_interes,
            'rendimiento_nominal' => $request->rendimiento_nominal,
            'rendimiento_efectivo' => $request->rendimiento_efectivo,
            'valor_efectivo' => $request->valor_efectivo,
            'valor_sin_comision' => $request->valor_sin_comision,
            'valor_con_interes' => $request->valor_con_interes,
            'interes_acumulado_previo' => $request->interes_acumulado_previo,
            'interes_mensual' => $request->interes_mensual,
            'interes_primer_mes' => $request->interes_primer_mes,
            'total_comisiones' => $request->total_comisiones,
            'tasa_mensual_real' => $request->tasa_mensual_real,
            'fecha_primer_pago' => $request->fecha_primer_pago,
            'precio_compra' => $request->precio_compra,
            'precio_neto_compra' => $request->precio_neto_compra,
            'comision_bolsa' => $request->comision_bolsa,
            'comision_casa_valores' => $request->comision_casa_valores,
            'retencion_fuente' => $request->retencion_fuente,
            'observacion' => $request->observacion,
            'fecha_actualizacion' => now()
        ]);

        return response()->json($inversion->load(['grupoFamiliar', 'instrumento.emisor', 'instrumento.tipoInversion', 'propietario', 'aportante', 'estadoInversion']), Response::HTTP_OK);
    }

    /**
     * Remove the specified resource from storage (soft delete).
     * No elimina movimientos históricos para mantener trazabilidad contable.
     */
    public function destroy($id)
    {
        $inversion = Inversion::find($id);

        if (!$inversion) {
            return response()->json([
                'success' => false,
                'message' => 'Inversión no encontrada'
            ], Response::HTTP_NOT_FOUND);
        }

        $inversion->update([
            'id_estado_inversion' => 132,
            'eliminado' => true,
            'fecha_actualizacion' => now()
        ]);

        // NOTA: No eliminamos los movimientos históricos para mantener trazabilidad contable
        // Los movimientos permanecen en movimiento_capital con activo=true o false según corresponda

        return response()->json([
            'success' => true,
            'message' => 'Inversión desactivada correctamente'
        ], Response::HTTP_OK);
    }
}
