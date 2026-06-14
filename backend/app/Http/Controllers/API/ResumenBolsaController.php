<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ResumenBolsaController extends Controller
{
    /**
     * Obtener resumen diario de transacciones de bolsa
     * GET /api/reportes/resumen-diario
     */
    public function obtenerResumenDiario(Request $request)
    {
        $request->validate([
            'fecha_inicio' => 'required|date_format:Y-m-d',
            'fecha_fin'    => 'nullable|date_format:Y-m-d',
        ]);

        $fechaInicio = $request->query('fecha_inicio');
        $fechaFin = $request->query('fecha_fin', $fechaInicio);

        try {
            // 1. Bonos
            $bonos = DB::connection('mysql_inversion')
                ->table('bond_his')
                ->select([
                    'id',
                    'FECHA as fecha',
                    'DECRETO as decreto',
                    'PRECIO_PORC as precio_porc',
                    'RENDIMIENTO_PORC as rendimiento',
                    'PLAZO_POR_VENCER as dias_por_vencer',
                    DB::raw('ROUND(PLAZO_POR_VENCER / 360, 2) as anios_por_vencer'),
                    'TASA_INTERES as tasa_interes',
                    'VALOR_NOMINAL as valor_nominal',
                    'VALOR_EFECTIVO as valor_efectivo',
                    'FECHA_EMISION as fecha_emision',
                    'FECHA_VENCIMIENTO as fecha_vencimiento',
                    'PROCEDENCIA as procedencia',
                    'TIPO as tipo',
                    'TIPO_MERCADO_1 as tipo_mercado'
                ])
                ->whereBetween('FECHA', [$fechaInicio, $fechaFin])
                ->orderByDesc('RENDIMIENTO_PORC')
                ->get();

            // 2. Obligaciones
            $obligaciones = DB::connection('mysql_inversion')
                ->table('obligaciones_his')
                ->select([
                    'id',
                    'FECHA as fecha',
                    'EMISOR as emisor',
                    'PRECIO_PORC as precio_porc',
                    'RENDIMIENTO as rendimiento',
                    'PLAZO_DIAS as plazo_dias',
                    DB::raw('ROUND(PLAZO_DIAS / 360, 2) as plazo_anios'),
                    'INTERES as interes',
                    'VALOR_NOMINAL as valor_nominal',
                    'VALOR_EFECTIVO as valor_efectivo',
                    'EMISION as emision',
                    'VENCIMIENTO as vencimiento',
                    'PROCEDENCIA as procedencia',
                    'TIPO_MERCADO as mercado'
                ])
                ->whereBetween('FECHA', [$fechaInicio, $fechaFin])
                ->orderByDesc('RENDIMIENTO')
                ->get();

            // 3. Papeles Comerciales
            $papeles = DB::connection('mysql_inversion')
                ->table('papeles_his')
                ->select([
                    'id',
                    'FECHA as fecha',
                    'EMISOR as emisor',
                    'PRECIO_PORC as precio_porc',
                    'RENDIMIENTO as rendimiento',
                    'PLAZO_DIAS as plazo_dias',
                    DB::raw('ROUND(PLAZO_DIAS / 360, 2) as plazo_anios'),
                    'DESCUENTO_PORC as descuento_porc',
                    'INTERES as interes',
                    'VALOR_NOMINAL as valor_nominal',
                    'VALOR_EFECTIVO as valor_efectivo',
                    'EMISION as emision',
                    'VENCIMIENTO as vencimiento',
                    'PROCEDENCIA as procedencia',
                    'MERCADO as mercado'
                ])
                ->whereBetween('FECHA', [$fechaInicio, $fechaFin])
                ->orderByDesc('RENDIMIENTO')
                ->get();

            // 4. Facturas
            $facturas = DB::connection('mysql_inversion')
                ->table('facturas_his')
                ->select([
                    'id',
                    'FECHA as fecha',
                    'EMISOR as emisor',
                    'PRECIO_PORC as precio_porc',
                    'VALOR_NOMINAL as valor_nominal',
                    'VALOR_EFECTIVO as valor_efectivo',
                    'EMISION as emision',
                    'VENCIMIENTO as vencimiento',
                    'RENDIMIENTO as rendimiento',
                    'PROCEDENCIA as procedencia',
                    'OBSERVACIONES as observaciones'
                ])
                ->whereBetween('FECHA', [$fechaInicio, $fechaFin])
                ->orderByDesc('RENDIMIENTO')
                ->get();

            // 5. Titularizaciones
            $titularizaciones = DB::connection('mysql_inversion')
                ->table('titularizaciones_his')
                ->select([
                    'id',
                    'FECHA as fecha',
                    'EMISOR as emisor',
                    'PRECIO_PORC as precio_porc',
                    'RENDIMIENTO as rendimiento',
                    'PLAZO_DIAS as plazo_dias',
                    DB::raw('ROUND(PLAZO_DIAS / 360, 2) as plazo_anios'),
                    'INTERES as interes',
                    'VALOR_NOMINAL as valor_nominal',
                    'VALOR_EFECTIVO as valor_efectivo',
                    'EMISION as emision',
                    'VENCIMIENTO as vencimiento',
                    'PROCEDENCIA as procedencia',
                    'MERCADO as mercado'
                ])
                ->whereBetween('FECHA', [$fechaInicio, $fechaFin])
                ->orderByDesc('RENDIMIENTO')
                ->get();

            // 6. Acciones (shares)
            $acciones = DB::connection('mysql_inversion')
                ->table('shares')
                ->select([
                    'SHA_ID as id',
                    'SHA_ISSUER_ID as id_emisor',
                    'SHA_DATE as fecha',
                    'SHA_ISSUER as emisor',
                    'SHA_TYPE as tipo',
                    'SHA_NOMINAL_VALUE as valor_nominal',
                    'SHA_PRICE as precio',
                    'SHA_NUMBER as cantidad',
                    'SHA_CASH_VALUE as efectivo',
                    'SHA_PROVENANCE as procedencia'
                ])
                ->where('SHA_TYPE', 'LIKE', '%ACCIONES%')
                ->whereBetween('SHA_DATE', [$fechaInicio, $fechaFin])
                ->orderBy('SHA_TYPE')
                ->orderBy('SHA_ISSUER')
                ->orderByDesc('SHA_PRICE')
                ->get();

            // 7. Valores Genericos
            $genericos = DB::connection('mysql_inversion')
                ->table('genericos_his')
                ->select([
                    'id',
                    'FECHA as fecha',
                    'EMISOR as emisor',
                    'PRECIO_PORC as precio_porc',
                    'RENDIMIENTO as rendimiento',
                    'PLAZO_DIAS as plazo_dias',
                    DB::raw('ROUND(PLAZO_DIAS / 360, 2) as plazo_anios'),
                    'INTERES as interes',
                    'VALOR_NOMINAL as valor_nominal',
                    'VALOR_EFECTIVO as valor_efectivo',
                    'EMISION as emision',
                    'VENCIMIENTO as vencimiento',
                    'PROCEDENCIA as procedencia',
                    'TITULO as titulo',
                    'MERCADO as mercado'
                ])
                ->whereBetween('FECHA', [$fechaInicio, $fechaFin])
                ->orderByDesc('RENDIMIENTO')
                ->get();

            // Retornar respuesta estructurada
            return response()->json([
                'exito' => true,
                'datos' => [
                    'bonos'            => $bonos,
                    'obligaciones'     => $obligaciones,
                    'papeles'          => $papeles,
                    'facturas'         => $facturas,
                    'titularizaciones' => $titularizaciones,
                    'acciones'         => $acciones,
                    'genericos'        => $genericos
                ]
            ], Response::HTTP_OK);

        } catch (\Exception $e) {
            Log::error('Error al obtener resumen de bolsa diario: ' . $e->getMessage());
            return response()->json([
                'exito'   => false,
                'mensaje' => 'Error al ejecutar las consultas del resumen de bolsa: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Obtener el último precio registrado para cada acción cotizada
     * GET /api/reportes/acciones-ultimo-cierre
     */
    public function obtenerUltimoCierreAcciones()
    {
        try {
            $cierres = DB::connection('mysql_inversion')
                ->table('shares_lastdate')
                ->select([
                    'SHA_ISSUER_ID as id_emisor',
                    'SHA_ISSUER as emisor',
                    'MAX_DATE as fecha_maxima',
                    'MAX_PRICE as precio_maximo',
                    'MIN_PRICE as precio_minimo',
                    'AVG_PRICE as precio_promedio'
                ])
                ->orderByDesc('MAX_DATE')
                ->get();

            return response()->json([
                'exito' => true,
                'datos' => $cierres
            ], Response::HTTP_OK);

        } catch (\Exception $e) {
            Log::error('Error al obtener últimos cierres de acciones: ' . $e->getMessage());
            return response()->json([
                'exito'   => false,
                'mensaje' => 'Error al consultar shares_lastdate: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}
