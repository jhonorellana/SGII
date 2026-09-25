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

            // Obtener mapeo oficial de emisores legacy
            $emisorMap = [];
            try {
                $emisorMap = DB::table('map_emisor_legacy')
                    ->pluck('id_emisor_legacy', 'id_emisor')
                    ->toArray();
            } catch (\Exception $e) {}

            foreach ($snapshots as $snap) {
                $emisorNombre = $snap->emisor ? $snap->emisor->nombre : '';
                $matched = $this->findBestMatch($emisorNombre, $snap->id_emisor, $emisorMap, $lastDates);

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

                    $snap->precio_anterior = ($matched->PREV_AVG_PRICE !== null && $matched->PREV_AVG_PRICE > 0) ? (float)$matched->PREV_AVG_PRICE : null;
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

    private function cleanEmisorName($str)
    {
        if (empty($str)) return '';
        $s = mb_strtoupper(trim($str));
        $s = preg_replace('/\b(DE|DEL|LA|LAS|LOS|EL|SA|S\.A\.|C\.A\.|CA|INC|CORP|CORPORACION|SOCIEDAD|ANONIMA|COMPANIA|CIA)\b/u', '', $s);
        return preg_replace('/[^A-Z0-9]/', '', $s);
    }

    private function findBestMatch($targetName, $idEmisor, $emisorMap, $lastDates)
    {
        if ($idEmisor && isset($emisorMap[$idEmisor])) {
            $legacyId = $emisorMap[$idEmisor];
            foreach ($lastDates as $ld) {
                if (!empty($ld->SHA_ISSUER_ID) && $ld->SHA_ISSUER_ID == $legacyId) {
                    return $ld;
                }
            }
        }

        $cleanTarget = $this->cleanEmisorName($targetName);
        if (empty($cleanTarget)) return null;

        $bestMatch = null;
        $bestScore = 0;

        foreach ($lastDates as $ld) {
            $cleanCand = $this->cleanEmisorName($ld->SHA_ISSUER);
            if (empty($cleanCand)) continue;

            if ($cleanTarget === $cleanCand) {
                return $ld;
            }

            if (strlen($cleanTarget) >= 4 && strlen($cleanCand) >= 4) {
                if (strpos($cleanCand, $cleanTarget) !== false || strpos($cleanTarget, $cleanCand) !== false) {
                    $minLen = min(strlen($cleanTarget), strlen($cleanCand));
                    $maxLen = max(strlen($cleanTarget), strlen($cleanCand));
                    $score = 80 + (($minLen / $maxLen) * 20);

                    if ($score > $bestScore) {
                        $bestScore = $score;
                        $bestMatch = $ld;
                    }
                }
            }
        }

        return $bestMatch;
    }
}
