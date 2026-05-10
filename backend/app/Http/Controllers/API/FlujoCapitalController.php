<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class FlujoCapitalController extends Controller
{
    /**
     * Obtener flujo de capital consolidado
     */
    public function getFlujoCapital(Request $request): JsonResponse
    {
        // Validación de parámetros
        $fechaInicio = $request->input('fecha_inicio');
        $fechaFin = $request->input('fecha_fin');
        $idGrupoFamiliar = $request->input('id_grupo_familiar');
        $idPropietario = $request->input('id_propietario');

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
            $resultados = DB::select('CALL SP_FLUJO_CAPITAL_CONSOLIDADO(?, ?, ?, ?)', [
                $fechaInicio,
                $fechaFin,
                $idGrupoFamiliar,
                $idPropietario
            ]);

            // Formatear resultados
            $flujoCapital = [];
            $total = null;

            foreach ($resultados as $row) {
                $flujoCapital[] = [
                    'fecha' => $row->fecha,
                    'propietario' => $row->propietario,
                    'empresa' => $row->empresa,
                    'interes' => (float) $row->interes,
                    'capital' => (float) $row->capital,
                    'descuento' => (float) $row->descuento,
                    'interes_moroso' => (float) $row->interes_moroso,
                    'capital_moroso' => (float) $row->capital_moroso,
                    'descuento_moroso' => (float) $row->descuento_moroso,
                    'total' => (float) $row->total
                ];

                // Guardar la fila de totales para separarla
                if ($row->empresa === 'TOTAL') {
                    $total = [
                        'fecha' => $row->fecha,
                        'propietario' => $row->propietario,
                        'empresa' => $row->empresa,
                        'interes' => (float) $row->interes,
                        'capital' => (float) $row->capital,
                        'descuento' => (float) $row->descuento,
                        'interes_moroso' => (float) $row->interes_moroso,
                        'capital_moroso' => (float) $row->capital_moroso,
                        'descuento_moroso' => (float) $row->descuento_moroso,
                        'total' => (float) $row->total
                    ];
                }
            }

            return response()->json([
                'success' => true,
                'data' => $flujoCapital
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener flujo de capital consolidado: ' . $e->getMessage()
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
        return $this->getFlujoCapital($request);
    }

    /**
     * Exportar a PDF
     */
    public function exportarPDF(Request $request): JsonResponse
    {
        // Por ahora retornamos los datos para que el frontend los procese
        // En el futuro se puede implementar con DOMPDF o similar
        return $this->getFlujoCapital($request);
    }

    /**
     * Validar formato de fecha YYYY-MM-DD
     */
    private function validarFecha($fecha): bool
    {
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha) === 1;
    }
}
