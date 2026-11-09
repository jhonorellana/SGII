<?php

namespace App\Services;

use App\Models\Inversion;
use App\Models\Persona;
use App\Services\PdfParsers\PdfParserManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class InversionPdfImportService
{
    public function __construct(
        protected PdfParserManager $parserManager
    ) {}

    /**
     * Procesa los archivos subidos y devuelve la previsualización con validaciones
     *
     * @param array<UploadedFile> $files
     * @return array
     */
    public function preview(array $files): array
    {
        $personas = DB::table('persona')
            ->where('activo', 1)
            ->select('id_persona', 'nombres', 'apellidos', 'identificacion')
            ->orderBy('nombres')
            ->get();

        $previewItems = [];
        $resumen = [
            'total_archivos' => count($files),
            'validos' => 0,
            'duplicados' => 0,
            'con_error' => 0,
            'total_nominal' => 0.0,
            'total_invertido' => 0.0,
        ];

        foreach ($files as $file) {
            $originalName = $file->getClientOriginalName();
            $tempPath = $file->getRealPath();

            $dto = $this->parserManager->parseFile($tempPath, $originalName);

            if (!$dto->success || empty($dto->liquidacion)) {
                $resumen['con_error']++;
                $previewItems[] = [
                    'id_temporal' => uniqid('pdf_'),
                    'filename' => $originalName,
                    'bolsa' => $dto->bolsa,
                    'tipo_titulo' => $dto->tipoTitulo,
                    'liquidacion' => $dto->liquidacion,
                    'fecha_compra' => $dto->fechaNegociacion,
                    'comitente_nombre' => $dto->comitenteNombre,
                    'comitente_identificacion' => $dto->comitenteIdentificacion,
                    'id_propietario' => null,
                    'propietario_detectado' => null,
                    'id_grupo_familiar' => 1,
                    'valor_nominal' => $dto->valorNominal,
                    'precio_compra' => $dto->precioCompra,
                    'valor_efectivo' => $dto->valorEfectivo,
                    'comision_bolsa' => $dto->comisionBolsa,
                    'comision_casa_valores' => $dto->comisionCasaValores,
                    'capital_invertido' => $dto->totalInvertido,
                    'precio_neto_compra' => $dto->precioNetoCompra,
                    'factura_bolsa' => $dto->facturaBolsa,
                    'operador_valores' => $dto->operadorValores,
                    'estado' => 'ERROR',
                    'mensaje_estado' => $dto->errorMessage ?? 'No se pudo extraer la liquidación del documento.',
                    'seleccionado' => false,
                ];
                continue;
            }

            // Resolver propietario
            $propietarioMatched = $this->resolverPersona($dto->comitenteIdentificacion, $dto->comitenteNombre, $personas);
            $idPropietario = $propietarioMatched ? $propietarioMatched->id_persona : null;
            $nombrePropietario = $propietarioMatched ? trim($propietarioMatched->nombres . ' ' . $propietarioMatched->apellidos) : $dto->comitenteNombre;

            // Resolver grupo familiar
            $idGrupoFamiliar = 1;
            if ($idPropietario) {
                $gf = DB::table('grupo_familiar_persona')
                    ->where('id_persona', $idPropietario)
                    ->where('activo', 1)
                    ->value('id_grupo_familiar');
                if ($gf) {
                    $idGrupoFamiliar = (int) $gf;
                }
            }

            // Verificar duplicados en DB (soporta liquidación exacta o sin sufijo de bolsa ej. 22820-VRF45 vs 22820)
            $baseLiq = trim(explode('-', $dto->liquidacion)[0]);
            $existente = Inversion::where(function ($q) use ($dto, $baseLiq) {
                $q->where('liquidacion', $dto->liquidacion)
                  ->orWhere('liquidacion', $baseLiq);
            })->where('eliminado', 0)->first();

            $estado = 'VALIDO';
            $mensaje = 'Listo para importar';
            $seleccionado = true;

            if ($existente) {
                $estado = 'DUPLICADO';
                $mensaje = "Ya registrada en el sistema (Inversión #{$existente->id_inversion})";
                $seleccionado = false;
                $resumen['duplicados']++;
            } else {
                $resumen['validos']++;
                $resumen['total_nominal'] += $dto->valorNominal;
                $resumen['total_invertido'] += $dto->totalInvertido;
            }

            $previewItems[] = [
                'id_temporal' => uniqid('pdf_'),
                'filename' => $originalName,
                'bolsa' => $dto->bolsa,
                'tipo_titulo' => $dto->tipoTitulo,
                'liquidacion' => $dto->liquidacion,
                'fecha_compra' => $dto->fechaNegociacion,
                'comitente_nombre' => $dto->comitenteNombre,
                'comitente_identificacion' => $dto->comitenteIdentificacion,
                'id_propietario' => $idPropietario,
                'propietario_detectado' => $nombrePropietario,
                'id_grupo_familiar' => $idGrupoFamiliar,
                'id_instrumento' => 222, // SRI 2034-12-31 (Notas de Crédito)
                'valor_nominal' => $dto->valorNominal,
                'precio_compra' => $dto->precioCompra,
                'valor_efectivo' => $dto->valorEfectivo,
                'comision_bolsa' => $dto->comisionBolsa,
                'comision_casa_valores' => $dto->comisionCasaValores,
                'capital_invertido' => $dto->totalInvertido,
                'precio_neto_compra' => $dto->precioNetoCompra,
                'factura_bolsa' => $dto->facturaBolsa,
                'operador_valores' => $dto->operadorValores,
                'estado' => $estado,
                'inversion_existente_id' => $existente ? $existente->id_inversion : null,
                'mensaje_estado' => $mensaje,
                'seleccionado' => $seleccionado,
            ];
        }

        return [
            'resumen' => $resumen,
            'items' => $previewItems,
            'personas_disponibles' => $personas,
        ];
    }

    /**
     * Guarda en base de datos las inversiones confirmadas por el usuario
     *
     * @param array $inversionesData
     * @return array
     */
    public function confirm(array $inversionesData): array
    {
        $guardados = [];
        $errores = [];

        DB::beginTransaction();
        try {
            foreach ($inversionesData as $item) {
                $liquidacion = trim($item['liquidacion'] ?? '');

                if (empty($liquidacion)) {
                    $errores[] = ['item' => $item, 'error' => 'Número de liquidación no proporcionado.'];
                    continue;
                }

                // Evitar duplicación concurrente
                $baseLiq = trim(explode('-', $liquidacion)[0]);
                $yaExiste = Inversion::where(function ($q) use ($liquidacion, $baseLiq) {
                    $q->where('liquidacion', $liquidacion)
                      ->orWhere('liquidacion', $baseLiq);
                })->where('eliminado', 0)->exists();

                if ($yaExiste) {
                    $errores[] = ['liquidacion' => $liquidacion, 'error' => 'La liquidación ya existe en la base de datos.'];
                    continue;
                }

                $idPropietario = $item['id_propietario'] ?? null;
                if (!$idPropietario) {
                    $errores[] = ['liquidacion' => $liquidacion, 'error' => 'Debe asignarse un propietario.'];
                    continue;
                }

                $idGrupoFamiliar = $item['id_grupo_familiar'] ?? 1;
                $valorNominal = (float) ($item['valor_nominal'] ?? 0);
                $capitalInvertido = (float) ($item['capital_invertido'] ?? 0);
                $precioCompra = (float) ($item['precio_compra'] ?? 0);
                $precioNetoCompra = (float) ($item['precio_neto_compra'] ?? 0);
                $comisionBolsa = (float) ($item['comision_bolsa'] ?? 0);
                $comisionOperador = (float) ($item['comision_casa_valores'] ?? 0);
                $totalComisiones = round($comisionBolsa + $comisionOperador, 2);
                $fechaCompra = $item['fecha_compra'] ?? date('Y-m-d');
                $filename = $item['filename'] ?? 'documento.pdf';

                $inversion = new Inversion();
                $inversion->id_grupo_familiar = $idGrupoFamiliar;
                $inversion->id_instrumento = 222; // SRI 2034-12-31
                $inversion->id_propietario = $idPropietario;
                $inversion->id_aportante = $idPropietario;
                $inversion->liquidacion = $liquidacion;
                $inversion->id_estado_inversion = 128; // Vigente
                $inversion->fecha_compra = $fechaCompra;
                $inversion->fecha_venta = null;
                $inversion->valor_nominal = $valorNominal;
                $inversion->monto_a_negociar = $valorNominal;
                $inversion->capital_invertido = $capitalInvertido;
                $inversion->saldo_capital_actual = $capitalInvertido;
                $inversion->tasa_interes = 1.0;
                $inversion->rendimiento_nominal = 1.0;
                $inversion->rendimiento_efectivo = null;
                $inversion->valor_efectivo = $capitalInvertido;
                $inversion->valor_sin_comision = $capitalInvertido;
                $inversion->valor_con_interes = $capitalInvertido;
                $inversion->interes_acumulado_previo = 0.00;
                $inversion->interes_mensual = 0.00;
                $inversion->interes_primer_mes = 0.00;
                $inversion->total_comisiones = $totalComisiones;
                $inversion->tasa_mensual_real = 0.00;
                $inversion->fecha_primer_pago = null;
                $inversion->precio_compra = $precioCompra;
                $inversion->precio_neto_compra = $precioNetoCompra;
                $inversion->comision_bolsa = $comisionBolsa;
                $inversion->comision_casa_valores = $comisionOperador;
                $inversion->retencion_fuente = 0.00;
                $inversion->observacion = "Importado automáticamente desde PDF: {$filename}";
                $inversion->expirado_old = 0;
                $inversion->activo_old = 1;
                $inversion->eliminado = 0;

                $inversion->save();

                $guardados[] = [
                    'id_inversion' => $inversion->id_inversion,
                    'liquidacion' => $inversion->liquidacion,
                    'valor_nominal' => $inversion->valor_nominal,
                    'capital_invertido' => $inversion->capital_invertido,
                ];
            }

            DB::commit();

            return [
                'success' => true,
                'total_guardados' => count($guardados),
                'total_errores' => count($errores),
                'guardados' => $guardados,
                'errores' => $errores,
            ];
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Error al confirmar importación de liquidaciones PDF: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Resuelve el registro de persona a partir de la cédula o el nombre
     */
    protected function resolverPersona(?string $identificacion, ?string $nombre, $personas): ?object
    {
        if ($identificacion) {
            foreach ($personas as $p) {
                if (!empty($p->identificacion) && trim($p->identificacion) === trim($identificacion)) {
                    return $p;
                }
            }
        }

        if ($nombre) {
            $nombreUpper = mb_strtoupper($nombre);
            foreach ($personas as $p) {
                $nombreP = mb_strtoupper(trim($p->nombres . ' ' . $p->apellidos));
                $primerNombre = mb_strtoupper(trim($p->nombres));
                if (!empty($primerNombre) && str_contains($nombreUpper, $primerNombre)) {
                    return $p;
                }
            }
        }

        return null;
    }
}
