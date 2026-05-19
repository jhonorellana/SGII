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
                    'total' => (float) $row->total,
                    'id_propietario' => isset($row->id_propietario) ? (int) $row->id_propietario : null,
                    'id_emisor' => isset($row->id_emisor) ? (int) $row->id_emisor : null
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
                        'total' => (float) $row->total,
                        'id_propietario' => null,
                        'id_emisor' => null
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
     * Obtener detalle del flujo de capital
     */
    public function getDetalleFlujoCapital(Request $request): JsonResponse
    {
        // Validación de parámetros
        $fecha = $request->input('fecha');
        $idPropietario = $request->input('id_propietario');
        $idEmisor = $request->input('id_emisor');

        if (!$fecha) {
            return response()->json([
                'success' => false,
                'message' => 'El parámetro fecha es requerido'
            ], 422);
        }

        // Validar formato de fecha
        if (!$this->validarFecha($fecha)) {
            return response()->json([
                'success' => false,
                'message' => 'El formato de la fecha debe ser YYYY-MM-DD'
            ], 422);
        }

        try {
            // Construir query base para obtener todos los campos solicitados usando el nuevo esquema
            $query = "
                SELECT
                    a.id_amortizacion,
                    i.fecha_compra,
                    a.id_inversion,
                    i.liquidacion,
                    inst.nombre AS nombre_instrumento,
                    a.numero_cuota,
                    a.interes,
                    a.capital,
                    a.descuento AS premio,
                    0 AS interes_riesgo,
                    0 AS capital_riesgo,
                    0 AS premio_riesgo,
                    (a.interes + a.capital + a.descuento) AS total
                FROM amortizacion a
                INNER JOIN inversion i ON a.id_inversion = i.id_inversion
                INNER JOIN instrumento inst ON i.id_instrumento = inst.id_instrumento
                INNER JOIN emisor e ON inst.id_emisor = e.id_emisor
                WHERE a.fecha_pago = ?
                AND a.activo = 1
                AND a.eliminado = 0
                AND i.activo = 1
                AND i.eliminado = 0";

            $params = [$fecha];

            // Agregar filtros por ID si se proporcionan
            if ($idPropietario) {
                $query .= " AND i.id_propietario = ?";
                $params[] = $idPropietario;
            }

            if ($idEmisor) {
                $query .= " AND e.id_emisor = ?";
                $params[] = $idEmisor;
            }

            $query .= " ORDER BY i.fecha_compra, a.numero_cuota";

            $detalles = DB::select($query, $params);

            // Formatear resultados
            $detalleItems = [];
            foreach ($detalles as $row) {
                $detalleItems[] = [
                    'id_amortizacion' => $row->id_amortizacion,
                    'fecha_compra' => $row->fecha_compra,
                    'id_inversion' => $row->id_inversion,
                    'liquidacion' => $row->liquidacion,
                    'nombre_instrumento' => $row->nombre_instrumento,
                    'cuota' => $row->numero_cuota,
                    'interes' => (float) $row->interes,
                    'capital' => (float) $row->capital,
                    'premio' => (float) $row->premio,
                    'interes_riesgo' => (float) $row->interes_riesgo,
                    'capital_riesgo' => (float) $row->capital_riesgo,
                    'premio_riesgo' => (float) $row->premio_riesgo,
                    'total' => (float) $row->total
                ];
            }

            return response()->json([
                'success' => true,
                'data' => $detalleItems
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener detalle del flujo de capital: ' . $e->getMessage()
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
