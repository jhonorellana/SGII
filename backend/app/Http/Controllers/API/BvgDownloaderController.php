<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\BvgDownloaderService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BvgDownloaderController extends Controller
{
    protected BvgDownloaderService $downloaderService;

    public function __construct(BvgDownloaderService $downloaderService)
    {
        $this->downloaderService = $downloaderService;
    }

    /**
     * Ejecuta la descarga completa de los 10 archivos de la BVG para la fecha indicada (o hoy)
     */
    public function descargar(Request $request)
    {
        try {
            $fecha = $request->input('fecha', date('Y-m-d'));
            $resultado = $this->downloaderService->downloadAll($fecha);

            return response()->json([
                'success' => $resultado['success'],
                'message' => $resultado['success'] 
                    ? "Descarga BVG completada exitosamente ({$resultado['exitosos']}/{$resultado['total_archivos']} archivos en {$resultado['tiempo_ejecucion_segundos']}s)."
                    : "Descarga BVG completada con algunos errores ({$resultado['exitosos']} exitosos, {$resultado['fallidos']} fallidos).",
                'data' => $resultado
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error durante el proceso de descarga de archivos BVG',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Descarga únicamente el archivo Excel correspondiente a un módulo específico de la BVG
     */
    public function descargarModulo(Request $request)
    {
        try {
            $modulo = $request->input('modulo');
            $fecha = $request->input('fecha', date('Y-m-d'));

            if (!$modulo) {
                return response()->json([
                    'success' => false,
                    'message' => 'Se requiere el parámetro "modulo"'
                ], Response::HTTP_BAD_REQUEST);
            }

            $resultado = $this->downloaderService->downloadSingleModule($modulo, $fecha);

            return response()->json([
                'success' => $resultado['success'],
                'message' => $resultado['message'],
                'data' => $resultado
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => "Error al descargar el módulo BVG {$request->input('modulo')}",
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Obtiene el historial de carpetas descargadas previamente para la BVG
     */
    public function historial()
    {
        try {
            $history = $this->downloaderService->getHistory();

            return response()->json([
                'success' => true,
                'data' => $history
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el historial de descargas BVG',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}
