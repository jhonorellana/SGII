<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\InversionPdfImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class InversionPdfImportController extends Controller
{
    public function __construct(
        protected InversionPdfImportService $importService
    ) {}

    /**
     * Recibe los archivos PDF y genera una vista previa con los datos extraídos
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
            Log::error('Error en InversionPdfImportController@preview: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al procesar los archivos PDF: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Guarda las inversiones validadas por el usuario en la base de datos
     */
    public function confirm(Request $request): JsonResponse
    {
        $request->validate([
            'inversiones' => 'required|array|min:1',
            'inversiones.*.liquidacion' => 'required|string',
            'inversiones.*.id_propietario' => 'required|integer',
            'inversiones.*.valor_nominal' => 'required|numeric|gt:0',
            'inversiones.*.capital_invertido' => 'required|numeric|gt:0',
        ]);

        try {
            $inversiones = $request->input('inversiones');
            $resultado = $this->importService->confirm($inversiones);

            return response()->json([
                'success' => true,
                'message' => "Se importaron exitosamente {$resultado['total_guardados']} inversiones.",
                'data' => $resultado,
            ]);
        } catch (\Throwable $e) {
            Log::error('Error en InversionPdfImportController@confirm: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al guardar las inversiones: ' . $e->getMessage(),
            ], 500);
        }
    }
}
