<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GananciaAnualController extends Controller
{
    public function getGananciaAnual(Request $request)
    {
        try {
            // Se agrupa por año de fecha_venta y se suma la ganancia_perdida
            // Solo registros activos y no eliminados
            $results = DB::table('venta_inversion')
                ->select(DB::raw('YEAR(fecha_venta) as anio'), DB::raw('SUM(ganancia_perdida) as ganancia'))
                ->where('activo', 1)
                ->where('eliminado', 0)
                ->whereNotNull('fecha_venta')
                ->groupBy(DB::raw('YEAR(fecha_venta)'))
                ->orderBy('anio', 'asc')
                ->get();

            return response()->json($results);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener la ganancia anual',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
