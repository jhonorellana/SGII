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
                ->join('catalogo_valor', 'venta_inversion.id_tipo_venta', '=', 'catalogo_valor.id_catalogo_valor')
                ->select(
                    DB::raw('YEAR(venta_inversion.fecha_venta) as anio'), 
                    'catalogo_valor.nombre as tipo_venta',
                    DB::raw('SUM(venta_inversion.ganancia_perdida) as ganancia')
                )
                ->where('venta_inversion.activo', 1)
                ->where('venta_inversion.eliminado', 0)
                ->whereNotNull('venta_inversion.fecha_venta')
                ->groupBy(DB::raw('YEAR(venta_inversion.fecha_venta)'), 'catalogo_valor.nombre')
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
