<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\BvqDownloaderService;
use App\Services\SharesImportService;
use App\Services\BondsImportService;
use App\Services\DividendsImportService;
use App\Services\FacturasImportService;
use App\Services\GenericosImportService;
use App\Services\ObligacionesImportService;
use App\Services\PapelesImportService;
use App\Services\TitularizacionesImportService;
use App\Services\VectorPreciosEtlService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BvqDownloaderController extends Controller
{
    protected BvqDownloaderService $downloaderService;
    protected SharesImportService $sharesImportService;
    protected BondsImportService $bondsImportService;
    protected DividendsImportService $dividendsImportService;
    protected FacturasImportService $facturasImportService;
    protected GenericosImportService $genericosImportService;
    protected ObligacionesImportService $obligacionesImportService;
    protected PapelesImportService $papelesImportService;
    protected TitularizacionesImportService $titularizacionesImportService;
    protected VectorPreciosEtlService $vectorPreciosEtlService;

    public function __construct(
        BvqDownloaderService $downloaderService,
        SharesImportService $sharesImportService,
        BondsImportService $bondsImportService,
        DividendsImportService $dividendsImportService,
        FacturasImportService $facturasImportService,
        GenericosImportService $genericosImportService,
        ObligacionesImportService $obligacionesImportService,
        PapelesImportService $papelesImportService,
        TitularizacionesImportService $titularizacionesImportService,
        VectorPreciosEtlService $vectorPreciosEtlService
    ) {
        $this->downloaderService = $downloaderService;
        $this->sharesImportService = $sharesImportService;
        $this->bondsImportService = $bondsImportService;
        $this->dividendsImportService = $dividendsImportService;
        $this->facturasImportService = $facturasImportService;
        $this->genericosImportService = $genericosImportService;
        $this->obligacionesImportService = $obligacionesImportService;
        $this->papelesImportService = $papelesImportService;
        $this->titularizacionesImportService = $titularizacionesImportService;
        $this->vectorPreciosEtlService = $vectorPreciosEtlService;
    }

    /**
     * Ejecuta la descarga completa de los 42 archivos de la BVQ para la fecha indicada (o hoy)
     */
    public function descargar(Request $request)
    {
        try {
            $fecha = $request->input('fecha', date('Y-m-d'));
            $importarAcciones = $request->boolean('importar_acciones', false);
            $importarBonos = $request->boolean('importar_bonos', false);
            $importarDividendos = $request->boolean('importar_dividendos', false);
            $importarFacturas = $request->boolean('importar_facturas', false);
            $importarGenericos = $request->boolean('importar_genericos', false);
            $importarObligaciones = $request->boolean('importar_obligaciones', false);
            $importarPapeles = $request->boolean('importar_papeles', false);
            $importarTitularizaciones = $request->boolean('importar_titularizaciones', false);

            $resultado = $this->downloaderService->downloadAll($fecha);

            if ($importarAcciones) {
                $resultado['importacion_acciones'] = $this->sharesImportService->importFromExcel($fecha);
            }

            if ($importarBonos) {
                $resultado['importacion_bonos'] = $this->bondsImportService->importFromExcel($fecha);
            }

            if ($importarDividendos) {
                $resultado['importacion_dividendos'] = $this->dividendsImportService->importFromExcel($fecha);
            }

            if ($importarFacturas) {
                $resultado['importacion_facturas'] = $this->facturasImportService->importFromExcel($fecha);
            }

            if ($importarGenericos) {
                $resultado['importacion_genericos'] = $this->genericosImportService->importFromExcel($fecha);
            }

            if ($importarObligaciones) {
                $resultado['importacion_obligaciones'] = $this->obligacionesImportService->importFromExcel($fecha);
            }

            if ($importarPapeles) {
                $resultado['importacion_papeles'] = $this->papelesImportService->importFromExcel($fecha);
            }

            if ($importarTitularizaciones) {
                $resultado['importacion_titularizaciones'] = $this->titularizacionesImportService->importFromExcel($fecha);
            }

            return response()->json([
                'success' => $resultado['success'],
                'message' => $resultado['success'] 
                    ? "Descarga completada exitosamente ({$resultado['exitosos']}/{$resultado['total_archivos']} archivos en {$resultado['tiempo_ejecucion_segundos']}s)."
                    : "Descarga completada con algunos errores ({$resultado['exitosos']} exitosos, {$resultado['fallidos']} fallidos).",
                'data' => $resultado
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error durante el proceso de descarga de archivos BVQ',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Descarga únicamente el archivo Excel correspondiente a un módulo específico
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
                'message' => "Error al descargar el módulo {$request->input('modulo')}",
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Importa las cotizaciones de acciones desde el Excel descargado a la tabla 'shares'
     */
    public function importarAcciones(Request $request)
    {
        try {
            $fecha = $request->input('fecha', date('Y-m-d'));
            $resultado = $this->sharesImportService->importFromExcel($fecha);

            return response()->json([
                'success' => $resultado['success'],
                'message' => $resultado['message'],
                'data' => $resultado
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar datos a la tabla shares',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Importa las cotizaciones de bonos desde el Excel descargado a la tabla 'bond_his'
     */
    public function importarBonos(Request $request)
    {
        try {
            $fecha = $request->input('fecha', date('Y-m-d'));
            $resultado = $this->bondsImportService->importFromExcel($fecha);

            return response()->json([
                'success' => $resultado['success'],
                'message' => $resultado['message'],
                'data' => $resultado
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar datos a la tabla bond_his',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Importa el histórico de dividendos desde el Excel descargado a la tabla 'dividendos_his'
     */
    public function importarDividendos(Request $request)
    {
        try {
            $fecha = $request->input('fecha', date('Y-m-d'));
            $resultado = $this->dividendsImportService->importFromExcel($fecha);

            return response()->json([
                'success' => $resultado['success'],
                'message' => $resultado['message'],
                'data' => $resultado
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar datos a la tabla dividendos_his',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Importa las cotizaciones de facturas comerciales a la tabla 'facturas_his'
     */
    public function importarFacturas(Request $request)
    {
        try {
            $fecha = $request->input('fecha', date('Y-m-d'));
            $resultado = $this->facturasImportService->importFromExcel($fecha);

            return response()->json([
                'success' => $resultado['success'],
                'message' => $resultado['message'],
                'data' => $resultado
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar datos a la tabla facturas_his',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Importa las cotizaciones de valores genéricos a la tabla 'genericos_his'
     */
    public function importarGenericos(Request $request)
    {
        try {
            $fecha = $request->input('fecha', date('Y-m-d'));
            $resultado = $this->genericosImportService->importFromExcel($fecha);

            return response()->json([
                'success' => $resultado['success'],
                'message' => $resultado['message'],
                'data' => $resultado
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar datos a la tabla genericos_his',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Importa las cotizaciones de obligaciones a la tabla 'obligaciones_his'
     */
    public function importarObligaciones(Request $request)
    {
        try {
            $fecha = $request->input('fecha', date('Y-m-d'));
            $resultado = $this->obligacionesImportService->importFromExcel($fecha);

            return response()->json([
                'success' => $resultado['success'],
                'message' => $resultado['message'],
                'data' => $resultado
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar datos a la tabla obligaciones_his',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Importa las cotizaciones de papel comercial a la tabla 'papeles_his'
     */
    public function importarPapeles(Request $request)
    {
        try {
            $fecha = $request->input('fecha', date('Y-m-d'));
            $resultado = $this->papelesImportService->importFromExcel($fecha);

            return response()->json([
                'success' => $resultado['success'],
                'message' => $resultado['message'],
                'data' => $resultado
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar datos a la tabla papeles_his',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Importa las cotizaciones de titularizaciones a la tabla 'titularizaciones_his'
     */
    public function importarTitularizaciones(Request $request)
    {
        try {
            $fecha = $request->input('fecha', date('Y-m-d'));
            $resultado = $this->titularizacionesImportService->importFromExcel($fecha);

            return response()->json([
                'success' => $resultado['success'],
                'message' => $resultado['message'],
                'data' => $resultado
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar datos a la tabla titularizaciones_his',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Importa la matriz de valoración del Vector de Precios Diario (BVQ)
     */
    public function importarVector(Request $request)
    {
        try {
            $filePath = $request->input('file_path');
            $resultado = $this->vectorPreciosEtlService->importVectorPrecios($filePath);

            return response()->json([
                'success' => $resultado['success'],
                'message' => $resultado['message'],
                'data' => $resultado
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar el Vector de Precios Diario',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Obtiene el historial de carpetas descargadas previamente y el estado de tablas en BD
     */
    public function historial()
    {
        try {
            $history = $this->downloaderService->getHistory();
            $lastDateShares = $this->sharesImportService->getLastDateInShares();
            $lastDateBonds = $this->bondsImportService->getLastDateInBonds();
            $totalDividends = $this->dividendsImportService->getTotalRecordsInDividends();
            $lastDateFacturas = $this->facturasImportService->getLastDateInFacturas();
            $lastDateGenericos = $this->genericosImportService->getLastDateInGenericos();
            $lastDateObligaciones = $this->obligacionesImportService->getLastDateInObligaciones();
            $lastDatePapeles = $this->papelesImportService->getLastDateInPapeles();
            $lastDateTitularizaciones = $this->titularizacionesImportService->getLastDateInTitularizaciones();
            $lastDateVector = \Illuminate\Support\Facades\DB::table('vector_precio_diario')->max('fecha_vector');

            return response()->json([
                'success' => true,
                'last_date_shares' => $lastDateShares,
                'last_date_bonds' => $lastDateBonds,
                'total_dividends' => $totalDividends,
                'last_date_facturas' => $lastDateFacturas,
                'last_date_genericos' => $lastDateGenericos,
                'last_date_obligaciones' => $lastDateObligaciones,
                'last_date_papeles' => $lastDatePapeles,
                'last_date_titularizaciones' => $lastDateTitularizaciones,
                'last_date_vector' => $lastDateVector,
                'data' => $history
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el historial de descargas',
                'error' => $e->getMessage()
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}



