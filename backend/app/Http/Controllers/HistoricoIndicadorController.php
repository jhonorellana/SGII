<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\HistoricoIndicador;
use Illuminate\Support\Facades\Log;

class HistoricoIndicadorController extends Controller
{
    /**
     * Display a listing of active snapshots ordered by date.
     */
    public function index()
    {
        try {
            $historicos = HistoricoIndicador::where('activo', true)
                                            ->orderBy('fecha_captura', 'asc')
                                            ->get();

            return response()->json([
                'success' => true,
                'data' => $historicos
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching historico_indicadores: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el historial de indicadores.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created snapshot in storage.
     */
    public function store(Request $request)
    {
        try {
            $data = $request->validate([
                'fecha_captura' => 'required|date',
                'patrimonio_base' => 'numeric',
                'patrimonio_consolidado' => 'numeric',
                'proyeccion_1_ano' => 'numeric',
                'patrimonio_proyectado_consolidado' => 'numeric',
                'intereses_esperados' => 'numeric',
                'total_corriente' => 'numeric',
                'dividendos_acciones' => 'numeric',
                'dividendos_efectivo' => 'numeric',
                'plusvalia_acciones' => 'numeric',
                'capital_renta_fija' => 'numeric',
                'capital_renta_variable' => 'numeric',
                'valor_mercado_renta_variable' => 'nullable|numeric',
                'plusvalia_latente_rv' => 'nullable|numeric',
                'capital_notas_credito' => 'numeric',
                'valor_compra_nc' => 'numeric',
                'valor_venta_nc' => 'numeric',
                'utilidad_nc' => 'numeric',
            ]);

            $force = $request->input('force', false);
            $fecha_captura = $data['fecha_captura'];

            $existente = HistoricoIndicador::where('fecha_captura', $fecha_captura)
                                           ->where('activo', true)
                                           ->first();

            if ($existente && !$force) {
                return response()->json([
                    'success' => false,
                    'code' => 'ALREADY_EXISTS',
                    'message' => 'Ya existe un histórico activo para la fecha indicada.'
                ], 409); // Conflict
            }

            if ($existente && $force) {
                $existente->update(['activo' => false]);
            }

            $historico = HistoricoIndicador::create($data);

            return response()->json([
                'success' => true,
                'message' => 'Histórico creado con éxito',
                'data' => $historico
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error al guardar historico de indicadores: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al guardar el snapshot.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
