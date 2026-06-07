<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\VentaInversion;
use App\Models\VentaInversionDetalle;
use App\Models\Inversion;
use App\Models\InversionPropietarioReasignacionLog;
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
        $query = VentaInversion::with(['inversion', 'instrumento', 'tipoVenta', 'persona', 'detalles.inversion'])
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
            'id_instrumento' => 'required|exists:instrumento,id_instrumento',
            'id_propietario' => 'nullable|exists:persona,id_persona',
            'id_tipo_venta' => 'nullable|exists:catalogo_valor,id_catalogo_valor',
            'porcentaje_vendido' => 'nullable|numeric',
            'fecha_venta' => 'required|date',
            'liquidacion_venta' => 'required|string|max:50',
            'precio_venta' => 'required|numeric',
            'precio_neto_venta' => 'nullable|numeric',
            'interes_previo_venta' => 'required|numeric',
            'valor_venta_sin_comision' => 'nullable|numeric',
            'comision_operador' => 'required|numeric',
            'comision_bolsa' => 'required|numeric',
            'retenciones' => 'required|numeric',
            'valor_venta_con_comision' => 'nullable|numeric',
            'utilidad_sin_comision' => 'nullable|numeric',
            'utilidad_con_comision' => 'nullable|numeric',
            'ganancia_perdida' => 'nullable|numeric',
            'rendimiento_total' => 'nullable|numeric',
            'dias_transcurridos' => 'nullable|numeric',
            'roi' => 'nullable|numeric',
            'ganancia_anual' => 'nullable|numeric',
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
            // Obtener inversiones asociadas al instrumento y propietario
            $query = Inversion::where('id_instrumento', $request->id_instrumento)
                ->where('activo', true)
                ->with('propietario', 'amortizaciones');

            // Si se especifica propietario, filtrar por él
            if ($request->has('id_propietario') && $request->id_propietario) {
                $query->where('id_propietario', $request->id_propietario);
            }

            $inversiones = $query->get();

            if ($inversiones->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontraron inversiones activas para el instrumento especificado'
                ], Response::HTTP_NOT_FOUND);
            }

            // Determinar tipo de venta (total o parcial)
            $esVentaTotal = !$request->porcentaje_vendido || $request->porcentaje_vendido >= 100;

            // Calcular total de valor nominal para prorrateo
            $valorNominalTotal = $inversiones->sum('valor_nominal');

            // Procesar cada inversión
            foreach ($inversiones as $inversion) {
                $factor = $valorNominalTotal > 0 ? ($inversion->valor_nominal / $valorNominalTotal) : 0;

                // Prorratear comisiones y otros valores globales del request
                $comisionOperador = ($request->comision_operador ?? 0) * $factor;
                $comisionBolsa = ($request->comision_bolsa ?? 0) * $factor;
                $retenciones = ($request->retenciones ?? 0) * $factor;
                $interesPrevioVenta = ($request->interes_previo_venta ?? 0) * $factor;

                // Calcular valores financieros según las fórmulas de Excel
                $valorVentaSinComision = (($request->precio_venta ?? 0) * $inversion->valor_nominal) / 100;
                $valorVentaConComision = $valorVentaSinComision - $comisionOperador - $comisionBolsa;

                $utilidadSinComision = $valorVentaSinComision - ($inversion->valor_sin_comision ?? 0);
                $utilidadConComision = $valorVentaConComision - ($inversion->capital_invertido ?? 0);
                $gananciaPerdida = $utilidadConComision;

                // Calcular días transcurridos
                $diasTranscurridos = 0;
                if ($inversion->fecha_compra) {
                    $fechaCompra = \Carbon\Carbon::parse($inversion->fecha_compra);
                    $fechaVenta = \Carbon\Carbon::parse($request->fecha_venta);
                    $diasTranscurridos = $fechaCompra->diffInDays($fechaVenta);
                }

                // Obtener interés recibido (de amortizaciones pagadas)
                $interesRecibido = $inversion->amortizaciones->where('pagada', true)->sum('interes') ?? 0;
                $rendimientoTotal = $utilidadConComision + $interesRecibido + $interesPrevioVenta;

                // Calcular ROI (Tasa de Rentabilidad Porcentual) = Rendimiento Total / Capital Invertido
                $roi = ($inversion->capital_invertido > 0)
                    ? ($rendimientoTotal / $inversion->capital_invertido) * 100
                    : 0;

                // Calcular ganancia anualizada (% Ganancia Anual estimado) = ROI * 365 / días
                $gananciaAnual = ($diasTranscurridos > 0)
                    ? ($roi * 365 / $diasTranscurridos)
                    : 0;

                if ($esVentaTotal) {
                    // VENTA TOTAL
                    // Paso 1: Actualizar estado de la inversión
                    $inversion->update([
                        'fecha_venta' => $request->fecha_venta,
                        'id_estado_inversion' => $this->getEstadoVendidaTotal(),
                        'activo' => false,
                        'fecha_actualizacion' => now()
                    ]);

                    // Paso 2: Inactivar amortizaciones futuras
                    \App\Models\Amortizacion::where('id_inversion', $inversion->id_inversion)
                        ->where('fecha_pago', '>=', $request->fecha_venta)
                        ->update([
                            'activo' => false,
                            'fecha_actualizacion' => now()
                        ]);
                }

                $valorRecibido = $valorVentaConComision + $interesPrevioVenta;
 
                // Paso 3: Crear registro en venta_inversion
                $venta = VentaInversion::create([
                    'id_inversion' => $inversion->id_inversion,
                    'id_instrumento' => $request->id_instrumento,
                    'id_tipo_venta' => $request->id_tipo_venta,
                    'id_propietario' => $inversion->id_propietario,
                    'porcentaje_vendido' => $request->porcentaje_vendido ?? 100,
                    'fecha_venta' => $request->fecha_venta,
                    'liquidacion_venta' => $request->liquidacion_venta,
                    'precio_venta' => $request->precio_venta ?? 0,
                    'precio_neto_venta' => $request->precio_neto_venta ?? 0,
                    'interes_previo_venta' => $interesPrevioVenta,
                    'valor_venta_sin_comision' => $valorVentaSinComision,
                    'comision_operador' => $comisionOperador,
                    'comision_bolsa' => $comisionBolsa,
                    'valor_venta_con_comision' => $valorVentaConComision,
                    'valor_recibido' => $valorRecibido,
                    'utilidad_sin_comision' => $utilidadSinComision,
                    'utilidad_con_comision' => $utilidadConComision,
                    'ganancia_perdida' => $gananciaPerdida,
                    'rendimiento_total' => $rendimientoTotal,
                    'dias_transcurridos' => $diasTranscurridos,
                    'roi' => $roi,
                    'ganancia_anual' => $gananciaAnual,
                    'retenciones' => $retenciones,
                    'observacion' => $request->observacion,
                    'activo' => true,
                    'eliminado' => false,
                    'fecha_creacion' => now(),
                    'fecha_actualizacion' => now()
                ]);
 
                // Paso 4: Crear detalle en venta_inversion_detalle
                VentaInversionDetalle::create([
                    'id_venta_inversion' => $venta->id_venta_inversion,
                    'id_inversion' => $inversion->id_inversion,
                    'valor_nominal' => $inversion->valor_nominal,
                    'valor_compra' => $inversion->capital_invertido,
                    'porcentaje_compra' => 100,
                    'valor_venta_asignado' => $valorVentaConComision,
                    'porcentaje_venta' => $request->porcentaje_vendido ?? 100,
                    'utilidad' => $utilidadConComision,
                    'rendimiento' => $roi,
                    'fecha_creacion' => now(),
                    'fecha_actualizacion' => now()
                ]);
 
                // Paso 5: Crear movimiento_capital
                MovimientoCapital::create([
                    'id_tipo_movimiento' => 182,
                    'id_persona' => $inversion->id_propietario,
                    'id_inversion' => $inversion->id_inversion,
                    'id_venta_inversion' => $venta->id_venta_inversion,
                    'id_cuenta_bancaria' => null,
                    'id_signo' => 190, // Positivo
                    'monto' => $valorRecibido,
                    'fecha_movimiento' => $request->fecha_venta,
                    'descripcion' => 'Venta de ' . ($inversion->instrumento->nombre ?? 'inversión'),
                    'conciliado' => 0,
                    'fecha_conciliacion' => null,
                    'activo' => true,
                    'eliminado' => false,
                    'fecha_creacion' => now(),
                    'fecha_actualizacion' => now()
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Venta registrada exitosamente',
                'data' => [
                    'cantidad_inversiones' => $inversiones->count(),
                    'inversiones_procesadas' => $inversiones->pluck('id_inversion')
                ]
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
     * Obtener el ID del estado VENDIDA_TOTAL del catálogo
     */
    private function getEstadoVendidaTotal()
    {
        $estado = \App\Models\CatalogoValor::where('codigo', 'VENDIDA_TOTAL')->first();
        return $estado ? $estado->id_catalogo_valor : null;
    }

    /**
     * Obtener instrumentos activos para venta
     */
    /**
     * Obtener posiciones vendibles (Instrumento + Propietario)
     * Consulta la vista vw_posiciones_vendibles que combina información de
     * Instrumento, Inversión y Propietario
     */
    public function getPosicionesVendibles()
    {
        $posiciones = \DB::table('vw_posiciones_vendibles')
            ->orderBy('nombre_propietario')
            ->orderBy('nombre_instrumento')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $posiciones
        ], Response::HTTP_OK);
    }

    /**
     * Obtener información detallada de un instrumento y propietario específicos
     * Incluye las inversiones activas asociadas a ese instrumento y propietario
     */
    public function getInfoPosicion($idInstrumento, $idPropietario)
    {
        $instrumento = \App\Models\Instrumento::with([
            'emisor',
            'tipoInversion',
            'inversiones' => function($query) use ($idPropietario) {
                $query->where('activo', true)
                      ->where('id_propietario', $idPropietario)
                      ->with('propietario', 'estadoInversion');
            }
        ])->find($idInstrumento);

        if (!$instrumento) {
            return response()->json([
                'success' => false,
                'message' => 'Instrumento no encontrado'
            ], Response::HTTP_NOT_FOUND);
        }

        $inversiones = $instrumento->inversiones;
        $valorNominalTotal = $inversiones->sum('valor_nominal');
        $capitalInvertidoTotal = $inversiones->sum('capital_invertido');
        $rendimientoPromedio = $valorNominalTotal > 0
            ? ($inversiones->sum(function($inv) {
                return $inv->valor_nominal * $inv->rendimiento_nominal;
            }) / $valorNominalTotal)
            : 0;

        return response()->json([
            'success' => true,
            'data' => [
                'instrumento' => $instrumento,
                'propietario' => $inversiones->first()->propietario ?? null,
                'resumen' => [
                    'valor_nominal_acumulado' => $valorNominalTotal,
                    'capital_invertido_acumulado' => $capitalInvertidoTotal,
                    'rendimiento_promedio' => $rendimientoPromedio,
                    'cantidad_inversiones' => $inversiones->count()
                ]
            ]
        ], Response::HTTP_OK);
    }

    /**
     * Obtener instrumentos activos
     * @deprecated - Usar getPosicionesVendibles en su lugar
     */
    public function getInstrumentosActivos()
    {
        $instrumentos = \App\Models\Instrumento::with(['emisor', 'tipoInversion'])
            ->where('activo', true)
            ->orderBy('nombre')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $instrumentos
        ], Response::HTTP_OK);
    }

    /**
     * Obtener información de instrumento activo para venta
     */
    public function getInfoInstrumento($idInstrumento)
    {
        $instrumento = \App\Models\Instrumento::with([
            'emisor',
            'tipoInversion',
            'inversiones' => function($query) {
                $query->where('activo', true)
                      ->with('propietario', 'estadoInversion');
            }
        ])->find($idInstrumento);

        if (!$instrumento) {
            return response()->json([
                'success' => false,
                'message' => 'Instrumento no encontrado'
            ], Response::HTTP_NOT_FOUND);
        }

        // Calcular resumen de inversiones
        $inversiones = $instrumento->inversiones;
        $valorNominalTotal = $inversiones->sum('valor_nominal');
        $capitalInvertidoTotal = $inversiones->sum('capital_invertido');
        $rendimientoPromedio = $valorNominalTotal > 0
            ? ($inversiones->sum(function($inv) {
                return $inv->valor_nominal * $inv->rendimiento_nominal;
            }) / $valorNominalTotal)
            : 0;

        return response()->json([
            'success' => true,
            'data' => [
                'instrumento' => $instrumento,
                'resumen' => [
                    'valor_nominal_acumulado' => $valorNominalTotal,
                    'capital_invertido_acumulado' => $capitalInvertidoTotal,
                    'rendimiento_promedio' => $rendimientoPromedio,
                    'cantidad_inversiones' => $inversiones->count()
                ]
            ]
        ], Response::HTTP_OK);
    }

    /**
     * Registrar venta de inversión de renta fija (método específico para pantalla de venta)
     */
    public function registrarVentaInversion(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_instrumento' => 'required|exists:instrumento,id_instrumento',
            'id_propietario' => 'nullable|exists:persona,id_persona',
            'tipo_venta' => 'required|in:TOTAL,PARCIAL',
            'fecha_venta' => 'required|date',
            'liquidacion_venta' => 'required|string|max:50',
            'precio_venta' => 'required|numeric',
            'precio_neto_venta' => 'nullable|numeric',
            'interes_previo' => 'required|numeric',
            'comision_operador' => 'required|numeric',
            'comision_bolsa' => 'required|numeric',
            'retenciones' => 'required|numeric',
            'observacion' => 'nullable|string',
            // Para venta parcial
            'porcentaje_vender' => 'nullable|numeric|min:0|max:100',
            'valor_nominal_vender' => 'nullable|numeric|min:0'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], Response::HTTP_BAD_REQUEST);
        }

        DB::beginTransaction();
        try {
            $instrumento = \App\Models\Instrumento::find($request->id_instrumento);
            if (!$instrumento) {
                return response()->json([
                    'success' => false,
                    'message' => 'Instrumento no encontrado'
                ], Response::HTTP_NOT_FOUND);
            }

            // Obtener inversiones activas del instrumento
            $query = Inversion::where('id_instrumento', $request->id_instrumento)
                ->where('activo', true)
                ->with('propietario', 'amortizaciones');

            if ($request->has('id_propietario') && $request->id_propietario) {
                $query->where('id_propietario', $request->id_propietario);
            }

            $inversiones = $query->get();

            if ($inversiones->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay inversiones activas para este instrumento'
                ], Response::HTTP_BAD_REQUEST);
            }

            $esVentaTotal = $request->tipo_venta === 'TOTAL';

            if ($esVentaTotal) {
                // VENTA TOTAL - Aplicar lógica a todas las inversiones
                $valorNominalVendidoTotal = $inversiones->sum('valor_nominal');
                foreach ($inversiones as $inversion) {
                    $this->procesarVentaTotal($inversion, $request, $valorNominalVendidoTotal);
                }
            } else {
                // VENTA PARCIAL - Implementar lógica de selección por rendimiento
                $resultado = $this->procesarVentaParcial($inversiones, $request);
                if (!$resultado['success']) {
                    return response()->json($resultado, Response::HTTP_BAD_REQUEST);
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Venta registrada exitosamente'
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
     * Procesar venta total de una inversión
     */
    private function procesarVentaTotal($inversion, $request, $valorNominalVendidoTotal = null)
    {
        if (is_null($valorNominalVendidoTotal) || $valorNominalVendidoTotal <= 0) {
            $valorNominalVendidoTotal = $inversion->valor_nominal;
        }

        $factor = $inversion->valor_nominal / $valorNominalVendidoTotal;

        // Prorratear comisiones y otros valores globales del request
        $comisionOperador = ($request->comision_operador ?? 0) * $factor;
        $comisionBolsa = ($request->comision_bolsa ?? 0) * $factor;
        $retenciones = ($request->retenciones ?? 0) * $factor;
        $interesPrevioVenta = ($request->interes_previo ?? 0) * $factor;

        // Calcular valores financieros
        $valorVentaSinComision = (($request->precio_venta ?? 0) * $inversion->valor_nominal) / 100;
        $valorVentaConComision = $valorVentaSinComision - $comisionOperador - $comisionBolsa;

        $utilidadSinComision = $valorVentaSinComision - ($inversion->valor_sin_comision ?? 0);
        $utilidadConComision = $valorVentaConComision - ($inversion->capital_invertido ?? 0);

        // Calcular días transcurridos
        $diasTranscurridos = 0;
        if ($inversion->fecha_compra) {
            $fechaCompra = \Carbon\Carbon::parse($inversion->fecha_compra);
            $fechaVenta = \Carbon\Carbon::parse($request->fecha_venta);
            $diasTranscurridos = $fechaCompra->diffInDays($fechaVenta);
        }

        // Calcular ROI
        $roi = ($inversion->capital_invertido > 0)
            ? ($utilidadConComision / $inversion->capital_invertido) * 100
            : 0;

        // Calcular ganancia anualizada
        $gananciaAnual = ($diasTranscurridos > 0)
            ? ($utilidadConComision / $diasTranscurridos) * 365
            : 0;

        // Obtener interés recibido (de amortizaciones pagadas)
        $interesRecibido = $inversion->amortizaciones->where('pagada', true)->sum('interes') ?? 0;
        $rendimientoTotal = $utilidadConComision + $interesRecibido + $interesPrevioVenta;

        // Paso 1: Actualizar estado de la inversión
        $inversion->update([
            'fecha_venta' => $request->fecha_venta,
            'id_estado_inversion' => $this->getEstadoVendidaTotal(),
            'activo' => false,
            'fecha_actualizacion' => now()
        ]);

        // Paso 2: Inactivar amortizaciones futuras
        \App\Models\Amortizacion::where('id_inversion', $inversion->id_inversion)
            ->where('fecha_pago', '>=', $request->fecha_venta)
            ->update([
                'activo' => false,
                'fecha_actualizacion' => now()
            ]);

        $valorRecibido = $valorVentaConComision + $interesPrevioVenta;
 
        // Paso 3: Crear registro en venta_inversion
        $venta = VentaInversion::create([
            'id_inversion' => $inversion->id_inversion,
            'id_instrumento' => $request->id_instrumento,
            'id_tipo_venta' => $this->getTipoVentaTotal(),
            'id_propietario' => $inversion->id_propietario,
            'porcentaje_vendido' => 100,
            'fecha_venta' => $request->fecha_venta,
            'liquidacion_venta' => $request->liquidacion_venta,
            'precio_venta' => $request->precio_venta ?? 0,
            'precio_neto_venta' => $request->precio_neto_venta ?? 0,
            'interes_previo_venta' => $interesPrevioVenta,
            'valor_venta_sin_comision' => $valorVentaSinComision,
            'comision_operador' => $comisionOperador,
            'comision_bolsa' => $comisionBolsa,
            'valor_venta_con_comision' => $valorVentaConComision,
            'valor_recibido' => $valorRecibido,
            'utilidad_sin_comision' => $utilidadSinComision,
            'utilidad_con_comision' => $utilidadConComision,
            'ganancia_perdida' => $utilidadConComision,
            'rendimiento_total' => $rendimientoTotal,
            'dias_transcurridos' => $diasTranscurridos,
            'roi' => $roi,
            'ganancia_anual' => $gananciaAnual,
            'retenciones' => $retenciones,
            'observacion' => $request->observacion,
            'activo' => true,
            'eliminado' => false,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);
 
        // Paso 4: Crear detalle
        VentaInversionDetalle::create([
            'id_venta_inversion' => $venta->id_venta_inversion,
            'id_inversion' => $inversion->id_inversion,
            'valor_nominal' => $inversion->valor_nominal,
            'valor_compra' => $inversion->capital_invertido,
            'porcentaje_compra' => 100,
            'valor_venta_asignado' => $valorVentaConComision,
            'porcentaje_venta' => 100,
            'utilidad' => $utilidadConComision,
            'rendimiento' => $roi,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);
 
        // Paso 5: Crear movimiento_capital
        $instrumento = \App\Models\Instrumento::find($inversion->id_instrumento);
        MovimientoCapital::create([
            'id_tipo_movimiento' => 182,
            'id_persona' => $inversion->id_propietario,
            'id_inversion' => $inversion->id_inversion,
            'id_venta_inversion' => $venta->id_venta_inversion,
            'id_cuenta_bancaria' => null,
            'id_signo' => 190,
            'monto' => $valorRecibido,
            'fecha_movimiento' => $request->fecha_venta,
            'descripcion' => 'Venta de ' . ($instrumento ? $instrumento->nombre : 'inversión'),
            'conciliado' => 0,
            'fecha_conciliacion' => null,
            'activo' => true,
            'eliminado' => false,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);
    }

    /**
     * Procesar venta parcial de inversiones
     */
    private function procesarVentaParcial($inversiones, $request)
    {
        // Ordenar por rendimiento (menor a mayor)
        $inversionesOrdenadas = $inversiones->sortBy('rendimiento_efectivo');

        // Calcular valor a vender
        $valorNominalVender = $request->valor_nominal_vender;
        if ($request->porcentaje_vender) {
            $valorNominalTotal = $inversionesOrdenadas->sum('valor_nominal');
            $valorNominalVender = ($valorNominalTotal * $request->porcentaje_vender) / 100;
        }

        if (!$valorNominalVender || $valorNominalVender <= 0) {
            return [
                'success' => false,
                'message' => 'Debe especificar el valor a vender'
            ];
        }

        $valorRestante = $valorNominalVender;

        foreach ($inversionesOrdenadas as $inversion) {
            if ($valorRestante <= 0) break;

            // Calcular porcentaje de esta inversión a vender
            $porcentajeVenderInversion = min(100, ($valorRestante / $inversion->valor_nominal) * 100);

            if ($porcentajeVenderInversion >= 100) {
                // Vender toda esta inversión
                $this->procesarVentaTotal($inversion, $request, $valorNominalVender);
                $valorRestante -= $inversion->valor_nominal;
            } else {
                // Venta parcial de esta inversión
                $this->procesarVentaParcialInversion($inversion, $porcentajeVenderInversion, $request, $valorNominalVender);
                $valorRestante -= ($inversion->valor_nominal * $porcentajeVenderInversion / 100);
            }
        }

        return ['success' => true];
    }

    /**
     * Procesar venta parcial de una inversión individual
     */
    private function procesarVentaParcialInversion($inversion, $porcentajeVender, $request, $valorNominalVendidoTotal = null)
    {
        $nominalVendido = ($inversion->valor_nominal * $porcentajeVender) / 100;

        if (is_null($valorNominalVendidoTotal) || $valorNominalVendidoTotal <= 0) {
            $valorNominalVendidoTotal = $nominalVendido;
        }

        $factor = $nominalVendido / $valorNominalVendidoTotal;

        // Prorratear comisiones y otros valores globales del request
        $comisionOperador = ($request->comision_operador ?? 0) * $factor;
        $comisionBolsa = ($request->comision_bolsa ?? 0) * $factor;
        $retenciones = ($request->retenciones ?? 0) * $factor;
        $interesPrevioVenta = ($request->interes_previo ?? 0) * $factor;

        // Calcular valores financieros
        $valorVentaSinComision = (($request->precio_venta ?? 0) * $nominalVendido) / 100;
        $valorVentaConComision = $valorVentaSinComision - $comisionOperador - $comisionBolsa;

        // Paso 1: Cerrar inversión original
        $inversion->update([
            'fecha_venta' => $request->fecha_venta,
            'id_estado_inversion' => $this->getEstadoVendidaTotal(),
            'activo' => false,
            'fecha_actualizacion' => now()
        ]);

        // Paso 3: Crear inversión derivada parte vendida
        $inversionVendida = $this->crearInversionDerivada($inversion, $porcentajeVender, 'VENDIDA_TOTAL', false);

        // Paso 4: Crear inversión derivada parte remanente
        $porcentajeRemanente = 100 - $porcentajeVender;
        $inversionRemanente = $this->crearInversionDerivada($inversion, $porcentajeRemanente, 'ACTIVA', true);

        // Paso 5: Generar nuevas tablas de amortización prorrateadas y anular la original
        $this->generarTablasAmortizacionVentaParcial($inversion, $inversionVendida, $inversionRemanente, $porcentajeVender, $request->fecha_venta);

        $utilidadSinComision = $valorVentaSinComision - ($inversionVendida->valor_sin_comision ?? 0);
        $utilidadConComision = $valorVentaConComision - ($inversionVendida->capital_invertido ?? 0);

        // Calcular días transcurridos
        $diasTranscurridos = 0;
        if ($inversionVendida->fecha_compra) {
            $fechaCompra = \Carbon\Carbon::parse($inversionVendida->fecha_compra);
            $fechaVenta = \Carbon\Carbon::parse($request->fecha_venta);
            $diasTranscurridos = $fechaCompra->diffInDays($fechaVenta);
        }

        // Calcular ROI
        $roi = ($inversionVendida->capital_invertido > 0)
            ? ($utilidadConComision / $inversionVendida->capital_invertido) * 100
            : 0;

        // Calcular ganancia anualizada
        $gananciaAnual = ($diasTranscurridos > 0)
            ? ($utilidadConComision / $diasTranscurridos) * 365
            : 0;

        // Obtener interés recibido (proporcional al porcentaje vendido)
        $interesRecibido = (($inversion->amortizaciones->where('pagada', true)->sum('interes') ?? 0) * $porcentajeVender) / 100;
        $rendimientoTotal = $utilidadConComision + $interesRecibido + $interesPrevioVenta;
        $valorRecibido = $valorVentaConComision + $interesPrevioVenta;
 
        // Paso 6: Crear venta
        $venta = VentaInversion::create([
            'id_inversion' => $inversionVendida->id_inversion,
            'id_instrumento' => $request->id_instrumento,
            'id_tipo_venta' => $this->getTipoVentaParcial(),
            'id_propietario' => $inversion->id_propietario,
            'porcentaje_vendido' => $porcentajeVender,
            'fecha_venta' => $request->fecha_venta,
            'liquidacion_venta' => $request->liquidacion_venta,
            'precio_venta' => $request->precio_venta ?? 0,
            'precio_neto_venta' => $request->precio_neto_venta ?? 0,
            'interes_previo_venta' => $interesPrevioVenta,
            'valor_venta_sin_comision' => $valorVentaSinComision,
            'comision_operador' => $comisionOperador,
            'comision_bolsa' => $comisionBolsa,
            'valor_venta_con_comision' => $valorVentaConComision,
            'valor_recibido' => $valorRecibido,
            'utilidad_sin_comision' => $utilidadSinComision,
            'utilidad_con_comision' => $utilidadConComision,
            'ganancia_perdida' => $utilidadConComision,
            'rendimiento_total' => $rendimientoTotal,
            'dias_transcurridos' => $diasTranscurridos,
            'roi' => $roi,
            'ganancia_anual' => $gananciaAnual,
            'retenciones' => $retenciones,
            'observacion' => $request->observacion,
            'activo' => true,
            'eliminado' => false,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);
 
        // Paso 7: Crear movimiento_capital (solo de la parte vendida)
        MovimientoCapital::create([
            'id_tipo_movimiento' => 182,
            'id_persona' => $inversion->id_propietario,
            'id_inversion' => $inversionVendida->id_inversion,
            'id_venta_inversion' => $venta->id_venta_inversion,
            'id_cuenta_bancaria' => null,
            'id_signo' => 190,
            'monto' => $valorRecibido,
            'fecha_movimiento' => $request->fecha_venta,
            'descripcion' => 'Venta parcial de ' . ($inversion->instrumento->nombre ?? 'inversión'),
            'conciliado' => 0,
            'fecha_conciliacion' => null,
            'activo' => true,
            'eliminado' => false,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);

        // Paso 8: Crear relaciones en inversion_relacion_venta
        $tipoParteVendida = \App\Models\CatalogoValor::where('codigo', 'PARTE_VENDIDA')->first();
        $tipoParteRemanente = \App\Models\CatalogoValor::where('codigo', 'PARTE_REMANENTE')->first();

        if ($tipoParteVendida) {
            \App\Models\InversionRelacionVenta::create([
                'id_inversion_original' => $inversion->id_inversion,
                'id_inversion_generada' => $inversionVendida->id_inversion,
                'id_venta_inversion' => $venta->id_venta_inversion,
                'id_tipo_relacion' => $tipoParteVendida->id_catalogo_valor,
                'porcentaje_asignado' => $porcentajeVender,
                'valor_nominal_asignado' => $inversionVendida->valor_nominal,
                'activo' => true,
                'eliminado' => false,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);
        }

        if ($tipoParteRemanente) {
            \App\Models\InversionRelacionVenta::create([
                'id_inversion_original' => $inversion->id_inversion,
                'id_inversion_generada' => $inversionRemanente->id_inversion,
                'id_venta_inversion' => $venta->id_venta_inversion,
                'id_tipo_relacion' => $tipoParteRemanente->id_catalogo_valor,
                'porcentaje_asignado' => $porcentajeRemanente,
                'valor_nominal_asignado' => $inversionRemanente->valor_nominal,
                'activo' => true,
                'eliminado' => false,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);
        }
    }

    /**
     * Crear inversión derivada (parte vendida o remanente)
     */
    private function crearInversionDerivada($inversionOriginal, $porcentaje, $estado, $requiereAmortizacion)
    {
        $datos = [
            'id_grupo_familiar' => $inversionOriginal->id_grupo_familiar,
            'id_instrumento' => $inversionOriginal->id_instrumento,
            'id_propietario' => $inversionOriginal->id_propietario,
            'id_aportante' => $inversionOriginal->id_aportante,
            'liquidacion' => $inversionOriginal->liquidacion,
            'id_estado_inversion' => $this->getEstadoByCodigo($estado),
            'fecha_compra' => $inversionOriginal->fecha_compra, // Conservar fecha original
            'fecha_venta' => $estado === 'VENDIDA_TOTAL' ? $inversionOriginal->fecha_venta : null,
            'valor_nominal' => ($inversionOriginal->valor_nominal * $porcentaje) / 100,
            'monto_a_negociar' => ($inversionOriginal->monto_a_negociar * $porcentaje) / 100,
            'capital_invertido' => ($inversionOriginal->capital_invertido * $porcentaje) / 100,
            'tasa_interes' => $inversionOriginal->tasa_interes,
            'rendimiento_nominal' => $inversionOriginal->rendimiento_nominal,
            'rendimiento_efectivo' => $inversionOriginal->rendimiento_efectivo,
            'valor_efectivo' => ($inversionOriginal->valor_efectivo * $porcentaje) / 100,
            'valor_sin_comision' => ($inversionOriginal->valor_sin_comision * $porcentaje) / 100,
            'valor_con_interes' => ($inversionOriginal->valor_con_interes * $porcentaje) / 100,
            'interes_acumulado_previo' => ($inversionOriginal->interes_acumulado_previo * $porcentaje) / 100,
            'interes_mensual' => ($inversionOriginal->interes_mensual * $porcentaje) / 100,
            'interes_primer_mes' => ($inversionOriginal->interes_primer_mes * $porcentaje) / 100,
            'total_comisiones' => ($inversionOriginal->total_comisiones * $porcentaje) / 100,
            'tasa_mensual_real' => $inversionOriginal->tasa_mensual_real,
            'fecha_primer_pago' => $inversionOriginal->fecha_primer_pago,
            'precio_compra' => $inversionOriginal->precio_compra,
            'precio_neto_compra' => $inversionOriginal->precio_neto_compra,
            'comision_bolsa' => ($inversionOriginal->comision_bolsa * $porcentaje) / 100,
            'comision_casa_valores' => ($inversionOriginal->comision_casa_valores * $porcentaje) / 100,
            'retencion_fuente' => ($inversionOriginal->retencion_fuente * $porcentaje) / 100,
            'observacion' => 'Inversión derivada de venta parcial - ' . $estado,
            'expirado' => $inversionOriginal->expirado,
            'activo' => $estado === 'ACTIVA',
            'eliminado' => false,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ];

        return Inversion::create($datos);
    }

    /**
     * Generar las dos nuevas tablas de amortización prorrateadas (Vendida y Remanente)
     * y anular las cuotas de la inversión original.
     */
    private function generarTablasAmortizacionVentaParcial($inversionOriginal, $inversionVendida, $inversionRemanente, $porcentajeVender, $fechaVenta)
    {
        // 1. Obtener todas las cuotas de la inversión original ordenadas por fecha y ID
        $amortizacionesOriginales = \App\Models\Amortizacion::where('id_inversion', $inversionOriginal->id_inversion)
            ->orderBy('fecha_pago', 'asc')
            ->orderBy('id_amortizacion', 'asc')
            ->get();

        $porcentajeRemanente = 100 - $porcentajeVender;
        $fechaVentaCarbon = \Carbon\Carbon::parse($fechaVenta)->startOfDay();

        foreach ($amortizacionesOriginales as $amortizacionOriginal) {
            // Prorratear valores financieros garantizando que la suma coincida exactamente con la original
            // Se calcula la parte vendida y el remanente es la diferencia para evitar descuadres por redondeo.
            
            $interesVendido = round(($amortizacionOriginal->interes * $porcentajeVender) / 100, 2);
            $interesRemanente = $amortizacionOriginal->interes - $interesVendido;

            $capitalVendido = round(($amortizacionOriginal->capital * $porcentajeVender) / 100, 2);
            $capitalRemanente = $amortizacionOriginal->capital - $capitalVendido;

            $descuentoVendido = round(($amortizacionOriginal->descuento * $porcentajeVender) / 100, 2);
            $descuentoRemanente = $amortizacionOriginal->descuento - $descuentoVendido;

            $totalVendido = round(($amortizacionOriginal->total * $porcentajeVender) / 100, 2);
            $totalRemanente = $amortizacionOriginal->total - $totalVendido;

            $intParcialVendido = round(($amortizacionOriginal->int_parcial * $porcentajeVender) / 100, 2);
            $intParcialRemanente = $amortizacionOriginal->int_parcial - $intParcialVendido;

            $retencionVendido = round(($amortizacionOriginal->retencion * $porcentajeVender) / 100, 2);
            $retencionRemanente = $amortizacionOriginal->retencion - $retencionVendido;

            $fechaPagoCarbon = \Carbon\Carbon::parse($amortizacionOriginal->fecha_pago)->startOfDay();

            // 2. Crear cuota en la tabla de Amortización de la Parte Vendida (solo si fecha_pago <= fecha_venta)
            if ($fechaPagoCarbon->lte($fechaVentaCarbon)) {
                \App\Models\Amortizacion::create([
                    'id_inversion' => $inversionVendida->id_inversion,
                    'numero_cuota' => $amortizacionOriginal->numero_cuota,
                    'fecha_pago' => $amortizacionOriginal->fecha_pago,
                    'interes' => $interesVendido,
                    'capital' => $capitalVendido,
                    'descuento' => $descuentoVendido,
                    'total' => $totalVendido,
                    'int_parcial' => $intParcialVendido,
                    'retencion' => $retencionVendido,
                    'id_estado_amortizacion' => $amortizacionOriginal->id_estado_amortizacion,
                    'pagada' => $amortizacionOriginal->pagada,
                    'activo' => $amortizacionOriginal->activo,
                    'eliminado' => $amortizacionOriginal->eliminado,
                    'fecha_creacion' => now(),
                    'fecha_actualizacion' => now()
                ]);
            }

            // 3. Crear cuota en la tabla de Amortización de la Parte Remanente (siempre, para todas las cuotas)
            \App\Models\Amortizacion::create([
                'id_inversion' => $inversionRemanente->id_inversion,
                'numero_cuota' => $amortizacionOriginal->numero_cuota,
                'fecha_pago' => $amortizacionOriginal->fecha_pago,
                'interes' => $interesRemanente,
                'capital' => $capitalRemanente,
                'descuento' => $descuentoRemanente,
                'total' => $totalRemanente,
                'int_parcial' => $intParcialRemanente,
                'retencion' => $retencionRemanente,
                'id_estado_amortizacion' => $amortizacionOriginal->id_estado_amortizacion,
                'pagada' => $amortizacionOriginal->pagada,
                'activo' => $amortizacionOriginal->activo,
                'eliminado' => $amortizacionOriginal->eliminado,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);
        }

        // 4. Actualizar todas las cuotas de la amortización original a id_estado_amortizacion = 200 y activo = false
        \App\Models\Amortizacion::where('id_inversion', $inversionOriginal->id_inversion)
            ->update([
                'id_estado_amortizacion' => 200,
                'activo' => false,
                'fecha_actualizacion' => now()
            ]);
    }

    /**
     * Obtener ID del estado por código
     */
    private function getEstadoByCodigo($codigo)
    {
        $estado = \App\Models\CatalogoValor::where('codigo', $codigo)->first();
        return $estado ? $estado->id_catalogo_valor : null;
    }

    /**
     * Obtener ID del tipo de venta TOTAL
     */
    private function getTipoVentaTotal()
    {
        $tipo = \App\Models\CatalogoValor::where('codigo', 'TOTAL')->first();
        return $tipo ? $tipo->id_catalogo_valor : null;
    }

    /**
     * Obtener ID del tipo de venta PARCIAL
     */
    private function getTipoVentaParcial()
    {
        $tipo = \App\Models\CatalogoValor::where('codigo', 'PARCIAL')->first();
        return $tipo ? $tipo->id_catalogo_valor : null;
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
            'comision_operador' => 'nullable|numeric',
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
                'comision_operador' => $request->comision_operador,
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
            'id_persona' => 'required|exists:persona,id_persona',
            'precio' => 'nullable|numeric|min:0|max:100',
            'precio_neto' => 'nullable|numeric',
            'valor_total_recibido' => 'nullable|numeric|min:0',
            'valor_efectivo' => 'nullable|numeric|min:0',
            'utilidad_sin_comision' => 'nullable|numeric',
            'utilidad_con_comision' => 'nullable|numeric',
            'ganancia_perdida' => 'nullable|numeric',
            'rendimiento_total' => 'nullable|numeric',
            'dias_transcurridos' => 'nullable|numeric|min:0',
            'roi' => 'nullable|numeric',
            'ganancia_anual' => 'nullable|numeric',
            'fecha_venta' => 'required|date',
            'liquidacion_venta' => 'nullable|string|max:50',
            'comision_operador' => 'nullable|numeric|min:0',
            'comision_bolsa' => 'nullable|numeric|min:0',
            'observacion' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Mapear id_persona a id_propietario para consistencia con la base de datos
        $request->merge(['id_propietario' => $request->id_persona]);

        // Detectar inversiones con propietarios diferentes al seleccionado
        $inversiones = Inversion::whereIn('id_inversion', $request->inversiones)
            ->with('propietario')
            ->get();

        $inversionesReasignar = [];
        foreach ($inversiones as $inv) {
            if ($inv->id_propietario != $request->id_persona) {
                $inversionesReasignar[] = [
                    'id_inversion' => $inv->id_inversion,
                    'id_propietario_anterior' => $inv->id_propietario,
                    'id_propietario_nuevo' => $request->id_persona,
                    'propietario_anterior_nombre' => $inv->propietario ? $inv->propietario->nombre : 'Desconocido'
                ];
            }
        }

        // Validar que se proporcione precio
        if (!$request->precio || $request->precio <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'El precio debe ser mayor a 0'
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        DB::beginTransaction();
        try {
            // Usar el servicio de cálculo para obtener la distribución
            $distribucion = $this->ventaCalculator->calcularDistribucionVenta(
                $request->inversiones,
                $request->precio ?? 0,
                $request->valor_total_recibido ?? 0,
                $request->comision_operador ?? 0,
                $request->comision_bolsa ?? 0,
                $request->id_persona
            );

            if (!$distribucion['success']) {
                return response()->json($distribucion, Response::HTTP_BAD_REQUEST);
            }

            $data = $distribucion['data'];
            $resumenCompra = $data['resumen_compra'];

            // STEP 1 & 2: Reasignar propietarios si es necesario y crear logs
            $usuarioReasignacion = auth()->user()->name ?? 'sistema';
            foreach ($inversionesReasignar as $reasignacion) {
                // Obtener capital_invertido de la inversión
                $inversion = Inversion::find($reasignacion['id_inversion']);
                $capitalInvertido = $inversion ? $inversion->capital_invertido : 0;

                // Insertar log de reasignación
                InversionPropietarioReasignacionLog::create([
                    'id_inversion' => $reasignacion['id_inversion'],
                    'id_venta_inversion' => null, // Se actualizará después de crear la venta
                    'id_propietario_anterior' => $reasignacion['id_propietario_anterior'],
                    'id_propietario_nuevo' => $reasignacion['id_propietario_nuevo'],
                    'motivo' => 'Reasignación automática por venta agrupada de notas de crédito',
                    'observacion' => 'Reasignación previa a confirmación de venta agrupada',
                    'usuario_reasignacion' => $usuarioReasignacion,
                    'fecha_reasignacion' => now()
                ]);
/*
                // STEP 2.1: Crear movimiento positivo para el nuevo propietario (recibe nota de crédito)
                MovimientoCapital::create([
                    'id_tipo_movimiento' => 183,
                    'id_persona' => $reasignacion['id_propietario_nuevo'],
                    'id_inversion' => $reasignacion['id_inversion'],
                    'id_venta_inversion' => null, // Se actualizará después de crear la venta
                    'id_cuenta_bancaria' => null,
                    'id_signo' => 190, // Positivo
                    'monto' => $capitalInvertido,
                    'fecha_movimiento' => now(),
                    'descripcion' => 'Recibe nota de crédito',
                    'conciliado' => 1,
                    'fecha_conciliacion' => now(),
                    'activo' => 1,
                    'eliminado' => 0,
                    'fecha_creacion' => now(),
                    'fecha_actualizacion' => now()
                ]);

                // STEP 2.2: Crear movimiento negativo para el propietario anterior (entrega nota de crédito)
                MovimientoCapital::create([
                    'id_tipo_movimiento' => 184,
                    'id_persona' => $reasignacion['id_propietario_anterior'],
                    'id_inversion' => $reasignacion['id_inversion'],
                    'id_venta_inversion' => null, // Se actualizará después de crear la venta
                    'id_cuenta_bancaria' => null,
                    'id_signo' => 191, // Negativo
                    'monto' => $capitalInvertido,
                    'fecha_movimiento' => now(),
                    'descripcion' => 'Entrega nota de crédito',
                    'conciliado' => 1,
                    'fecha_conciliacion' => now(),
                    'activo' => 1,
                    'eliminado' => 0,
                    'fecha_creacion' => now(),
                    'fecha_actualizacion' => now()
                ]);
*/
                // STEP 3: Actualizar propietario de la inversión
                Inversion::where('id_inversion', $reasignacion['id_inversion'])
                    ->update([
                        'id_propietario' => $reasignacion['id_propietario_nuevo'],
                        'fecha_actualizacion' => now()
                    ]);
            }

            // STEP 4: Crear venta principal
            // Calcular comision_operador: suma de comisiones operador de las inversiones seleccionadas + comisión operador de la venta
            $comisionesSantaFe = 0;
            foreach ($inversiones as $inv) {
                if (isset($inv->comision_operador)) {
                    $comisionesSantaFe += $inv->comision_operador;
                }
            }
            $comisionesSantaFe += $request->comision_operador ?? 0;

            $venta = VentaInversion::create([
                'id_inversion' => null, // NULL para ventas agrupadas
                'id_instrumento' => 222, // Notas de Crédito
                'id_tipo_venta' => 195, // Venta Agrupada
                'id_propietario' => $request->id_persona,
                'porcentaje_vendido' => 100.00, // Siempre 100 para ventas agrupadas
                'fecha_venta' => $request->fecha_venta,
                'liquidacion_venta' => $request->liquidacion_venta,
                'precio_venta' => $request->precio ?? 0,
                'precio_neto_venta' => $request->precio_neto ?? 0,
                'interes_previo_venta' => 0.00,
                'valor_venta_sin_comision' => $request->valor_efectivo ?? 0,
                'comision_operador' => $request->comision_operador ?? 0,
                'comision_bolsa' => $request->comision_bolsa ?? 0,
                'valor_venta_con_comision' => $request->valor_total_recibido ?? 0,
                'utilidad_sin_comision' => $request->utilidad_sin_comision ?? 0,
                'utilidad_con_comision' => $request->utilidad_con_comision ?? 0,
                'ganancia_perdida' => $request->ganancia_perdida ?? 0,
                'rendimiento_total' => $request->rendimiento_total ?? 0,
                'dias_transcurridos' => $request->dias_transcurridos ?? 0,
                'roi' => $request->roi ?? 0,
                'ganancia_anual' => $request->ganancia_anual ?? 0,
                'comision_operador' => $comisionesSantaFe,
                'retenciones' => 0.00,
                'observacion' => $request->observacion,
                'activo' => true,
                'eliminado' => false,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);

            // Actualizar logs de reasignación con el ID de venta
            if (!empty($inversionesReasignar)) {
                InversionPropietarioReasignacionLog::whereIn('id_inversion', array_column($inversionesReasignar, 'id_inversion'))
                    ->whereNull('id_venta_inversion')
                    ->update(['id_venta_inversion' => $venta->id_venta_inversion]);

                // Actualizar movimientos de capital de reasignación con el ID de venta
                MovimientoCapital::whereIn('id_inversion', array_column($inversionesReasignar, 'id_inversion'))
                    ->whereNull('id_venta_inversion')
                    ->whereIn('id_tipo_movimiento', [183, 184]) // Solo movimientos de reasignación
                    ->update(['id_venta_inversion' => $venta->id_venta_inversion]);
            }

            // STEP 5: Crear detalles para cada inversión
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

            // STEP 6: Crear movimiento de capital contable para la venta agrupada
            MovimientoCapital::create([
                'id_tipo_movimiento' => 182,
                'id_persona' => $request->id_persona,
                'id_inversion' => null, // NULL para ventas agrupadas
                'id_venta_inversion' => $venta->id_venta_inversion,
                'id_cuenta_bancaria' => null, // NULL ya que no está vinculado a cuenta bancaria
                'id_signo' => 190, // Movimiento positivo
                'monto' => $data['valor_neto_recibido'],
                'fecha_movimiento' => $request->fecha_venta,
                'descripcion' => 'Venta Nota de Crédito',
                'conciliado' => 0,
                'fecha_conciliacion' => null,
                'activo' => 1,
                'eliminado' => 0,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Venta agrupada registrada exitosamente',
                'data' => [
                    'venta' => $venta->load(['detalles.inversion', 'persona']),
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
            'id_persona' => 'nullable|exists:persona,id_persona',
            'precio' => 'nullable|numeric|min:0|max:100',
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
            $request->precio,
            $request->valor_total_recibido,
            $request->comision_operador ?? 0,
            $request->comision_bolsa ?? 0,
            $request->id_persona
        );

        return response()->json($resultado, $resultado['success'] ? Response::HTTP_OK : Response::HTTP_BAD_REQUEST);
    }
}


