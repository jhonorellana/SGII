<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class PatrimonioController extends Controller
{
    /**
     * Obtener patrimonio consolidado
     */
    public function getPatrimonioConsolidado(Request $request): JsonResponse
    {
        // Validación de parámetros
        $fechaInicio = $request->input('fecha_inicio');
        $fechaFin = $request->input('fecha_fin');
        $idGrupoFamiliar = $request->input('id_grupo_familiar');
        $idPropietario = $request->input('id_propietario');
        $incluirDividendos = $request->input('incluir_dividendos') ? 1 : 0;

        // Validar fechas
        if (!$fechaInicio || !$fechaFin) {
            return response()->json([
                'success' => false,
                'message' => 'Las fechas de inicio y fin son requeridas'
            ], 422);
        }

        // Validar formato de fechas (YYYY-MM-DD)
        if (!$this->validarFecha($fechaInicio) || !$this->validarFecha($fechaFin)) {
            return response()->json([
                'success' => false,
                'message' => 'El formato de las fechas debe ser YYYY-MM-DD'
            ], 422);
        }

        try {
            // Ejecutar stored procedure
            $resultados = DB::select('CALL SP_PATRIMONIO_CONSOLIDADO(?, ?, ?, ?, ?)', [
                $fechaInicio,
                $fechaFin,
                $idGrupoFamiliar,
                $idPropietario,
                $incluirDividendos
            ]);

            // Formatear resultados
            $patrimonio = [];
            $total = 0;

            foreach ($resultados as $row) {
                $patrimonio[] = [
                    'detalle' => $row->detalle,
                    'valor' => (float) $row->valor
                ];

                // Guardar el total para separarlo
                if ($row->detalle === 'TOTAL') {
                    $total = (float) $row->valor;
                }
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'patrimonio' => $patrimonio,
                    'total' => $total
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener patrimonio consolidado: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Exportar a Excel
     */
    public function exportarExcel(Request $request): JsonResponse
    {
        // Por ahora retornamos los datos para que el frontend los procese
        // En el futuro se puede implementar con Laravel Excel
        return $this->getPatrimonioConsolidado($request);
    }

    /**
     * Exportar a PDF
     */
    public function exportarPDF(Request $request): JsonResponse
    {
        // Por ahora retornamos los datos para que el frontend los procese
        // En el futuro se puede implementar con DOMPDF o similar
        return $this->getPatrimonioConsolidado($request);
    }

    /**
     * Validar formato de fecha YYYY-MM-DD
     */
    private function validarFecha($fecha): bool
    {
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha) === 1;
    }
}
