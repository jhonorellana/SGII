<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\AccionOperacion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AccionAnalisisVentasController extends Controller
{
    /**
     * Reporte y Análisis detallado de Ventas de Acciones (Realizadas).
     */
    public function index(Request $request)
    {
        try {
            // Cargar todas las operaciones de renta variable ordenadas cronológicamente para reconstruir el costo promedio ponderado
            $operaciones = AccionOperacion::with(['instrumento.emisor', 'persona', 'tipoOperacion'])
                ->where('activo', 1)
                ->where('eliminado', 0)
                ->orderBy('fecha_operacion', 'asc')
                ->orderBy('id_accion_operacion', 'asc')
                ->get();

            $costos = [];
            $ventas = [];

            // Resumen acumulado de ventas filtradas
            $summary = [
                'total_ventas_count' => 0,
                'total_cantidad_vendida' => 0.0,
                'total_valor_bruto' => 0.0,
                'total_comisiones' => 0.0,
                'total_valor_neto' => 0.0,
                'total_costo_base' => 0.0,
                'total_utilidad_perdida' => 0.0,
                'roi_promedio_ponderado' => 0.0,
                'ventas_ganancia_count' => 0,
                'ventas_perdida_count' => 0,
                'ventas_neutra_count' => 0
            ];

            // Datos estructurados para gráficos
            $agrupadoEmisor = [];
            $agrupadoSocio = [];
            $agrupadoAnio = [];

            foreach ($operaciones as $op) {
                $key = $op->id_persona . '_' . $op->id_instrumento;

                if (!isset($costos[$key])) {
                    $costos[$key] = [
                        'cantidad_acumulada' => 0.0,
                        'costo_total_acumulado' => 0.0,
                        'costo_promedio_unitario' => 0.0
                    ];
                }

                $tipoOp = (int)$op->id_tipo_operacion;
                $cant = (float)$op->cantidad;
                $neto = (float)$op->valor_neto;
                $bruto = (float)$op->valor_bruto;
                $comisiones = (float)($op->total_comisiones ?? 0);

                // Compra (204) o Suscripción de acciones (232)
                if ($tipoOp === 204 || $tipoOp === 232) {
                    $costos[$key]['cantidad_acumulada'] += $cant;
                    $costos[$key]['costo_total_acumulado'] += $neto;
                    if ($costos[$key]['cantidad_acumulada'] > 0) {
                        $costos[$key]['costo_promedio_unitario'] = $costos[$key]['costo_total_acumulado'] / $costos[$key]['cantidad_acumulada'];
                    }
                }
                // Dividendo en Acciones/Bonificación (206), Ajuste Positivo (207), Split (212)
                elseif ($tipoOp === 206 || $tipoOp === 207 || $tipoOp === 212) {
                    $costos[$key]['cantidad_acumulada'] += $cant;
                    if ($costos[$key]['cantidad_acumulada'] > 0) {
                        $costos[$key]['costo_promedio_unitario'] = $costos[$key]['costo_total_acumulado'] / $costos[$key]['cantidad_acumulada'];
                    }
                }
                // Venta de Acciones (205)
                elseif ($tipoOp === 205) {
                    $cpuPrevio = $costos[$key]['costo_promedio_unitario'];
                    $costoBaseTotal = $cant * $cpuPrevio;
                    $utilidadPerdida = $neto - $costoBaseTotal;
                    $roiPct = $costoBaseTotal > 0 ? ($utilidadPerdida / $costoBaseTotal) * 100 : 0.0;

                    // Actualizar posición acumulada
                    $costos[$key]['cantidad_acumulada'] -= $cant;
                    $costos[$key]['costo_total_acumulado'] -= $costoBaseTotal;

                    if ($costos[$key]['cantidad_acumulada'] <= 0) {
                        $costos[$key]['cantidad_acumulada'] = 0.0;
                        $costos[$key]['costo_total_acumulado'] = 0.0;
                        $costos[$key]['costo_promedio_unitario'] = 0.0;
                    } else {
                        $costos[$key]['costo_promedio_unitario'] = $cpuPrevio;
                    }

                    // Verificar filtros solicitados
                    $fechaOp = $op->fecha_operacion ? $op->fecha_operacion->format('Y-m-d') : null;
                    $idEmisor = $op->instrumento ? $op->instrumento->id_emisor : null;

                    if ($request->has('id_persona') && $request->id_persona && (int)$request->id_persona !== (int)$op->id_persona) {
                        continue;
                    }
                    if ($request->has('id_instrumento') && $request->id_instrumento && (int)$request->id_instrumento !== (int)$op->id_instrumento) {
                        continue;
                    }
                    if ($request->has('id_emisor') && $request->id_emisor && (int)$request->id_emisor !== (int)$idEmisor) {
                        continue;
                    }
                    if ($request->has('fecha_desde') && $request->fecha_desde && $fechaOp < $request->fecha_desde) {
                        continue;
                    }
                    if ($request->has('fecha_hasta') && $request->fecha_hasta && $fechaOp > $request->fecha_hasta) {
                        continue;
                    }

                    $emisorNombre = $op->instrumento && $op->instrumento->emisor ? $op->instrumento->emisor->nombre : ($op->instrumento->nombre ?? 'N/A');
                    $socioNombre = $op->persona ? $op->persona->nombre : 'N/A';
                    $anio = $fechaOp ? (int)substr($fechaOp, 0, 4) : 'N/A';

                    $ventaItem = [
                        'id_accion_operacion' => $op->id_accion_operacion,
                        'fecha_operacion' => $fechaOp,
                        'id_persona' => $op->id_persona,
                        'socio_nombre' => $socioNombre,
                        'id_instrumento' => $op->id_instrumento,
                        'instrumento_nombre' => $op->instrumento ? $op->instrumento->nombre : 'N/A',
                        'id_emisor' => $idEmisor,
                        'emisor_nombre' => $emisorNombre,
                        'cantidad' => $cant,
                        'precio_unitario' => (float)$op->precio_unitario,
                        'valor_bruto' => $bruto,
                        'total_comisiones' => $comisiones,
                        'valor_neto' => $neto,
                        'costo_promedio_unitario' => $cpuPrevio,
                        'costo_base_total' => $costoBaseTotal,
                        'utilidad_perdida' => $utilidadPerdida,
                        'roi_porcentaje' => $roiPct,
                        'liquidacion' => $op->liquidacion,
                        'observacion' => $op->observacion
                    ];

                    $ventas[] = $ventaItem;

                    // Acumular Totales
                    $summary['total_ventas_count']++;
                    $summary['total_cantidad_vendida'] += $cant;
                    $summary['total_valor_bruto'] += $bruto;
                    $summary['total_comisiones'] += $comisiones;
                    $summary['total_valor_neto'] += $neto;
                    $summary['total_costo_base'] += $costoBaseTotal;
                    $summary['total_utilidad_perdida'] += $utilidadPerdida;

                    if ($utilidadPerdida > 0.01) {
                        $summary['ventas_ganancia_count']++;
                    } elseif ($utilidadPerdida < -0.01) {
                        $summary['ventas_perdida_count']++;
                    } else {
                        $summary['ventas_neutra_count']++;
                    }

                    // Agrupar por Emisor
                    if (!isset($agrupadoEmisor[$emisorNombre])) {
                        $agrupadoEmisor[$emisorNombre] = [
                            'emisor' => $emisorNombre,
                            'ventas_count' => 0,
                            'valor_neto' => 0.0,
                            'costo_base' => 0.0,
                            'utilidad_perdida' => 0.0
                        ];
                    }
                    $agrupadoEmisor[$emisorNombre]['ventas_count']++;
                    $agrupadoEmisor[$emisorNombre]['valor_neto'] += $neto;
                    $agrupadoEmisor[$emisorNombre]['costo_base'] += $costoBaseTotal;
                    $agrupadoEmisor[$emisorNombre]['utilidad_perdida'] += $utilidadPerdida;

                    // Agrupar por Socio
                    if (!isset($agrupadoSocio[$socioNombre])) {
                        $agrupadoSocio[$socioNombre] = [
                            'socio' => $socioNombre,
                            'ventas_count' => 0,
                            'valor_neto' => 0.0,
                            'costo_base' => 0.0,
                            'utilidad_perdida' => 0.0
                        ];
                    }
                    $agrupadoSocio[$socioNombre]['ventas_count']++;
                    $agrupadoSocio[$socioNombre]['valor_neto'] += $neto;
                    $agrupadoSocio[$socioNombre]['costo_base'] += $costoBaseTotal;
                    $agrupadoSocio[$socioNombre]['utilidad_perdida'] += $utilidadPerdida;

                    // Agrupar por Año
                    if (!isset($agrupadoAnio[$anio])) {
                        $agrupadoAnio[$anio] = [
                            'anio' => $anio,
                            'ventas_count' => 0,
                            'valor_neto' => 0.0,
                            'costo_base' => 0.0,
                            'utilidad_perdida' => 0.0
                        ];
                    }
                    $agrupadoAnio[$anio]['ventas_count']++;
                    $agrupadoAnio[$anio]['valor_neto'] += $neto;
                    $agrupadoAnio[$anio]['costo_base'] += $costoBaseTotal;
                    $agrupadoAnio[$anio]['utilidad_perdida'] += $utilidadPerdida;
                }
                // Ajuste Negativo (208)
                elseif ($tipoOp === 208) {
                    $cpuPrevio = $costos[$key]['costo_promedio_unitario'];
                    $costos[$key]['cantidad_acumulada'] -= $cant;
                    $costos[$key]['costo_total_acumulado'] -= ($cant * $cpuPrevio);

                    if ($costos[$key]['cantidad_acumulada'] <= 0) {
                        $costos[$key]['cantidad_acumulada'] = 0.0;
                        $costos[$key]['costo_total_acumulado'] = 0.0;
                        $costos[$key]['costo_promedio_unitario'] = 0.0;
                    } else {
                        $costos[$key]['costo_promedio_unitario'] = $cpuPrevio;
                    }
                }
            }

            // Ordenar las ventas de más reciente a más antigua
            usort($ventas, function ($a, $b) {
                return strcmp($b['fecha_operacion'], $a['fecha_operacion']) ?: ($b['id_accion_operacion'] <=> $a['id_accion_operacion']);
            });

            // Calcular ROI promedio ponderado global
            if ($summary['total_costo_base'] > 0) {
                $summary['roi_promedio_ponderado'] = ($summary['total_utilidad_perdida'] / $summary['total_costo_base']) * 100;
            }

            // Formatear arrays de gráficos
            $emisorList = array_values($agrupadoEmisor);
            foreach ($emisorList as &$e) {
                $e['roi_pct'] = $e['costo_base'] > 0 ? ($e['utilidad_perdida'] / $e['costo_base']) * 100 : 0.0;
            }

            $socioList = array_values($agrupadoSocio);
            foreach ($socioList as &$s) {
                $s['roi_pct'] = $s['costo_base'] > 0 ? ($s['utilidad_perdida'] / $s['costo_base']) * 100 : 0.0;
            }

            $anioList = array_values($agrupadoAnio);
            usort($anioList, function ($a, $b) {
                return $a['anio'] <=> $b['anio'];
            });
            foreach ($anioList as &$a) {
                $a['roi_pct'] = $a['costo_base'] > 0 ? ($a['utilidad_perdida'] / $a['costo_base']) * 100 : 0.0;
            }

            return response()->json([
                'success' => true,
                'summary' => $summary,
                'data' => $ventas,
                'charts' => [
                    'por_emisor' => $emisorList,
                    'por_socio' => $socioList,
                    'por_anio' => $anioList
                ]
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar el análisis de ventas de acciones',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}
