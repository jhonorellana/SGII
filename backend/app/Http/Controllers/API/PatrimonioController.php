<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

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
        $incluirDividendos = filter_var($request->input('incluir_dividendos'), FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        $incluirPlusvalia = filter_var($request->input('incluir_plusvalia'), FILTER_VALIDATE_BOOLEAN) ? 1 : 0;

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
            $cacheKey = "patrimonio_consolidado_{$fechaInicio}_{$fechaFin}_" . 
                        ($idGrupoFamiliar ?? 'all') . "_" . 
                        ($idPropietario ?? 'all') . "_" . 
                        "{$incluirDividendos}_{$incluirPlusvalia}";

            return Cache::remember($cacheKey, 60, function () use ($fechaInicio, $fechaFin, $idGrupoFamiliar, $idPropietario, $incluirDividendos, $incluirPlusvalia) {
                // Ejecutar SP SIEMPRE UNA SOLA VEZ solicitando la versión completa (1, 1) para obtener plusvalía y dividendos potenciales
                $resultados = DB::select('CALL SP_PATRIMONIO_CONSOLIDADO(?, ?, ?, ?, 1, 1)', [
                    $fechaInicio,
                    $fechaFin,
                    $idGrupoFamiliar,
                    $idPropietario
                ]);

                $patrimonio = [];
                $dividendosTotal = 0.0;
                $plusvaliaTotal = 0.0;
                $totalSumFromSP = 0.0;

                foreach ($resultados as $row) {
                    $val = (float) $row->valor;
                    $detLindo = $this->fixUtf8($row->detalle);
                    $detLower = strtolower($detLindo);

                    if (str_contains($detLower, 'dividendos en acciones')) {
                        $dividendosTotal = $val;
                    } elseif (str_contains($detLower, 'plusval')) {
                        $plusvaliaTotal = $val;
                    } elseif ($row->detalle === 'TOTAL' || $detLindo === 'TOTAL') {
                        $totalSumFromSP = $val;
                    }
                }

                // Derivar la base limpia en PHP
                $baseTotal = $totalSumFromSP - $dividendosTotal - $plusvaliaTotal;

                // Construir la respuesta aplicando los switches en memoria sin volver a consultar MySQL
                $totalFinal = $baseTotal + ($incluirDividendos ? $dividendosTotal : 0.0) + ($incluirPlusvalia ? $plusvaliaTotal : 0.0);

                foreach ($resultados as $row) {
                    $val = (float) $row->valor;
                    $detLindo = $this->fixUtf8($row->detalle);
                    $detLower = strtolower($detLindo);

                    if ($row->detalle === 'TOTAL' || $detLindo === 'TOTAL') {
                        $patrimonio[] = [
                            'detalle' => 'TOTAL',
                            'valor' => $totalFinal
                        ];
                    } elseif (str_contains($detLower, 'dividendos en acciones')) {
                        $patrimonio[] = [
                            'detalle' => $detLindo,
                            'valor' => $incluirDividendos ? $dividendosTotal : 0.0
                        ];
                    } elseif (str_contains($detLower, 'plusval')) {
                        $patrimonio[] = [
                            'detalle' => $detLindo,
                            'valor' => $incluirPlusvalia ? $plusvaliaTotal : 0.0
                        ];
                    } else {
                        $patrimonio[] = [
                            'detalle' => $detLindo,
                            'valor' => $val
                        ];
                    }
                }

                return response()->json([
                    'success' => true,
                    'data' => [
                        'patrimonio' => $patrimonio,
                        'total' => $totalFinal,
                        'base_total' => $baseTotal,
                        'dividendos_total' => $dividendosTotal,
                        'plusvalia_total' => $plusvaliaTotal,
                        'total_completo' => $baseTotal + $dividendosTotal + $plusvaliaTotal
                    ]
                ]);
            });

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

    /**
     * Sanear cualquier artefacto de codificación UTF-8 / Mojibake
     */
    private function fixUtf8(string $str): string
    {
        $replacements = [
            '├®' => 'é',
            '├│' => 'ó',
            '├óa' => 'ía',
            '├í' => 'í',
            '├¡' => 'í',
            '├║' => 'ú',
            '├▒' => 'ñ',
            'Ã©' => 'é',
            'Ã³' => 'ó',
            'Ã\u00ad' => 'í',
            'Ãº' => 'ú',
            'Ã±' => 'ñ',
        ];
        return strtr($str, $replacements);
    }
}
