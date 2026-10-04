<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FixedIncomeAnalyticsService;
use App\Services\VectorPreciosEtlService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FixedIncomeRadarController extends Controller
{
    protected $analyticsService;
    protected $etlService;

    public function __construct(
        FixedIncomeAnalyticsService $analyticsService,
        VectorPreciosEtlService $etlService
    ) {
        $this->analyticsService = $analyticsService;
        $this->etlService = $etlService;
    }

    /**
     * GET /api/renta-fija-radar/mercado
     */
    public function getMarketRadar(Request $request): JsonResponse
    {
        $filters = [
            'fecha_vector' => $request->query('fecha_vector'),
            'clase_titulo' => $request->query('clase_titulo'),
            'calificacion_riesgo' => $request->query('calificacion_riesgo'),
            'search' => $request->query('search')
        ];

        $data = $this->analyticsService->getMarketRadar($filters);

        return response()->json([
            'status' => 'success',
            'data' => $data
        ]);
    }

    /**
     * GET /api/renta-fija-radar/portafolio
     */
    public function getUserPortfolio(Request $request): JsonResponse
    {
        $filters = [
            'propietario_id' => $request->query('propietario_id'),
            'clase_titulo' => $request->query('clase_titulo'),
            'id_tipo_inversion' => $request->query('id_tipo_inversion'),
            'include_expired' => $request->query('include_expired', false)
        ];

        $data = $this->analyticsService->getUserPortfolioMarkToMarket($filters);

        return response()->json([
            'status' => 'success',
            'data' => $data
        ]);
    }

    /**
     * POST /api/renta-fija-radar/importar-vector
     */
    public function importVector(Request $request): JsonResponse
    {
        $filePath = $request->input('file_path');
        $result = $this->etlService->importVectorPrecios($filePath);

        return response()->json([
            'status' => $result['success'] ? 'success' : 'error',
            'message' => $result['message'],
            'data' => $result
        ], $result['success'] ? 200 : 400);
    }

    /**
     * GET /api/renta-fija-radar/inversion/{id}
     */
    public function getInvestmentDetail(int $id): JsonResponse
    {
        $data = $this->analyticsService->getInvestmentDetail($id);

        if (!$data) {
            return response()->json([
                'status' => 'error',
                'message' => 'Inversión no encontrada'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $data
        ]);
    }

    /**
     * POST /api/renta-fija-radar/actualizar-codigo-vector
     */
    public function updateVectorCode(Request $request): JsonResponse
    {
        $request->validate([
            'id_instrumento' => 'required|integer',
            'codigo_titulo_vector' => 'required|string|max:100'
        ]);

        $idInstrumento = (int) $request->input('id_instrumento');
        $codigoVector = (string) $request->input('codigo_titulo_vector');

        $success = $this->analyticsService->updateInstrumentVectorCode($idInstrumento, $codigoVector);

        return response()->json([
            'status' => $success ? 'success' : 'error',
            'message' => $success ? 'Código de vector actualizado correctamente' : 'No se pudo actualizar el código de vector'
        ], $success ? 200 : 400);
    }
}
