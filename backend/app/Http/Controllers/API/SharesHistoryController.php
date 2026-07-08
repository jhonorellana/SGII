<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SharesHistoryController extends Controller
{
    public function getHistoricoAcciones(Request $request)
    {
        $request->validate([
            'issuer' => 'required|integer',
            'year' => 'nullable|integer'
        ]);

        $issuer = $request->query('issuer');
        $year = $request->query('year', 0); // 0 means all years

        try {
            // Invocar el stored procedure en la base de datos mysql_inversion
            $resultados = DB::connection('mysql_inversion')->select(
                'CALL SP_SHARES_SUMMARY(?, ?)', 
                [$issuer, $year]
            );

            return response()->json([
                'success' => true,
                'data' => $resultados
            ], Response::HTTP_OK);

        } catch (\Exception $e) {
            Log::error('Error al ejecutar SP_SHARES_SUMMARY: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al ejecutar SP_SHARES_SUMMARY: ' . $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function getDetallesDiarios(Request $request)
    {
        $request->validate([
            'issuer' => 'required|integer',
            'date' => 'required|date_format:Y-m-d'
        ]);

        $issuer = $request->query('issuer');
        $date = $request->query('date');

        try {
            $detalles = DB::connection('mysql_inversion')
                ->table('shares')
                ->select([
                    'SHA_ID as id',
                    'SHA_NUMBER as cantidad',
                    'SHA_PRICE as precio',
                    'SHA_NOMINAL_VALUE as valor_nominal',
                    'SHA_CASH_VALUE as valor_efectivo',
                    'SHA_TYPE as tipo'
                ])
                ->where('SHA_ISSUER_ID', $issuer)
                ->where('SHA_DATE', $date)
                ->where('SHA_TYPE', 'ACCIONES')
                ->where('SHA_PRICE', '>', 0)
                ->where('SHA_NUMBER', '>', 0)
                ->get();

            return response()->json([
                'success' => true,
                'data' => $detalles
            ], Response::HTTP_OK);

        } catch (\Exception $e) {
            Log::error('Error al consultar detalles en shares: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al consultar detalles de transacciones.'
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}
