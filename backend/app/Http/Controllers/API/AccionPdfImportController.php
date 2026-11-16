<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\AccionPdfImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AccionPdfImportController extends Controller
{
    public function __construct(
        protected AccionPdfImportService $importService
    ) {}

    /**
     * Procesa archivos PDF de liquidaciones de Renta Variable (Acciones BVQ/BVG) y retorna la previsualización
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'files' => 'required|array|min:1',
            'files.*' => 'required|file|mimes:pdf|max:20480', // Máx 20MB por PDF
        ]);

        try {
            $files = $request->file('files');
            $data = $this->importService->preview($files);

            return response()->json([
                'success' => true,
                'data' => $data,
            ]);
        } catch (\Throwable $e) {
            Log::error('Error en AccionPdfImportController@preview: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al procesar los archivos PDF de Acciones: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Guarda en accion_operacion (y movimiento_capital) las operaciones de Acciones confirmadas por el usuario
     */
    public function confirm(Request $request): JsonResponse
    {
        $request->validate([
            'operaciones' => 'required|array|min:1',
            'operaciones.*.liquidacion' => 'required|string',
            'operaciones.*.id_persona' => 'required|integer',
            'operaciones.*.cantidad' => 'required|numeric|gt:0',
            'operaciones.*.precio_unitario' => 'required|numeric|gte:0',
            'operaciones.*.valor_neto' => 'required|numeric|gt:0',
            'registrar_movimiento_capital' => 'nullable|boolean',
        ]);

        try {
            $operaciones = $request->input('operaciones');
            $registrarMovimientoCapital = $request->boolean('registrar_movimiento_capital', true);

            $resultado = $this->importService->confirm($operaciones, $registrarMovimientoCapital);

            return response()->json([
                'success' => true,
                'message' => "Se importaron exitosamente {$resultado['total_guardados']} operaciones de acciones.",
                'data' => $resultado,
            ]);
        } catch (\Throwable $e) {
            Log::error('Error en AccionPdfImportController@confirm: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al guardar las operaciones de acciones: ' . $e->getMessage(),
            ], 500);
        }
    }
}

