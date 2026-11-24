<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\MaximosMinimosAnalyticsService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class MaximosMinimosAnalyticsController extends Controller
{
    protected MaximosMinimosAnalyticsService $analyticsService;

    public function __construct(MaximosMinimosAnalyticsService $analyticsService)
    {
        $this->analyticsService = $analyticsService;
    }

    /**
     * Retorna la lista de emisores disponibles con su último precio, bandas y estado de liquidez
     * GET /api/renta-variable/maximos-minimos/emisores
     */
    public function emisores(Request $request)
    {
        try {
            $result = $this->analyticsService->getEmisoresDisponibles();
            return response()->json($result, Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener emisores de máximos y mínimos',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Retorna la serie histórica diaria con el canal de bandas máximas y mínimas de la BVQ y simulación Monte Carlo
     * GET /api/renta-variable/maximos-minimos/canal/{codigoSeb}
     */
    public function canalHistorico(Request $request, string $codigoSeb)
    {
        try {
            $periodo = $request->query('periodo', '1y');
            $fechaDesde = $request->query('fecha_desde');
            $fechaHasta = $request->query('fecha_hasta');
            $incluirProyeccion = filter_var($request->query('proyeccion', 'true'), FILTER_VALIDATE_BOOLEAN);
            $diasProyeccion = (int) $request->query('dias_proyeccion', 90);

            $result = $this->analyticsService->getCanalHistorico(
                $codigoSeb,
                $periodo,
                $fechaDesde,
                $fechaHasta,
                $incluirProyeccion,
                $diasProyeccion
            );

            $status = ($result['success'] ?? false) ? Response::HTTP_OK : Response::HTTP_NOT_FOUND;
            return response()->json($result, $status);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al consultar canal histórico de la acción',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Endpoint directo y ligero para recalcular proyecciones Monte Carlo con parámetros personalizados
     * GET /api/renta-variable/maximos-minimos/proyeccion/{codigoSeb}
     */
    public function proyeccion(Request $request, string $codigoSeb)
    {
        try {
            $dias = (int) $request->query('dias', 90);
            $sims = (int) $request->query('sims', 500);

            $canal = $this->analyticsService->getCanalHistorico(
                $codigoSeb,
                '1y',
                null,
                null,
                true,
                $dias
            );

            if (!($canal['success'] ?? false)) {
                return response()->json($canal, Response::HTTP_NOT_FOUND);
            }

            return response()->json([
                'success' => true,
                'codigo_seb' => $codigoSeb,
                'emisor' => $canal['metadata']['emisor'] ?? $codigoSeb,
                'precio_actual' => $canal['metricas']['precio_actual'] ?? 0,
                'volatilidad_anualizada_pct' => $canal['metricas']['volatilidad_anualizada_pct'] ?? 0,
                'proyeccion_monte_carlo' => $canal['proyeccion_monte_carlo'] ?? null
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar proyección Monte Carlo',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}
