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
}
