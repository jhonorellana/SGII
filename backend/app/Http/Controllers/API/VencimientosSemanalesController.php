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

class VencimientosSemanalesController extends Controller
{
    /**
     * Obtener vencimientos semanales
     */
    public function getVencimientosSemanales(Request $request): JsonResponse
    {
        // Validación manual
        $fecha = $request->input('fecha');

        if (!$fecha) {
            $fecha = Carbon::now()->format('Y-m-d');
        }

        try {
            $fechaCarbon = Carbon::parse($fecha);

            // Obtener datos semanales
            $datosSemanales = $this->obtenerDatosSemanales($fechaCarbon);

            // Calcular resumen semanal
            $resumenSemanal = $this->calcularResumenSemanal($fechaCarbon);

            return response()->json([
                'success' => true,
                'data' => [
                    'vencimientos' => $datosSemanales,
                    'resumen_semanal' => $resumenSemanal
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener vencimientos semanales: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener datos semanales (Sábado a Domingo)
     */
    private function obtenerDatosSemanales(Carbon $fecha): array
    {
        // Calcular el inicio de semana (Sábado)
        // Si hoy es sábado, inicio es hoy
        // Si hoy es domingo-viernes, inicio es el sábado anterior
        $inicioSemana = $fecha->copy();
        $diaSemana = $inicioSemana->dayOfWeek; // 0 = domingo, 1 = lunes, ..., 5 = viernes, 6 = sábado

        if ($diaSemana == 6) {
            // Hoy es sábado, no necesitamos restar días
        } else {
            // Calcular días para llegar al sábado anterior
            // Si es domingo (0), restar 1 día para llegar al sábado
            // Si es lunes (1), restar 2 días para llegar al sábado
            // Si es martes (2), restar 3 días para llegar al sábado
            // etc.
            $diasParaRetroceder = ($diaSemana + 1) % 7;
            if ($diasParaRetroceder == 0) {
                $diasParaRetroceder = 7;
            }
            $inicioSemana->subDays($diasParaRetroceder);
        }

        // Generar los 7 días de la semana (Sábado a Viernes)
        $nombresDias = [
            'Sábado',
            'Domingo',
            'Lunes',
            'Martes',
            'Miércoles',
            'Jueves',
            'Viernes'
        ];

        $diasSemana = [];
        for ($i = 0; $i < 7; $i++) {
            $diaFecha = $inicioSemana->copy()->addDays($i);
            $diasSemana[] = [
                'nombre_dia' => $nombresDias[$i],
                'fecha' => $diaFecha->format('Y-m-d'),
                'nombre_dia_ingles' => ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][$i]
            ];
        }

        // Obtener datos reales de vencimientos para el rango de fechas
        $fechaInicio = $inicioSemana->format('Y-m-d');
        $fechaFin = $inicioSemana->copy()->addDays(6)->format('Y-m-d');

        $query = Amortizacion::select([
            \DB::raw('DATE(fecha_pago) as fecha'),
            \DB::raw('DAYNAME(fecha_pago) as nombre_dia'),
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
        ->groupBy(\DB::raw('DATE(fecha_pago)'), \DB::raw('DAYNAME(fecha_pago)'))
        ->orderBy('fecha_pago');

        $results = $query->get();

        // Crear mapa de datos por fecha para hacer merge
        $datosPorFecha = [];
        foreach ($results as $row) {
            $datosPorFecha[$row->fecha] = [
                'interes' => round((float) $row->interes, 2),
                'capital' => round((float) $row->capital, 2),
                'descuento' => round((float) $row->descuento, 2),
                'interes_moroso' => round((float) $row->interes_moroso, 2),
                'capital_moroso' => round((float) $row->capital_moroso, 2),
                'descuento_moroso' => round((float) $row->descuento_moroso, 2),
                'total' => round((float) $row->total, 2)
            ];
        }

        // Generar array final con todos los días, mergeando con datos reales
        $datosSemanales = [];
        foreach ($diasSemana as $dia) {
            $datosReales = $datosPorFecha[$dia['fecha']] ?? [
                'interes' => 0,
                'capital' => 0,
                'descuento' => 0,
                'interes_moroso' => 0,
                'capital_moroso' => 0,
                'descuento_moroso' => 0,
                'total' => 0
            ];

            $fechaPago = Carbon::parse($dia['fecha']);

            $datosSemanales[] = [
                'fecha' => $dia['fecha'],
                'nombre_dia' => $dia['nombre_dia'],
                'interes' => $datosReales['interes'],
                'capital' => $datosReales['capital'],
                'descuento' => $datosReales['descuento'],
                'premio' => $datosReales['descuento'], // descuento = premio en nuestro sistema
                'interes_moroso' => $datosReales['interes_moroso'],
                'capital_moroso' => $datosReales['capital_moroso'],
                'descuento_moroso' => $datosReales['descuento_moroso'],
                'total' => $datosReales['total'],
                'es_hoy' => $fechaPago->isSameDay(Carbon::now())
            ];
        }

        return $datosSemanales;
    }

    /**
     * Calcular resumen semanal (TOTAL, EJECUTADO, PENDIENTE)
     */
    private function calcularResumenSemanal(Carbon $fecha): array
    {
        $resumen = [];

        // Calcular el inicio de semana (Sábado) usando la misma lógica
        $inicioSemana = $fecha->copy();
        $diaSemana = $inicioSemana->dayOfWeek;

        if ($diaSemana == 6) {
            // Hoy es sábado
        } else {
            $diasParaRetroceder = ($diaSemana + 1) % 7;
            if ($diasParaRetroceder == 0) {
                $diasParaRetroceder = 7;
            }
            $inicioSemana->subDays($diasParaRetroceder);
        }

        $finSemana = $inicioSemana->copy()->addDays(6);

        // SEMANAL TOTAL
        $total = $this->calcularTotalesSemanales($inicioSemana, $finSemana, 'total');
        $resumen[] = [
            'tipo' => 'TOTAL',
            'interes' => $total['interes'],
            'capital' => $total['capital'],
            'premio' => $total['descuento'], // descuento = premio
            'total' => $total['total']
        ];

        // SEMANAL EJECUTADO (hasta fecha actual)
        $ejecutado = $this->calcularTotalesSemanales($inicioSemana, $finSemana, 'ejecutado');
        $resumen[] = [
            'tipo' => 'EJECUTADO',
            'interes' => $ejecutado['interes'],
            'capital' => $ejecutado['capital'],
            'premio' => $ejecutado['descuento'],
            'total' => $ejecutado['total']
        ];

        // SEMANAL PENDIENTE (fechas futuras)
        $pendiente = $this->calcularTotalesSemanales($inicioSemana, $finSemana, 'pendiente');
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
    private function calcularTotalesSemanales(Carbon $inicioSemana, Carbon $finSemana, string $tipo): array
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
        ->whereBetween('fecha_pago', [$inicioSemana->format('Y-m-d'), $finSemana->format('Y-m-d')])
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
                // SEMANAL EJECUTADO: hasta fecha actual y activo = 1
                $query->where('amortizacion.activo', 1)
                      ->where('fecha_pago', '<=', Carbon::now()->format('Y-m-d'));
                break;
            case 'pendiente':
                // SEMANAL PENDIENTE: fechas futuras
                $query->where('fecha_pago', '>', Carbon::now()->format('Y-m-d'));
                break;
            // 'total' no necesita filtro adicional
        }

        $result = $query->first();

        return [
            'interes' => round((float) ($result->interes ?? 0), 2),
            'capital' => round((float) ($result->capital ?? 0), 2),
            'descuento' => round((float) ($result->descuento ?? 0), 2),
            'total' => round((float) ($result->total ?? 0), 2)
        ];
    }

    /**
     * Exportar a Excel
     */
    public function exportarExcel(Request $request): JsonResponse
    {
        // Implementación similar a getVencimientosSemanales pero retorna archivo Excel
        // Por ahora retornamos los datos para que el frontend los procese
        return $this->getVencimientosSemanales($request);
    }

    /**
     * Exportar a PDF
     */
    public function exportarPDF(Request $request): JsonResponse
    {
        // Implementación similar a getVencimientosSemanales pero retorna archivo PDF
        // Por ahora retornamos los datos para que el frontend los procese
        return $this->getVencimientosSemanales($request);
    }

    /**
     * Obtener detalle de vencimientos por fecha
     * Agrupado por Propietario + Emisor + Tipo de Inversión (para conciliación bancaria)
     */
    public function getDetalleVencimientosSemanales(Request $request): JsonResponse
    {
        $fecha = $request->input('fecha');

        if (!$fecha) {
            return response()->json([
                'success' => false,
                'message' => 'La fecha es requerida'
            ], 422);
        }

        try {
            $fechaCarbon = Carbon::parse($fecha);

            // Obtener detalle por fecha agrupado por Propietario + Emisor + Tipo de Inversión
            // Esto refleja cómo las entidades financieras realmente realizan los pagos consolidados
            $query = Amortizacion::select([
                'persona.id_persona',
                \DB::raw("CONCAT(persona.nombres, ' ', persona.apellidos) as propietario"),
                'emisor.id_emisor',
                'emisor.nombre as emisor',
                'catalogo_valor.id_catalogo_valor as id_tipo_inversion',
                'catalogo_valor.nombre as tipo_inversion',
                \DB::raw('COUNT(*) as cantidad_instrumentos'),
                \DB::raw('
                    SUM(CASE WHEN pagada IN (1,0) THEN interes ELSE 0 END) as interes
                '),
                \DB::raw('
                    SUM(CASE WHEN pagada IN (1,0) THEN capital ELSE 0 END) as capital
                '),
                \DB::raw('
                    SUM(CASE WHEN pagada IN (1,0) THEN descuento ELSE 0 END) as premio
                '),
                \DB::raw('
                    SUM(CASE WHEN pagada = 2 THEN interes ELSE 0 END) as interes_riesgo
                '),
                \DB::raw('
                    SUM(CASE WHEN pagada = 2 THEN capital ELSE 0 END) as capital_riesgo
                '),
                \DB::raw('
                    SUM(CASE WHEN pagada = 2 THEN descuento ELSE 0 END) as premio_riesgo
                '),
                \DB::raw('
                    SUM(CASE WHEN pagada IN (1,0) THEN interes ELSE 0 END) +
                    SUM(CASE WHEN pagada IN (1,0) THEN capital ELSE 0 END) as total
                ')
            ])
            ->join('inversion', 'amortizacion.id_inversion', '=', 'inversion.id_inversion')
            ->join('persona', 'inversion.id_propietario', '=', 'persona.id_persona')
            ->join('instrumento', 'inversion.id_instrumento', '=', 'instrumento.id_instrumento')
            ->join('emisor', 'instrumento.id_emisor', '=', 'emisor.id_emisor')
            ->join('catalogo_valor', 'instrumento.id_tipo_inversion', '=', 'catalogo_valor.id_catalogo_valor')
            ->whereDate('fecha_pago', $fecha)
            ->where(function($query) {
                // Lógica del SP: (A.is_active = 1 OR I.inv_fecha_venta IS NULL)
                $query->where('amortizacion.activo', 1)
                      ->orWhereNull('inversion.fecha_venta');
            })
            ->where('amortizacion.eliminado', 0)
            ->where('inversion.eliminado', 0)
            ->where('instrumento.activo', 1)
            ->where('emisor.activo', 1)
            ->groupBy('persona.id_persona', 'persona.nombres', 'persona.apellidos', 'emisor.id_emisor', 'emisor.nombre', 'catalogo_valor.id_catalogo_valor', 'catalogo_valor.nombre')
            ->orderBy('persona.nombres')
            ->orderBy('persona.apellidos')
            ->orderBy('emisor.nombre')
            ->orderBy('catalogo_valor.nombre');

            $results = $query->get();

            // Formatear resultados
            $detalle = [];
            foreach ($results as $row) {
                $detalle[] = [
                    'id_persona' => $row->id_persona,
                    'propietario' => $row->propietario,
                    'id_emisor' => $row->id_emisor,
                    'emisor' => $row->emisor,
                    'id_tipo_inversion' => $row->id_tipo_inversion,
                    'tipo_inversion' => $row->tipo_inversion,
                    'cantidad_instrumentos' => $row->cantidad_instrumentos,
                    'interes' => round((float) $row->interes, 2),
                    'capital' => round((float) $row->capital, 2),
                    'premio' => round((float) $row->premio, 2),
                    'interes_riesgo' => round((float) $row->interes_riesgo, 2),
                    'capital_riesgo' => round((float) $row->capital_riesgo, 2),
                    'premio_riesgo' => round((float) $row->premio_riesgo, 2),
                    'total' => round((float) $row->total, 2)
                ];
            }

            return response()->json([
                'success' => true,
                'data' => $detalle
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener detalle de vencimientos: ' . $e->getMessage()
            ], 500);
        }
    }
}
