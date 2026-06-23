<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\MovimientoCapital;
use App\Models\CatalogoValor;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class MovimientoCapitalController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = MovimientoCapital::with(['inversion', 'accionOperacion.instrumento', 'ventaInversion', 'cuentaBancaria.persona', 'tipoMovimiento', 'persona', 'signoCatalogo'])
            ->where('eliminado', false)
            ->where(function($q) {
                $q->where('id_tipo_movimiento', '!=', 213)
                  ->orWhereNull('id_tipo_movimiento');
            });

        // Filtros
        if ($request->has('fecha_desde') && $request->fecha_desde) {
            $query->where('fecha_movimiento', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta') && $request->fecha_hasta) {
            $query->where('fecha_movimiento', '<=', $request->fecha_hasta);
        }
        if ($request->has('id_tipo_movimiento') && $request->id_tipo_movimiento) {
            $query->where('id_tipo_movimiento', $request->id_tipo_movimiento);
        }
        if ($request->has('id_persona') && $request->id_persona) {
            $query->where('id_persona', $request->id_persona);
        }
        if ($request->has('id_signo') && $request->id_signo) {
            $query->where('id_signo', $request->id_signo);
        }
        if ($request->has('id_cuenta_bancaria') && $request->id_cuenta_bancaria) {
            $query->where('id_cuenta_bancaria', $request->id_cuenta_bancaria);
        }
        if ($request->has('id_inversion') && $request->id_inversion) {
            $query->where('id_inversion', $request->id_inversion);
        }
        if ($request->has('id_accion_operacion') && $request->id_accion_operacion) {
            $query->where('id_accion_operacion', $request->id_accion_operacion);
        }
        if ($request->has('conciliado') && $request->conciliado !== '') {
            $query->where('conciliado', $request->conciliado);
        }

        $movimientos = $query->orderBy('fecha_movimiento', 'desc')->orderBy('id_movimiento_capital', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $movimientos
        ], Response::HTTP_OK);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'fecha_movimiento' => 'required|date',
            'id_tipo_movimiento' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'id_persona' => 'required|exists:persona,id_persona',
            'id_signo' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'monto' => 'nullable|numeric',
            'id_inversion' => 'nullable|exists:inversion,id_inversion',
            'id_accion_operacion' => 'nullable|exists:accion_operacion,id_accion_operacion',
            'id_venta_inversion' => 'nullable|exists:venta_inversion,id_venta_inversion',
            'id_cuenta_bancaria' => 'nullable|exists:cuenta_bancaria,id_cuenta_bancaria',
            'descripcion' => 'nullable|string|max:100',
            'conciliado' => 'boolean',
            'fecha_conciliacion' => 'nullable|date'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], Response::HTTP_BAD_REQUEST);
        }

        $movimiento = MovimientoCapital::create([
            'fecha_movimiento' => $request->fecha_movimiento,
            'id_tipo_movimiento' => $request->id_tipo_movimiento,
            'id_persona' => $request->id_persona,
            'id_signo' => $request->id_signo,
            'monto' => $request->monto,
            'id_inversion' => $request->id_inversion,
            'id_accion_operacion' => $request->id_accion_operacion,
            'id_venta_inversion' => $request->id_venta_inversion,
            'id_cuenta_bancaria' => $request->id_cuenta_bancaria,
            'descripcion' => $request->descripcion,
            'conciliado' => $request->has('conciliado') ? $request->conciliado : false,
            'fecha_conciliacion' => $request->fecha_conciliacion,
            'activo' => true,
            'eliminado' => false,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Movimiento creado exitosamente',
            'data' => $movimiento->load(['inversion', 'accionOperacion.instrumento', 'ventaInversion', 'cuentaBancaria', 'tipoMovimiento', 'persona', 'signoCatalogo'])
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $movimiento = MovimientoCapital::with(['inversion', 'accionOperacion.instrumento', 'ventaInversion', 'cuentaBancaria', 'tipoMovimiento', 'persona', 'signoCatalogo'])->find($id);

        if (!$movimiento) {
            return response()->json([
                'success' => false,
                'message' => 'Movimiento no encontrado'
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'success' => true,
            'data' => $movimiento
        ], Response::HTTP_OK);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $movimiento = MovimientoCapital::find($id);

        if (!$movimiento) {
            return response()->json([
                'success' => false,
                'message' => 'Movimiento no encontrado'
            ], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'fecha_movimiento' => 'required|date',
            'id_tipo_movimiento' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'id_persona' => 'required|exists:persona,id_persona',
            'id_signo' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'monto' => 'nullable|numeric',
            'id_inversion' => 'nullable|exists:inversion,id_inversion',
            'id_accion_operacion' => 'nullable|exists:accion_operacion,id_accion_operacion',
            'id_venta_inversion' => 'nullable|exists:venta_inversion,id_venta_inversion',
            'id_cuenta_bancaria' => 'nullable|exists:cuenta_bancaria,id_cuenta_bancaria',
            'descripcion' => 'nullable|string|max:100',
            'conciliado' => 'boolean',
            'fecha_conciliacion' => 'nullable|date'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], Response::HTTP_BAD_REQUEST);
        }

        $movimiento->update([
            'fecha_movimiento' => $request->fecha_movimiento,
            'id_tipo_movimiento' => $request->id_tipo_movimiento,
            'id_persona' => $request->id_persona,
            'id_signo' => $request->id_signo,
            'monto' => $request->monto,
            'id_inversion' => $request->id_inversion,
            'id_accion_operacion' => $request->id_accion_operacion,
            'id_venta_inversion' => $request->id_venta_inversion,
            'id_cuenta_bancaria' => $request->id_cuenta_bancaria,
            'descripcion' => $request->descripcion,
            'conciliado' => $request->has('conciliado') ? $request->conciliado : $movimiento->conciliado,
            'fecha_conciliacion' => $request->fecha_conciliacion,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Movimiento actualizado exitosamente',
            'data' => $movimiento->load(['inversion', 'accionOperacion.instrumento', 'ventaInversion', 'cuentaBancaria', 'tipoMovimiento', 'persona', 'signoCatalogo'])
        ], Response::HTTP_OK);
    }

    /**
     * Remove the specified resource from storage (soft delete).
     */
    public function destroy($id)
    {
        $movimiento = MovimientoCapital::find($id);

        if (!$movimiento) {
            return response()->json([
                'success' => false,
                'message' => 'Movimiento no encontrado'
            ], Response::HTTP_NOT_FOUND);
        }

        $movimiento->update([
            'activo' => false,
            'eliminado' => true,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Movimiento desactivado correctamente'
        ], Response::HTTP_OK);
    }

    /**
     * Calcular saldo esperado en Casa de Valores
     */
    public function getSaldoEsperado(Request $request)
    {
        $query = MovimientoCapital::with(['inversion', 'accionOperacion', 'ventaInversion', 'tipoMovimiento'])
            ->where('eliminado', false)
            ->where('activo', true)
            ->where(function($q) {
                $q->where('id_tipo_movimiento', '!=', 213)
                  ->orWhereNull('id_tipo_movimiento');
            });

        // Filtros opcionales
        if ($request->has('fecha')) {
            $query->where('fecha_movimiento', '<=', $request->fecha);
        }

        $movimientos = $query->orderBy('fecha_movimiento', 'asc')->get();

        $saldo = 0;
        $movimientosConSaldo = [];

        foreach ($movimientos as $movimiento) {
            $monto = 0;

            // Determinar el monto según el tipo de movimiento
            if ($movimiento->id_tipo_movimiento == 181) { // COMPRA_INVERSION (COM_INV)
                if ($movimiento->inversion) {
                    $monto = $movimiento->inversion->capital_invertido;
                } elseif ($movimiento->accionOperacion) {
                    $monto = $movimiento->accionOperacion->valor_neto;
                }
            } elseif ($movimiento->id_tipo_movimiento == 182) { // VENTA_INVERSION (VEN_INV)
                if ($movimiento->ventaInversion) {
                    $monto = $movimiento->ventaInversion->valor_venta_con_comision;
                } elseif ($movimiento->accionOperacion) {
                    $monto = $movimiento->accionOperacion->valor_neto;
                }
            } else {
                // Otros movimientos: valor directo
                $monto = $movimiento->monto;
            }

            // Aplicar signo
            if ($movimiento->signo == '-') {
                $saldo -= $monto;
            } else {
                $saldo += $monto;
            }

            $movimiento->saldo_acumulado = $saldo;
            $movimientosConSaldo[] = $movimiento;
        }

        return response()->json([
            'success' => true,
            'saldo_esperado' => $saldo,
            'data' => $movimientosConSaldo
        ], Response::HTTP_OK);
    }

    /**
     * Generar reporte de estado de cuenta contable
     */
    public function getEstadoCuenta(Request $request)
    {
        $query = MovimientoCapital::with(['inversion', 'accionOperacion', 'ventaInversion', 'cuentaBancaria.persona', 'tipoMovimiento'])
            ->where('eliminado', false)
            ->where('activo', true)
            ->where(function($q) {
                $q->where('id_tipo_movimiento', '!=', 213)
                  ->orWhereNull('id_tipo_movimiento');
            });

        // Filtros
        if ($request->has('fecha_desde') && $request->fecha_desde) {
            $query->where('fecha_movimiento', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta') && $request->fecha_hasta) {
            $query->where('fecha_movimiento', '<=', $request->fecha_hasta);
        }

        $movimientos = $query->orderBy('fecha_movimiento', 'asc')->get();

        $saldo = 0;
        $estadoCuenta = [];

        foreach ($movimientos as $movimiento) {
            $monto = 0;
            $liquidacion = null;

            // Determinar el monto y liquidación según el tipo
            if ($movimiento->id_tipo_movimiento == 181) { // COMPRA_INVERSION (COM_INV)
                if ($movimiento->inversion) {
                    $monto = $movimiento->inversion->capital_invertido;
                    $liquidacion = $movimiento->inversion->liquidacion;
                } elseif ($movimiento->accionOperacion) {
                    $monto = $movimiento->accionOperacion->valor_neto;
                    $liquidacion = $movimiento->accionOperacion->liquidacion ?: '[RV] Op. #' . $movimiento->accionOperacion->id_accion_operacion;
                }
            } elseif ($movimiento->id_tipo_movimiento == 182) { // VENTA_INVERSION (VEN_INV)
                if ($movimiento->ventaInversion) {
                    $monto = $movimiento->ventaInversion->valor_venta_con_comision;
                    $liquidacion = $movimiento->ventaInversion->liquidacion_venta;
                } elseif ($movimiento->accionOperacion) {
                    $monto = $movimiento->accionOperacion->valor_neto;
                    $liquidacion = $movimiento->accionOperacion->liquidacion ?: '[RV] Op. #' . $movimiento->accionOperacion->id_accion_operacion;
                }
            } else {
                $monto = $movimiento->monto;
            }

            // Aplicar signo
            if ($movimiento->signo == '-') {
                $saldo -= $monto;
            } else {
                $saldo += $monto;
            }

            $estadoCuenta[] = [
                'id_movimiento_capital' => $movimiento->id_movimiento_capital,
                'fecha_movimiento' => $movimiento->fecha_movimiento,
                'tipo_movimiento' => $movimiento->tipoMovimiento ? $movimiento->tipoMovimiento->nombre : '-',
                'descripcion' => $movimiento->descripcion,
                'inversion' => $movimiento->inversion ? $movimiento->inversion->id_inversion : null,
                'id_accion_operacion' => $movimiento->id_accion_operacion,
                'liquidacion' => $liquidacion,
                'monto' => $monto,
                'signo' => $movimiento->signo,
                'saldo_acumulado' => $saldo,
                'conciliado' => $movimiento->conciliado,
                'fecha_conciliacion' => $movimiento->fecha_conciliacion
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $estadoCuenta
        ], Response::HTTP_OK);
    }

    /**
     * Generar reporte de discrepancias
     */
    public function getDiscrepancias(Request $request)
    {
        $discrepancias = [];

        // Movimientos no conciliados
        $movimientosNoConciliados = MovimientoCapital::with(['inversion', 'ventaInversion', 'tipoMovimiento'])
            ->where('eliminado', false)
            ->where('activo', true)
            ->where('conciliado', false)
            ->orderBy('fecha_movimiento', 'desc')
            ->get();

        $discrepancias['movimientos_no_conciliados'] = $movimientosNoConciliados;

        // Operaciones sin liquidación
        $inversionesSinLiquidacion = DB::table('inversion')
            ->where('eliminado', false)
            ->where('activo', true)
            ->whereNull('liquidacion')
            ->orWhere('liquidacion', '')
            ->get();

        $discrepancias['inversiones_sin_liquidacion'] = $inversionesSinLiquidacion;

        // Ventas sin liquidación
        $ventasSinLiquidacion = DB::table('venta_inversion')
            ->where('eliminado', false)
            ->where('activo', true)
            ->whereNull('liquidacion_venta')
            ->orWhere('liquidacion_venta', '')
            ->get();

        $discrepancias['ventas_sin_liquidacion'] = $ventasSinLiquidacion;

        // Inversiones vendidas sin movimiento contable
        $inversionesVendidas = DB::table('inversion')
            ->where('eliminado', false)
            ->whereNotNull('fecha_venta')
            ->pluck('id_inversion');

        $ventasConMovimiento = DB::table('venta_inversion')
            ->whereIn('id_inversion', $inversionesVendidas)
            ->pluck('id_inversion');

        $inversionesSinMovimiento = $inversionesVendidas->diff($ventasConMovimiento);

        $discrepancias['inversiones_vendidas_sin_movimiento'] = $inversionesSinMovimiento;

        return response()->json([
            'success' => true,
            'data' => $discrepancias
        ], Response::HTTP_OK);
    }

    /**
     * Generar reporte por cuenta bancaria
     */
    public function getReportePorCuenta(Request $request)
    {
        $query = MovimientoCapital::with(['cuentaBancaria.persona', 'tipoMovimiento'])
            ->where('eliminado', false)
            ->where('activo', true)
            ->whereNotNull('id_cuenta_bancaria')
            ->where(function($q) {
                $q->where('id_tipo_movimiento', '!=', 213)
                  ->orWhereNull('id_tipo_movimiento');
            });

        // Filtros
        if ($request->has('id_cuenta_bancaria') && $request->id_cuenta_bancaria) {
            $query->where('id_cuenta_bancaria', $request->id_cuenta_bancaria);
        }
        if ($request->has('fecha_desde') && $request->fecha_desde) {
            $query->where('fecha_movimiento', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta') && $request->fecha_hasta) {
            $query->where('fecha_movimiento', '<=', $request->fecha_hasta);
        }

        $movimientos = $query->orderBy('fecha_movimiento', 'asc')->get();

        // Agrupar por cuenta bancaria
        $reportePorCuenta = [];
        foreach ($movimientos as $movimiento) {
            $idCuenta = $movimiento->id_cuenta_bancaria;
            if (!isset($reportePorCuenta[$idCuenta])) {
                $reportePorCuenta[$idCuenta] = [
                    'cuenta_bancaria' => $movimiento->cuentaBancaria,
                    'propietario' => $movimiento->cuentaBancaria->persona,
                    'total_transferido' => 0,
                    'movimientos' => []
                ];
            }

            $reportePorCuenta[$idCuenta]['total_transferido'] += $movimiento->monto;
            $reportePorCuenta[$idCuenta]['movimientos'][] = $movimiento;
        }

        return response()->json([
            'success' => true,
            'data' => array_values($reportePorCuenta)
        ], Response::HTTP_OK);
    }

    /**
     * Conciliar múltiples movimientos de capital a la vez
     */
    public function conciliarLote(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array',
            'ids.*' => 'exists:movimiento_capital,id_movimiento_capital'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], Response::HTTP_BAD_REQUEST);
        }

        $ids = $request->input('ids');

        MovimientoCapital::whereIn('id_movimiento_capital', $ids)
            ->update([
                'conciliado' => true,
                'fecha_conciliacion' => now()->toDateString(),
                'fecha_actualizacion' => now()
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Movimientos conciliados exitosamente'
        ], Response::HTTP_OK);
    }
}
