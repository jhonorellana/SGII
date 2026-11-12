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
            'bonos' => 0,
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
                    'instrumento_match_metodo' => null,
                    'codigo_vector' => $dto->codigoVector,
                    'codigo_seb' => $dto->codigoSeb,
                    'fecha_emision' => $dto->fechaEmision,
                    'fecha_vencimiento' => $dto->fechaVencimiento,
                    'fecha_primer_pago' => $dto->fechaPrimerPago,
                    'tasa_interes' => $dto->tasaInteres,
                    'rendimiento_nominal' => $dto->rendimientoNominal,
                    'rendimiento_efectivo' => $dto->rendimientoEfectivo,
                    'plazo_dias' => $dto->plazoDias,
                    'valor_nominal' => $dto->valorNominal,
                    'precio_compra' => $dto->precioCompra,
                    'valor_efectivo' => $dto->valorEfectivo,
                    'interes_devengado' => $dto->interesDevengado ?? 0.0,
                    'comision_bolsa' => $dto->comisionBolsa,
                    'comision_casa_valores' => $dto->comisionCasaValores,
                    'capital_invertido' => $dto->totalInvertido,
                    'valor_con_interes' => $dto->valorConInteres ?? $dto->totalInvertido,
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
            $instrumentoMatchMetodo = null;
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
                        $instrumentoMatchMetodo = 'EXISTENTE';
                    } else {
                        $nombreInstrumento = ($dto->fechaEmision ? $dto->fechaEmision . ' ' : '') . ($nombreEmisor ?? 'EMPAGRAN') . ' ' . $dto->fechaVencimiento;
                        $instrumentoMatchMetodo = 'NUEVO';
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
            } elseif ($dto->tipoTitulo === 'BONO') {
                $resumen['bonos']++;
                $generaAmortizacion = false; // Explícitamente excluida la tabla de amortización para Bonos por ahora
                $idEmisor = 45; // MINISTERIO DE ECONOMIA Y FINANZAS
                $nombreEmisor = 'MINISTERIO DE ECONOMIA Y FINANZAS';

                [$instBono, $metodoMatch] = $this->buscarInstrumentoBono(
                    $dto->codigoVector,
                    $dto->fechaEmision,
                    $dto->fechaVencimiento,
                    $dto->tasaInteres
                );

                if ($instBono) {
                    $idInstrumento = $instBono->id_instrumento;
                    $nombreInstrumento = $instBono->nombre;
                    $instrumentoMatchMetodo = $metodoMatch; // 'VECTOR' o 'FECHAS_TASA'
                } else {
                    $nombreInstrumento = ($dto->fechaEmision ? $dto->fechaEmision . ' ' : '') . 'BONOS DEL ESTADO ' . ($dto->fechaVencimiento ?? '');
                    $instrumentoMatchMetodo = 'NUEVO';
                }
            } else {
                // NOTA DE CRÉDITO
                $resumen['notas_credito']++;
                $idEmisor = 153; // SRI
                $nombreEmisor = 'SERVICIO DE RENTAS INTERNAS (SRI)';
                $idInstrumento = 222; // SRI 2034-12-31
                $nombreInstrumento = 'SRI 2034-12-31';
                $instrumentoMatchMetodo = 'EXISTENTE';
                $generaAmortizacion = false;
            }

            // Verificar duplicados en DB (soporta liquidación exacta, con espacios o sin sufijo de bolsa ej. 28911-VRF32 vs 28911 - VRF32 vs 28911)
            $baseLiq = trim(explode('-', $dto->liquidacion)[0]);
            $spacedLiq = preg_replace('/\s*-\s*/', ' - ', $dto->liquidacion);
            $compactLiq = preg_replace('/\s+/', '', $dto->liquidacion);
            $existente = Inversion::where(function ($q) use ($dto, $baseLiq, $spacedLiq, $compactLiq) {
                $q->whereIn('liquidacion', array_unique([$dto->liquidacion, $baseLiq, $spacedLiq, $compactLiq]));
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
                'instrumento_match_metodo' => $instrumentoMatchMetodo,
                'codigo_vector' => $dto->codigoVector,
                'codigo_seb' => $dto->codigoSeb,
                'fecha_emision' => $dto->fechaEmision,
                'fecha_vencimiento' => $dto->fechaVencimiento,
                'fecha_primer_pago' => $dto->fechaPrimerPago,
                'tasa_interes' => $dto->tasaInteres,
                'rendimiento_nominal' => $dto->rendimientoNominal,
                'rendimiento_efectivo' => $dto->rendimientoEfectivo,
                'plazo_dias' => $dto->plazoDias,
                'valor_nominal' => $dto->valorNominal,
                'precio_compra' => $dto->precioCompra,
                'valor_efectivo' => $dto->valorEfectivo,
                'interes_devengado' => $dto->interesDevengado ?? 0.0,
                'comision_bolsa' => $dto->comisionBolsa,
                'comision_casa_valores' => $dto->comisionCasaValores,
                'capital_invertido' => $dto->totalInvertido,
                'valor_con_interes' => $dto->valorConInteres ?? $dto->totalInvertido,
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
                $spacedLiq = preg_replace('/\s*-\s*/', ' - ', $liquidacion);
                $compactLiq = preg_replace('/\s+/', '', $liquidacion);
                $yaExiste = Inversion::where(function ($q) use ($liquidacion, $baseLiq, $spacedLiq, $compactLiq) {
                    $q->whereIn('liquidacion', array_unique([$liquidacion, $baseLiq, $spacedLiq, $compactLiq]));
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
                if ($tipoTitulo === 'PAPEL_COMERCIAL') {
                    $idTipoInversion = 3;
                } elseif ($tipoTitulo === 'BONO') {
                    $idTipoInversion = 4;
                } else {
                    $idTipoInversion = 91;
                }

                $idGrupoFamiliar = $item['id_grupo_familiar'] ?? 1;
                $valorNominal = (float) ($item['valor_nominal'] ?? 0);
                $valorEfectivo = (float) ($item['valor_efectivo'] ?? $item['capital_invertido'] ?? 0);
                $capitalInvertido = (float) ($item['capital_invertido'] ?? 0);
                $interesDevengado = (float) ($item['interes_devengado'] ?? 0);
                $valorConInteres = (float) ($item['valor_con_interes'] ?? round($capitalInvertido + $interesDevengado, 2));
                $precioCompra = (float) ($item['precio_compra'] ?? 0);
                $precioNetoCompra = (float) ($item['precio_neto_compra'] ?? 0);
                $comisionBolsa = (float) ($item['comision_bolsa'] ?? 0);
                $comisionOperador = (float) ($item['comision_casa_valores'] ?? 0);
                $totalComisiones = round($comisionBolsa + $comisionOperador, 2);
                $fechaCompra = $item['fecha_compra'] ?? date('Y-m-d');
                $tasaInteres = (float) ($item['tasa_interes'] ?? 1.0);
                $rendimientoNominal = isset($item['rendimiento_nominal']) ? (float) $item['rendimiento_nominal'] : $tasaInteres;
                $rendimientoEfectivo = isset($item['rendimiento_efectivo']) ? (float) $item['rendimiento_efectivo'] : null;
                $fechaVcto = $item['fecha_vencimiento'] ?? null;
                $fechaEmi = $item['fecha_emision'] ?? $fechaCompra;
                $fechaPrimerPago = $item['fecha_primer_pago'] ?? $fechaVcto;
                $codigoVector = !empty($item['codigo_vector']) ? ltrim(trim($item['codigo_vector']), 'aA') : null;
                $codigoSeb = !empty($item['codigo_seb']) ? trim($item['codigo_seb']) : null;
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
                } elseif ($idTipoInversion === 4) {
                    // BONOS DEL ESTADO: Validar en 2 niveles (Vector de Precios -> Fechas + Tasa) o crear
                    [$instBono, $metodoMatch] = $this->buscarInstrumentoBono($codigoVector, $fechaEmi, $fechaVcto, $tasaInteres);
                    if ($instBono) {
                        $idInstrumento = $instBono->id_instrumento;

                        // Si se encontró por Fechas+Tasa y su código vector estaba 'PorActualizar', actualizarlo con el vector del PDF
                        $updatesInst = [];
                        if ($codigoVector && (empty($instBono->codigo_titulo_vector) || $instBono->codigo_titulo_vector === 'PorActualizar')) {
                            $updatesInst['codigo_titulo_vector'] = 'a' . $codigoVector;
                        }
                        if ($codigoSeb && (empty($instBono->codigo_seb) || $instBono->codigo_seb === 'PorActualizar')) {
                            $updatesInst['codigo_seb'] = $codigoSeb;
                        }
                        if (!empty($updatesInst)) {
                            $updatesInst['fecha_actualizacion'] = now();
                            DB::table('instrumento')->where('id_instrumento', $idInstrumento)->update($updatesInst);
                        }
                    } elseif (!$idInstrumento) {
                        $codTitulo = 'INV_4_' . str_replace('-', '', $fechaVcto ?? date('Ymd'));
                        $nombreInst = "{$fechaEmi} BONOS DEL ESTADO {$fechaVcto}";
                        $idInstrumento = DB::table('instrumento')->insertGetId([
                            'id_emisor' => 45, // MINISTERIO DE ECONOMIA Y FINANZAS
                            'id_tipo_inversion' => 4,
                            'codigo_titulo' => $codTitulo,
                            'nombre' => $nombreInst,
                            'fecha_emision' => $fechaEmi,
                            'fecha_vencimiento' => $fechaVcto,
                            'tasa_referencial' => $tasaInteres,
                            'fechas_recuperacion' => $fechaVcto,
                            'codigo_titulo_vector' => $codigoVector ? ('a' . $codigoVector) : 'PorActualizar',
                            'codigo_seb' => $codigoSeb ?: 'PorActualizar',
                            'activo' => 1,
                            'fecha_creacion' => now(),
                            'fecha_actualizacion' => now(),
                        ]);
                    }
                }

                // Cálculos de interés mensual y primer mes para Bonos vs. Cero Cupón / Notas de Crédito
                $interesMensual = 0.00;
                $interesPrimerMes = 0.00;
                if ($idTipoInversion === 4) {
                    $interesMensual = round(($valorNominal * ($tasaInteres / 100)) / 12, 2);
                    $interesPrimerMes = round($interesMensual - $interesDevengado, 2);
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
                $inversion->rendimiento_nominal = $rendimientoNominal;
                $inversion->rendimiento_efectivo = $rendimientoEfectivo;
                $inversion->valor_efectivo = ($idTipoInversion === 4) ? $valorEfectivo : $capitalInvertido;
                $inversion->valor_sin_comision = ($idTipoInversion === 4) ? $valorEfectivo : $capitalInvertido;
                $inversion->valor_con_interes = ($idTipoInversion === 4) ? $valorConInteres : $capitalInvertido;
                $inversion->interes_acumulado_previo = ($idTipoInversion === 4) ? $interesDevengado : 0.00;
                $inversion->interes_mensual = $interesMensual;
                $inversion->interes_primer_mes = $interesPrimerMes;
                $inversion->total_comisiones = $totalComisiones;
                $inversion->tasa_mensual_real = 0.00;
                $inversion->fecha_primer_pago = $fechaPrimerPago;
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

    /**
     * Busca un instrumento de tipo Bono (id_tipo_inversion = 4) en dos niveles:
     * Nivel 1: Por Código de Vector de Precios (codigo_titulo_vector)
     * Nivel 2: Por combinación de Fecha de Emisión + Fecha de Vencimiento + Tasa Referencial
     *
     * @return array{0: ?object, 1: ?string} [Instrumento encontrado o null, Método de coincidencia ('VECTOR' | 'FECHAS_TASA' | null)]
     */
    protected function buscarInstrumentoBono(
        ?string $codigoVector,
        ?string $fechaEmision,
        ?string $fechaVencimiento,
        ?float $tasaReferencial
    ): array {
        // Nivel 1: Búsqueda por Código de Vector de Precios
        if (!empty($codigoVector)) {
            $rawVector = ltrim(trim($codigoVector), 'aA');
            if (!empty($rawVector) && $rawVector !== 'PorActualizar') {
                $instPorVector = DB::table('instrumento')
                    ->where('id_tipo_inversion', 4)
                    ->where('activo', 1)
                    ->whereIn('codigo_titulo_vector', [$rawVector, 'a' . $rawVector, 'A' . $rawVector])
                    ->first();

                if ($instPorVector) {
                    return [$instPorVector, 'VECTOR'];
                }
            }
        }

        // Nivel 2: Búsqueda por Fecha de Emisión + Fecha de Vencimiento + Tasa Referencial
        if (!empty($fechaEmision) && !empty($fechaVencimiento) && $tasaReferencial !== null) {
            $instPorFechasTasa = DB::table('instrumento')
                ->where('id_tipo_inversion', 4)
                ->where('activo', 1)
                ->whereDate('fecha_emision', $fechaEmision)
                ->whereDate('fecha_vencimiento', $fechaVencimiento)
                ->whereRaw('ABS(tasa_referencial - ?) < 0.001', [$tasaReferencial])
                ->first();

            if ($instPorFechasTasa) {
                return [$instPorFechasTasa, 'FECHAS_TASA'];
            }
        }

        return [null, null];
    }
}
