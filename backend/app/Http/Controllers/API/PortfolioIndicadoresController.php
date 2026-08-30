<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SnapshotCarteraDiaria;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PortfolioIndicadoresController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        try {
            // Refrescar snapshot para garantizar cantidades consolidadas en tiempo real
            try {
                DB::statement('CALL sp_actualizar_snapshot_cartera()');
            } catch (\Exception $ex) {
                \Illuminate\Support\Facades\Log::warning('Error en sp_actualizar_snapshot_cartera: ' . $ex->getMessage());
            }

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

            // Enriquecer snapshots con los datos reales de shares_lastdate
            $lastDates = [];
            try {
                $lastDates = DB::connection('mysql_inversion')->table('shares_lastdate')->get();
            } catch (\Exception $e) {}

            foreach ($snapshots as $snap) {
                $emisorNombre = $snap->emisor ? $snap->emisor->nombre : '';
                $matched = null;

                foreach ($lastDates as $ld) {
                    if ($this->matchEmisor($emisorNombre, $ld->SHA_ISSUER)) {
                        $matched = $ld;
                        break;
                    }
                }
                if (!$matched) {
                    foreach ($lastDates as $ld) {
                        if (!empty($ld->SHA_ISSUER_ID) && $snap->id_emisor == $ld->SHA_ISSUER_ID) {
                            $matched = $ld;
                            break;
                        }
                    }
                }

                if ($matched) {
                    $precioUlt = (float)($matched->AVG_PRICE ?? $matched->MAX_PRICE ?? 0);
                    if ($precioUlt > 0) {
                        $snap->precio_mercado = $precioUlt;
                        $snap->valor_mercado = (float)$snap->cantidad_posicion * $precioUlt;
                        $costoTotal = (float)$snap->cantidad_posicion * (float)$snap->costo_promedio;
                        $snap->pl_no_realizado = $snap->valor_mercado - $costoTotal;
                        if ((float)$snap->costo_promedio > 0) {
                            $snap->porcentaje_no_realizado = round((($precioUlt - (float)$snap->costo_promedio) / (float)$snap->costo_promedio) * 100, 2);
                        }
                    }

                    $snap->precio_anterior = (float)($matched->PREV_AVG_PRICE ?? 0);
                    $snap->fecha_anterior = $matched->PREV_DATE ?? null;
                    $snap->fecha_cierre = $matched->MAX_DATE ?? null;
                    $snap->cambio_diario = (float)($matched->DAILY_CHANGE ?? 0);
                    $snap->variacion_diaria_pct = (float)($matched->DAILY_VARIATION_PCT ?? 0);

                    // Re-evaluar alertas de variación diaria
                    $alertas = is_array($snap->alertas) ? $snap->alertas : (json_decode($snap->alertas, true) ?: []);
                    if (abs($snap->variacion_diaria_pct) >= 2.0) {
                        $txt = $snap->variacion_diaria_pct > 0 ? "Variacion diaria > 2.00%" : "Variacion diaria < -2.00%";
                        if (!in_array($txt, $alertas)) {
                            $alertas[] = $txt;
                        }
                    }
                    $snap->alertas = $alertas;
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

    private function matchEmisor($name1, $name2)
    {
        if (empty($name1) || empty($name2)) return false;
        $n1 = trim(mb_strtoupper($name1));
        $n2 = trim(mb_strtoupper($name2));
        if ($n1 === $n2) return true;

        $clean1 = preg_replace('/[^A-Z0-9]/', '', $n1);
        $clean2 = preg_replace('/[^A-Z0-9]/', '', $n2);
        if (!empty($clean1) && !empty($clean2)) {
            if ($clean1 === $clean2) return true;
            if (strlen($clean1) >= 5 && strlen($clean2) >= 5) {
                if (strpos($clean1, $clean2) !== false || strpos($clean2, $clean1) !== false) return true;
            }
        }

        $ignore = ['BANCO', 'DE', 'LA', 'EL', 'LOS', 'LAS', 'SA', 'CA', 'SOCIEDAD', 'ANONIMA', 'CORPORACION', 'COMPANIA', 'FONDO', 'INVERSION', 'ACCIONES'];
        $words1 = array_filter(explode(' ', preg_replace('/[^A-Z0-9 ]/', '', $n1)), fn($w) => strlen($w) >= 5 && !in_array($w, $ignore));
        $words2 = array_filter(explode(' ', preg_replace('/[^A-Z0-9 ]/', '', $n2)), fn($w) => strlen($w) >= 5 && !in_array($w, $ignore));

        foreach ($words1 as $w1) {
            foreach ($words2 as $w2) {
                if ($w1 === $w2) return true;
            }
        }

        return false;
    }
}
