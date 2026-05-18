<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RecuperacionAnualController extends Controller
{
    public function getRecuperacionAnual(Request $request)
    {
        $historico = $request->query('historico', 0);

        try {
            $results = DB::select('CALL SP_RECUPERACION_ANUAL(?)', [$historico]);

            return response()->json($results);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al ejecutar el stored procedure',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
