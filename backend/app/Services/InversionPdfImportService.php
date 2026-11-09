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

        $emisores = DB::table('emisor')
            ->where('activo', 1)
            ->select('id_emisor', 'nombre', 'sigla')
            ->orderBy('nombre')
            ->get();

        $previewItems = [];
        $resumen = [
            'total_archivos' => count($files),
            'validos' => 0,
            'duplicados' => 0,
            'con_error' => 0,
            'total_nominal' => 0.0,
            'total_invertido' => 0.0,
            'notas_credito' => 0,
            'papeles_comerciales' => 0,
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
                    'id_emisor' => null,
                    'emisor_detectado' => null,
                    'id_instrumento' => null,
                    'instrumento_detectado' => null,
                    'fecha_emision' => $dto->fechaEmision,
                    'fecha_vencimiento' => $dto->fechaVencimiento,
                    'tasa_interes' => $dto->tasaInteres,
                    'plazo_dias' => $dto->plazoDias,
                    'valor_nominal' => $dto->valorNominal,
                    'precio_compra' => $dto->precioCompra,
                    'valor_efectivo' => $dto->valorEfectivo,
                    'comision_bolsa' => $dto->comisionBolsa,
                    'comision_casa_valores' => $dto->comisionCasaValores,
                    'capital_invertido' => $dto->totalInvertido,
                    'precio_neto_compra' => $dto->precioNetoCompra,
                    'factura_bolsa' => $dto->facturaBolsa,
                    'operador_valores' => $dto->operadorValores,
                    'genera_amortizacion' => false,
                    'cuota_amortizacion_estimada' => null,
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

            // Resolver Emisor e Instrumento según Tipo de Título
            $idEmisor = null;
            $nombreEmisor = null;
            $idInstrumento = null;
            $nombreInstrumento = null;
            $generaAmortizacion = false;
            $cuotaEstimada = null;

            if ($dto->tipoTitulo === 'PAPEL_COMERCIAL') {
                $resumen['papeles_comerciales']++;
                $generaAmortizacion = true;

                // Resolver Emisor
                $emisorMatched = $this->resolverEmisor($dto->emisorNombre, $emisores);
                $idEmisor = $emisorMatched ? $emisorMatched->id_emisor : null;
                $nombreEmisor = $emisorMatched ? $emisorMatched->nombre : $dto->emisorNombre;

                // Resolver Instrumento
                if ($idEmisor && $dto->fechaVencimiento) {
                    $inst = DB::table('instrumento')
                        ->where('id_tipo_inversion', 3) // Papel Comercial
                        ->where('id_emisor', $idEmisor)
                        ->where('fecha_vencimiento', $dto->fechaVencimiento)
                        ->where('activo', 1)
                        ->first();
                    if ($inst) {
                        $idInstrumento = $inst->id_instrumento;
                        $nombreInstrumento = $inst->nombre;
                    } else {
                        $nombreInstrumento = ($dto->fechaEmision ? $dto->fechaEmision . ' ' : '') . ($nombreEmisor ?? 'EMPAGRAN') . ' ' . $dto->fechaVencimiento;
                    }
                }

                // Cálculo de amortización estimada al vencimiento
                $interesDescuento = round($dto->valorNominal - $dto->totalInvertido, 2);
                $cuotaEstimada = [
                    'numero_cuota' => 1,
                    'fecha_pago' => $dto->fechaVencimiento,
                    'capital' => $dto->totalInvertido,
                    'interes' => $interesDescuento,
                    'total' => $dto->valorNominal,
                ];
            } else {
                // NOTA DE CRÉDITO
                $resumen['notas_credito']++;
                $idEmisor = 153; // SRI
                $nombreEmisor = 'SERVICIO DE RENTAS INTERNAS (SRI)';
                $idInstrumento = 222; // SRI 2034-12-31
                $nombreInstrumento = 'SRI 2034-12-31';
                $generaAmortizacion = false;
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
                'id_emisor' => $idEmisor,
                'emisor_detectado' => $nombreEmisor,
                'id_instrumento' => $idInstrumento,
                'instrumento_detectado' => $nombreInstrumento,
                'fecha_emision' => $dto->fechaEmision,
                'fecha_vencimiento' => $dto->fechaVencimiento,
                'tasa_interes' => $dto->tasaInteres,
                'plazo_dias' => $dto->plazoDias,
                'valor_nominal' => $dto->valorNominal,
                'precio_compra' => $dto->precioCompra,
                'valor_efectivo' => $dto->valorEfectivo,
                'comision_bolsa' => $dto->comisionBolsa,
                'comision_casa_valores' => $dto->comisionCasaValores,
                'capital_invertido' => $dto->totalInvertido,
                'precio_neto_compra' => $dto->precioNetoCompra,
                'factura_bolsa' => $dto->facturaBolsa,
                'operador_valores' => $dto->operadorValores,
                'genera_amortizacion' => $generaAmortizacion,
                'cuota_amortizacion_estimada' => $cuotaEstimada,
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
            'emisores_disponibles' => $emisores,
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

                $tipoTitulo = $item['tipo_titulo'] ?? 'NOTA_CREDITO';
                $idTipoInversion = ($tipoTitulo === 'PAPEL_COMERCIAL') ? 3 : 91;

                $idGrupoFamiliar = $item['id_grupo_familiar'] ?? 1;
                $valorNominal = (float) ($item['valor_nominal'] ?? 0);
                $capitalInvertido = (float) ($item['capital_invertido'] ?? 0);
                $precioCompra = (float) ($item['precio_compra'] ?? 0);
                $precioNetoCompra = (float) ($item['precio_neto_compra'] ?? 0);
                $comisionBolsa = (float) ($item['comision_bolsa'] ?? 0);
                $comisionOperador = (float) ($item['comision_casa_valores'] ?? 0);
                $totalComisiones = round($comisionBolsa + $comisionOperador, 2);
                $fechaCompra = $item['fecha_compra'] ?? date('Y-m-d');
                $tasaInteres = (float) ($item['tasa_interes'] ?? 1.0);
                $fechaVcto = $item['fecha_vencimiento'] ?? null;
                $fechaEmi = $item['fecha_emision'] ?? $fechaCompra;
                $filename = $item['filename'] ?? 'documento.pdf';

                // Resolver o registrar Instrumento
                $idInstrumento = $item['id_instrumento'] ?? null;
                if ($idTipoInversion === 91) {
                    $idInstrumento = 222; // SRI 2034-12-31
                } elseif ($idTipoInversion === 3) {
                    if (!$idInstrumento) {
                        $idEmisor = $item['id_emisor'] ?? 146; // EMPAGRAN por defecto si no viene
                        $instExistente = DB::table('instrumento')
                            ->where('id_tipo_inversion', 3)
                            ->where('id_emisor', $idEmisor)
                            ->where('fecha_vencimiento', $fechaVcto)
                            ->first();

                        if ($instExistente) {
                            $idInstrumento = $instExistente->id_instrumento;
                        } else {
                            $nomEmisor = DB::table('emisor')->where('id_emisor', $idEmisor)->value('nombre') ?? 'EMPAGRAN';
                            $codTitulo = 'INV_03_' . str_replace('-', '', $fechaVcto ?? date('Ymd'));
                            $nombreInst = "{$fechaEmi} {$nomEmisor} {$fechaVcto}";
                            $idInstrumento = DB::table('instrumento')->insertGetId([
                                'id_emisor' => $idEmisor,
                                'id_tipo_inversion' => 3,
                                'codigo_titulo' => $codTitulo,
                                'nombre' => $nombreInst,
                                'fecha_emision' => $fechaEmi,
                                'fecha_vencimiento' => $fechaVcto,
                                'tasa_referencial' => $tasaInteres,
                                'fechas_recuperacion' => $fechaVcto,
                                'codigo_titulo_vector' => 'PAPEL COMERCIAL',
                                'activo' => 1,
                                'fecha_creacion' => now(),
                                'fecha_actualizacion' => now(),
                            ]);
                        }
                    }
                }

                $inversion = new Inversion();
                $inversion->id_grupo_familiar = $idGrupoFamiliar;
                $inversion->id_instrumento = $idInstrumento;
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
                $inversion->tasa_interes = $tasaInteres;
                $inversion->rendimiento_nominal = $tasaInteres;
                $inversion->rendimiento_efectivo = null;
                $inversion->valor_efectivo = $capitalInvertido;
                $inversion->valor_sin_comision = $capitalInvertido;
                $inversion->valor_con_interes = $capitalInvertido;
                $inversion->interes_acumulado_previo = 0.00;
                $inversion->interes_mensual = 0.00;
                $inversion->interes_primer_mes = 0.00;
                $inversion->total_comisiones = $totalComisiones;
                $inversion->tasa_mensual_real = 0.00;
                $inversion->fecha_primer_pago = $fechaVcto;
                $inversion->precio_compra = $precioCompra;
                $inversion->precio_neto_compra = $precioNetoCompra;
                $inversion->comision_bolsa = $comisionBolsa;
                $inversion->comision_casa_valores = $comisionOperador;
                $inversion->retencion_fuente = 0.00;
                $inversion->observacion = "Importado automáticamente desde PDF ({$tipoTitulo}): {$filename}";
                $inversion->expirado_old = 0;
                $inversion->activo_old = 1;
                $inversion->eliminado = 0;

                $inversion->save();

                // Disparar evento para crear movimiento de capital (egreso COM_INV) y actualizar saldo en Santa Fe (otro_valor)
                event(new \App\Events\InversionCreada($inversion));

                $movimientoCreado = \App\Models\MovimientoCapital::where('id_inversion', $inversion->id_inversion)
                    ->where('id_tipo_movimiento', 181)
                    ->where('eliminado', false)
                    ->first();

                // Si es Papel Comercial (cero cupón), generar la cuota única de amortización al vencimiento
                if ($idTipoInversion === 3 && !empty($fechaVcto)) {
                    $interesDescuento = round($valorNominal - $capitalInvertido, 2);
                    DB::table('amortizacion')->insert([
                        'id_inversion' => $inversion->id_inversion,
                        'numero_cuota' => 1,
                        'fecha_pago' => $fechaVcto,
                        'capital' => $capitalInvertido,
                        'interes' => $interesDescuento,
                        'descuento' => 0.00,
                        'total' => $valorNominal,
                        'int_parcial' => $interesDescuento,
                        'retencion' => 0.00,
                        'id_estado_amortizacion' => 134, // Pendiente
                        'pagada_old' => 0,
                        'activo_old' => 1,
                        'eliminado' => 0,
                        'fecha_creacion' => now(),
                        'fecha_actualizacion' => now(),
                    ]);
                }

                $guardados[] = [
                    'id_inversion' => $inversion->id_inversion,
                    'id_movimiento_capital' => $movimientoCreado?->id_movimiento_capital,
                    'tipo_titulo' => $tipoTitulo,
                    'liquidacion' => $inversion->liquidacion,
                    'valor_nominal' => $inversion->valor_nominal,
                    'capital_invertido' => $inversion->capital_invertido,
                    'amortizacion_creada' => ($idTipoInversion === 3),
                ];
            }

            DB::commit();

            // Invalidar caché de reportes para reflejar las nuevas compras y saldos de inmediato
            \Illuminate\Support\Facades\Cache::flush();

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
                $primerNombre = mb_strtoupper(trim($p->nombres));
                if (!empty($primerNombre) && str_contains($nombreUpper, $primerNombre)) {
                    return $p;
                }
            }
        }

        return null;
    }

    /**
     * Resuelve el emisor a partir del nombre o texto extraído
     */
    protected function resolverEmisor(?string $nombreEmisor, $emisores): ?object
    {
        if (empty($nombreEmisor)) {
            return null;
        }

        $upper = mb_strtoupper($nombreEmisor);

        foreach ($emisores as $e) {
            $eNombre = mb_strtoupper(trim($e->nombre));
            $eSigla = !empty($e->sigla) ? mb_strtoupper(trim($e->sigla)) : null;

            if (str_contains($upper, $eNombre) || ($eSigla && str_contains($upper, $eSigla))) {
                return $e;
            }
        }

        return null;
    }
}
