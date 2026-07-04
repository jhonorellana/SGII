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
        $fechaInicio = $request->input('fecha_inicio');
        $fechaFin = $request->input('fecha_fin');

        if (!$fechaInicio || !$fechaFin) {
            return response()->json([
                'success' => false,
                'message' => 'Las fechas de inicio y fin son requeridas'
            ], 422);
        }

        try {
            // Validar formato de fechas
            $fechaInicioCarbon = Carbon::parse($fechaInicio);
            $fechaFinCarbon = Carbon::parse($fechaFin);

            if ($fechaInicioCarbon->gt($fechaFinCarbon)) {
                return response()->json([
                    'success' => false,
                    'message' => 'La fecha de inicio no puede ser mayor a la fecha de fin'
                ], 422);
            }

            // Obtener datos mensuales
            $datosMensuales = $this->obtenerDatosMensuales($fechaInicio, $fechaFin);

            // Calcular resumen del rango
            $resumenAnual = $this->calcularResumenRango($fechaInicio, $fechaFin);

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
     * Obtener datos mensuales según el SP legado, pero filtrado por rango
     */
    private function obtenerDatosMensuales(string $fechaInicio, string $fechaFin): array
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
        ->whereBetween('fecha_pago', [$fechaInicio, $fechaFin])
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
        $nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                          'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        foreach ($results as $row) {
            $mesNombre = $nombresMeses[$row->mes - 1];
            $nombreMesAnio = $mesNombre . '-' . $row->anio; // Ene-2025

            $datosMensuales[] = [
                'anio' => (int) $row->anio,
                'mes' => (int) $row->mes,
                'nombre_mes' => $nombreMesAnio,
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
     * Calcular resumen del rango seleccionado (TOTAL, EJECUTADO, PENDIENTE)
     */
    private function calcularResumenRango(string $fechaInicio, string $fechaFin): array
    {
        $resumen = [];

        // RANGO TOTAL
        $total = $this->calcularTotalesRango($fechaInicio, $fechaFin, 'total');
        $resumen[] = [
            'tipo' => 'TOTAL',
            'interes' => $total['interes'],
            'capital' => $total['capital'],
            'premio' => $total['descuento'], // descuento = premio
            'total' => $total['total']
        ];

        // RANGO EJECUTADO (hasta fecha actual dentro del rango)
        $ejecutado = $this->calcularTotalesRango($fechaInicio, $fechaFin, 'ejecutado');
        $resumen[] = [
            'tipo' => 'EJECUTADO',
            'interes' => $ejecutado['interes'],
            'capital' => $ejecutado['capital'],
            'premio' => $ejecutado['descuento'],
            'total' => $ejecutado['total']
        ];

        // RANGO PENDIENTE (fechas futuras dentro del rango)
        $pendiente = $this->calcularTotalesRango($fechaInicio, $fechaFin, 'pendiente');
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
     * Calcular totales según el tipo dentro del rango (total, ejecutado, pendiente)
     */
    private function calcularTotalesRango(string $fechaInicio, string $fechaFin, string $tipo): array
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
        ->whereBetween('fecha_pago', [$fechaInicio, $fechaFin])
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
