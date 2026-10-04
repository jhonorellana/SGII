<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\DividendAnalyticsService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DividendAnalyticsController extends Controller
{
    protected DividendAnalyticsService $analyticsService;

    public function __construct(DividendAnalyticsService $analyticsService)
    {
        $this->analyticsService = $analyticsService;
    }

    /**
     * Obtiene la lista ordenada del Radar de Oportunidades de Inversión y Proyección de Dividendos
     */
    public function radar(Request $request)
    {
        try {
            $result = $this->analyticsService->getRadarOportunidades();
            return response()->json($result, Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al procesar la solicitud del radar de dividendos',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Ejecuta una simulación de inversión para un monto y emisor específicos
     */
    public function simular(Request $request)
    {
        try {
            $montoUsd = (float) $request->input('monto_usd', 10000);
            $idEmisor = (int) $request->input('id_emisor');

            if ($montoUsd <= 0 || !$idEmisor) {
                return response()->json([
                    'success' => false,
                    'message' => 'Los parámetros monto_usd (positivo) e id_emisor son obligatorios.'
                ], Response::HTTP_BAD_REQUEST);
            }

            $result = $this->analyticsService->simularInversion($montoUsd, $idEmisor);
            return response()->json($result, Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al procesar la simulación de inversión',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Obtiene el desglose y consolidado del portafolio real del usuario
     */
    public function portafolio(Request $request)
    {
        try {
            $idPersona = $request->has('id_persona') ? (int) $request->input('id_persona') : null;
            $result = $this->analyticsService->getMiPortafolio($idPersona);
            return response()->json($result, Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las inversiones del portafolio',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Prepara el prompt y análisis con ChatGPT (IA) para la compra de acciones
     */
    public function analizarIa(Request $request)
    {
        try {
            $stockData = $request->all();
            $customPrompt = $request->input('prompt', '');
            $result = $this->analyticsService->analizarConIA($stockData, $customPrompt);
            return response()->json($result, Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al procesar el análisis de ChatGPT',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}
