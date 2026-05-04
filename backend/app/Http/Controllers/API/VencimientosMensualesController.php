<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Inversion;
use App\Models\Amortizacion;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class VencimientosMensualesController extends Controller
{
    /**
     * Obtener vencimientos mensuales
     */
    public function getVencimientosMensuales(Request $request): JsonResponse
    {
        // Validación manual
        $anio = $request->input('anio');
        $mes = $request->input('mes', 0); // 0 = todos los meses

        if (!is_numeric($anio) || $anio < 2020 || $anio > 2030) {
            return response()->json([
                'success' => false,
                'message' => 'El año es requerido y debe estar entre 2020 y 2030'
            ], 422);
        }

        if ($mes !== null && (!is_numeric($mes) || $mes < 0 || $mes > 12)) {
            return response()->json([
                'success' => false,
                'message' => 'El mes debe estar entre 0 y 12'
            ], 422);
        }

        try {
            // Obtener datos mensuales
            $datosMensuales = $this->obtenerDatosMensuales((int)$anio, (int)$mes);

            // Calcular resumen anual
            $resumenAnual = $this->calcularResumenAnual((int)$anio);

            return response()->json([
                'success' => true,
                'data' => [
                    'vencimientos' => $datosMensuales,
                    'resumen_anual' => $resumenAnual
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener vencimientos mensuales: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener datos mensuales según el SP legado
     */
    private function obtenerDatosMensuales(int $anio, int $mes): array
    {
        // Primero obtener los datos básicos con GROUP BY
        $query = Amortizacion::select([
            \DB::raw('YEAR(fecha_pago) as anio'),
            \DB::raw('MONTH(fecha_pago) as mes'),
            \DB::raw('
                SUM(CASE WHEN pagada IN (1,0) THEN interes ELSE 0 END) as interes
            '),
            \DB::raw('
                SUM(CASE WHEN pagada IN (1,0) THEN capital ELSE 0 END) as capital
            '),
            \DB::raw('
                SUM(CASE WHEN pagada IN (1,0) THEN descuento ELSE 0 END) as descuento
            '),
            \DB::raw('
                SUM(CASE WHEN pagada = 2 THEN interes ELSE 0 END) as interes_moroso
            '),
            \DB::raw('
                SUM(CASE WHEN pagada = 2 THEN capital ELSE 0 END) as capital_moroso
            '),
            \DB::raw('
                SUM(CASE WHEN pagada = 2 THEN descuento ELSE 0 END) as descuento_moroso
            '),
            \DB::raw('SUM(interes) + SUM(capital) as total')
        ])
        ->join('inversion', 'amortizacion.id_inversion', '=', 'inversion.id_inversion')
        ->where(function($query) use ($anio, $mes) {
            if ($mes == 0) {
                // Todos los meses del año
                $query->whereYear('fecha_pago', $anio);
            } else {
                // Mes específico
                $query->whereYear('fecha_pago', $anio)
                      ->whereMonth('fecha_pago', $mes);
            }
        })
        ->where(function($query) {
            // Lógica del SP: (A.is_active = 1 OR I.inv_fecha_venta IS NULL)
            $query->where('amortizacion.activo', 1)
                  ->orWhereNull('inversion.fecha_venta');
        })
        ->where('amortizacion.eliminado', 0)
        ->where('inversion.eliminado', 0)
        ->groupBy(\DB::raw('YEAR(fecha_pago)'), \DB::raw('MONTH(fecha_pago)'))
        ->orderBy(\DB::raw('YEAR(fecha_pago)'))
        ->orderBy(\DB::raw('MONTH(fecha_pago)'));

        $results = $query->get();

        // Formatear resultados y agregar nombre del mes
        $datosMensuales = [];
        $nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        foreach ($results as $row) {
            $datosMensuales[] = [
                'anio' => (int) $row->anio,
                'mes' => (int) $row->mes,
                'nombre_mes' => $nombresMeses[$row->mes - 1],
                'interes' => round((float) $row->interes, 2),
                'capital' => round((float) $row->capital, 2),
                'descuento' => round((float) $row->descuento, 2),
                'premio' => round((float) $row->descuento, 2), // descuento = premio en nuestro sistema
                'interes_moroso' => round((float) $row->interes_moroso, 2),
                'capital_moroso' => round((float) $row->capital_moroso, 2),
                'descuento_moroso' => round((float) $row->descuento_moroso, 2),
                'total' => round((float) $row->total, 2),
                'es_mes_actual' => $row->mes == Carbon::now()->month && $row->anio == Carbon::now()->year
            ];
        }

        return $datosMensuales;
    }

    /**
     * Calcular resumen anual (TOTAL, EJECUTADO, PENDIENTE)
     */
    private function calcularResumenAnual(int $anio): array
    {
        $resumen = [];

        // ANUAL TOTAL
        $total = $this->calcularTotalesAnuales($anio, 'total');
        $resumen[] = [
            'tipo' => 'TOTAL',
            'interes' => $total['interes'],
            'capital' => $total['capital'],
            'premio' => $total['descuento'], // descuento = premio
            'total' => $total['total']
        ];

        // ANUAL EJECUTADO (hasta fecha actual)
        $ejecutado = $this->calcularTotalesAnuales($anio, 'ejecutado');
        $resumen[] = [
            'tipo' => 'EJECUTADO',
            'interes' => $ejecutado['interes'],
            'capital' => $ejecutado['capital'],
            'premio' => $ejecutado['descuento'],
            'total' => $ejecutado['total']
        ];

        // ANUAL PENDIENTE (fechas futuras)
        $pendiente = $this->calcularTotalesAnuales($anio, 'pendiente');
        $resumen[] = [
            'tipo' => 'PENDIENTE',
            'interes' => $pendiente['interes'],
            'capital' => $pendiente['capital'],
            'premio' => $pendiente['descuento'],
            'total' => $pendiente['total']
        ];

        return $resumen;
    }

    /**
     * Calcular totales según el tipo (total, ejecutado, pendiente)
     */
    private function calcularTotalesAnuales(int $anio, string $tipo): array
    {
        $query = Amortizacion::select([
            \DB::raw('
                SUM(CASE WHEN pagada IN (1,0) THEN interes ELSE 0 END) as interes
            '),
            \DB::raw('
                SUM(CASE WHEN pagada IN (1,0) THEN capital ELSE 0 END) as capital
            '),
            \DB::raw('
                SUM(CASE WHEN pagada IN (1,0) THEN descuento ELSE 0 END) as descuento
            '),
            \DB::raw('SUM(interes) + SUM(capital) as total')
        ])
        ->join('inversion', 'amortizacion.id_inversion', '=', 'inversion.id_inversion')
        ->whereYear('fecha_pago', $anio)
        ->where(function($query) {
            // Lógica del SP: (A.is_active = 1 OR I.inv_fecha_venta IS NULL)
            $query->where('amortizacion.activo', 1)
                  ->orWhereNull('inversion.fecha_venta');
        })
        ->where('amortizacion.eliminado', 0)
        ->where('inversion.eliminado', 0);

        // Aplicar filtro según tipo
        switch ($tipo) {
            case 'ejecutado':
                // ANUAL EJECUTADO: hasta fecha actual y activo = 1
                $query->where('amortizacion.activo', 1)
                      ->where('fecha_pago', '<=', Carbon::now()->format('Y-m-d'));
                break;
            case 'pendiente':
                // ANUAL PENDIENTE: fechas futuras
                $query->where('fecha_pago', '>', Carbon::now()->format('Y-m-d'));
                break;
            // 'total' no necesita filtro adicional
        }

        $result = $query->first();

        return [
            'interes' => round((float) $result->interes, 2),
            'capital' => round((float) $result->capital, 2),
            'descuento' => round((float) $result->descuento, 2),
            'total' => round((float) $result->total, 2)
        ];
    }

    /**
     * Exportar a Excel
     */
    public function exportarExcel(Request $request): JsonResponse
    {
        // Implementación similar a getVencimientosMensuales pero retorna archivo Excel
        // Por ahora retornamos los datos para que el frontend los procese
        return $this->getVencimientosMensuales($request);
    }

    /**
     * Exportar a PDF
     */
    public function exportarPDF(Request $request): JsonResponse
    {
        // Implementación similar a getVencimientosMensuales pero retorna archivo PDF
        // Por ahora retornamos los datos para que el frontend los procese
        return $this->getVencimientosMensuales($request);
    }
}
