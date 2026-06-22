<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SnapshotCarteraDiaria;
use Illuminate\Http\Request;

class PortfolioIndicadoresController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        try {
            // Get today's snapshot for the user's holdings (where cantidad_posicion > 0)
            $snapshots = SnapshotCarteraDiaria::with('emisor')
                ->where('cantidad_posicion', '>', 0)
                ->whereDate('fecha', now()->toDateString())
                ->get();

            // If the nightly job hasn't run yet for today, fallback to the latest available snapshot
            if ($snapshots->isEmpty()) {
                $latestDate = SnapshotCarteraDiaria::max('fecha');
                if ($latestDate) {
                    $snapshots = SnapshotCarteraDiaria::with('emisor')
                        ->where('cantidad_posicion', '>', 0)
                        ->whereDate('fecha', $latestDate)
                        ->get();
                }
            }

            return response()->json([
                'success' => true,
                'data' => $snapshots
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al cargar los indicadores del portafolio',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
