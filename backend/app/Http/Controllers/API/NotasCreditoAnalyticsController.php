<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\NotasCreditoAnalyticsService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class NotasCreditoAnalyticsController extends Controller
{
    protected NotasCreditoAnalyticsService $analyticsService;

    public function __construct(NotasCreditoAnalyticsService $analyticsService)
    {
        $this->analyticsService = $analyticsService;
    }

    /**
     * Retorna los filtros iniciales disponibles para el Radar de Oportunidades
     */
    public function getFiltros(Request $request)
    {
        try {
            $filtros = $this->analyticsService->getFiltrosRadar();
            return response()->json($filtros, Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener filtros del radar de notas de crédito',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Consulta el Radar de Oportunidades y Arbitraje Diario
     */
    public function getRadarOportunidades(Request $request)
    {
        try {
            $filters = $request->all();
            $resultado = $this->analyticsService->getRadarOportunidades($filters);

            return response()->json($resultado, Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al consultar radar de oportunidades de notas de crédito',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Ejecuta una simulación de arbitraje compra-venta
     */
    public function simularArbitraje(Request $request)
    {
        try {
            $valorNominal = (float) $request->input('valor_nominal', 0);
            $precioCompra = (float) $request->input('precio_compra', 97.0);
            $precioVenta = (float) $request->input('precio_venta', 98.90);
            $comisionCompra = (float) $request->input('comision_compra_pct', 0.15);
            $comisionVenta = (float) $request->input('comision_venta_pct', 0.15);
            $diasRotacion = (int) $request->input('dias_rotacion', 25);

            if ($valorNominal <= 0 || $precioCompra <= 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'El valor nominal y precio de compra deben ser mayores a 0'
                ], Response::HTTP_BAD_REQUEST);
            }

            $simulacion = $this->analyticsService->simularArbitraje(
                $valorNominal,
                $precioCompra,
                $precioVenta,
                $comisionCompra,
                $comisionVenta,
                $diasRotacion
            );

            return response()->json([
                'success' => true,
                'data' => $simulacion
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al calcular simulación de arbitraje',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}

