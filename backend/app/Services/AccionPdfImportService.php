<?php

namespace App\Services;

use App\Models\AccionOperacion;
use App\Models\Instrumento;
use App\Services\PdfParsers\AccionPdfParserService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class AccionPdfImportService
{
    public function __construct(
        protected AccionPdfParserService $parser
    ) {}

    /**
     * Procesa los archivos PDF de Acciones (Renta Variable) y genera la previsualización
     *
     * @param array<UploadedFile|string> $files
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

        $instrumentos = DB::table('instrumento as i')
            ->leftJoin('emisor as e', 'e.id_emisor', '=', 'i.id_emisor')
            ->where('i.activo', 1)
            ->whereIn('i.id_tipo_inversion', [203, 73])
            ->select(
                'i.id_instrumento',
                'i.id_emisor',
                'i.id_tipo_inversion',
                'i.codigo_titulo',
                'i.nombre',
                'i.codigo_titulo_vector',
                'e.nombre as emisor_nombre'
            )
            ->orderBy('i.nombre')
            ->get();

        $previewItems = [];
        $resumen = [
            'total_archivos' => count($files),
            'validos' => 0,
            'duplicados' => 0,
            'con_error' => 0,
            'total_acciones' => 0.0,
            'total_bruto' => 0.0,
            'total_comisiones' => 0.0,
            'total_neto' => 0.0,
            'compras' => 0,
            'ventas' => 0,
        ];

        foreach ($files as $file) {
            if ($file instanceof UploadedFile) {
                $originalName = $file->getClientOriginalName();
                $tempPath = $file->getRealPath();
            } else {
                $tempPath = (string) $file;
                $originalName = basename($tempPath);
            }

            $parsed = $this->parser->parseFile($tempPath, $originalName);

            if (empty($parsed['success']) || empty($parsed['liquidacion'])) {
                $resumen['con_error']++;
                $previewItems[] = [
                    'id_temporal' => uniqid('acc_pdf_'),
                    'filename' => $originalName,
                    'bolsa' => $parsed['bolsa'] ?? 'DESCONOCIDA',
                    'tipo_titulo' => $parsed['tipo_titulo'] ?? 'ACCION',
                    'id_tipo_operacion' => $parsed['id_tipo_operacion'] ?? 204,
                    'tipo_operacion_codigo' => $parsed['tipo_operacion_codigo'] ?? 'COMPRA_ACCION',
                    'tipo_operacion_nombre' => $parsed['tipo_operacion_nombre'] ?? 'Compra de Acciones',
                    'liquidacion' => $parsed['liquidacion'] ?? null,
                    'fecha_operacion' => $parsed['fecha_operacion'] ?? null,
                    'fecha_valor' => $parsed['fecha_valor'] ?? null,
                    'comitente_nombre' => $parsed['comitente_nombre'] ?? null,
                    'comitente_identificacion' => $parsed['comitente_identificacion'] ?? null,
                    'id_persona' => null,
                    'persona_detectada' => null,
                    'emisor_nombre' => $parsed['emisor_nombre'] ?? null,
                    'codigo_vector' => $parsed['codigo_vector'] ?? null,
                    'codigo_seb' => $parsed['codigo_seb'] ?? 'ACC',
                    'id_emisor' => null,
                    'emisor_detectado' => null,
                    'id_instrumento' => null,
                    'instrumento_detectado' => null,
                    'instrumento_match_metodo' => null,
                    'cantidad' => $parsed['cantidad'] ?? 0.0,
                    'valor_nominal_unitario' => $parsed['valor_nominal_unitario'] ?? 1.0,
                    'valor_nominal_total' => $parsed['valor_nominal_total'] ?? 0.0,
                    'precio_unitario' => $parsed['precio_unitario'] ?? 0.0,
                    'valor_bruto' => $parsed['valor_bruto'] ?? 0.0,
                    'comision_bolsa' => $parsed['comision_bolsa'] ?? 0.0,
                    'comision_operador' => $parsed['comision_operador'] ?? 0.0,
                    'total_comisiones' => $parsed['total_comisiones'] ?? 0.0,
                    'valor_neto' => $parsed['valor_neto'] ?? 0.0,
                    'factura_bolsa' => $parsed['factura_bolsa'] ?? null,
                    'factura_casa_valores' => $parsed['factura_casa_valores'] ?? null,
                    'operador_valores' => $parsed['operador_valores'] ?? null,
                    'estado' => 'ERROR',
                    'duplicado_bd' => false,
                    'id_operacion_existente' => null,
                    'stock_disponible' => null,
                    'observacion_sistema' => $parsed['error_message'] ?? 'No se pudo extraer el número de liquidación del archivo PDF.',
                    'seleccionado' => false,
                ];
                continue;
            }

            // 1. Resolver Persona (Socio)
            [$idPersona, $nombrePersona] = $this->resolverPersona(
                $parsed['comitente_identificacion'] ?? null,
                $parsed['comitente_nombre'] ?? null,
                $personas
            );

            // 2. Resolver Emisor e Instrumento (id_tipo_inversion = 203 ACNPI)
            [$idEmisor, $nombreEmisor, $idInstrumento, $nombreInstrumento, $matchMetodo] = $this->resolverEmisorEInstrumento(
                $parsed['emisor_nombre'] ?? null,
                $parsed['codigo_vector'] ?? null,
                $emisores,
                $instrumentos
            );

            // 3. Verificar duplicado en accion_operacion (comparando sin espacios alrededor del guion)
            $liqClean = preg_replace('/\s+/', '', trim($parsed['liquidacion']));
            $existente = DB::table('accion_operacion')
                ->where('eliminado', 0)
                ->where('activo', 1)
                ->whereRaw("REPLACE(liquidacion, ' ', '') = ?", [$liqClean])
                ->first();

            $esDuplicado = $existente !== null;

            // 4. Si es Venta (205), verificar stock disponible del socio
            $stockDisponible = null;
            $errorStock = null;
            if ((int) $parsed['id_tipo_operacion'] === 205 && $idPersona && $idInstrumento) {
                $posicion = DB::table('vw_accion_posicion')
                    ->where('id_persona', $idPersona)
                    ->where('id_instrumento', $idInstrumento)
                    ->first();
                $stockDisponible = $posicion ? (float) $posicion->cantidad_actual : 0.0;
                if ($stockDisponible < (float) $parsed['cantidad']) {
                    $errorStock = "Stock insuficiente ({$stockDisponible} disp. vs {$parsed['cantidad']} a vender)";
                }
            }

            // 5. Determinar estado y observaciones
            $avisos = [];
            if ($esDuplicado) {
                $estado = 'DUPLICADO';
                $resumen['duplicados']++;
                $avisos[] = "La liquidación {$parsed['liquidacion']} ya existe en Renta Variable (ID #{$existente->id_accion_operacion}).";
            } elseif ($errorStock) {
                $estado = 'ERROR';
                $resumen['con_error']++;
                $avisos[] = $errorStock;
            } else {
                $estado = 'LISTO';
                $resumen['validos']++;
                $resumen['total_acciones'] = round($resumen['total_acciones'] + (float) $parsed['cantidad'], 6);
                $resumen['total_bruto'] = round($resumen['total_bruto'] + (float) $parsed['valor_bruto'], 2);
                $resumen['total_comisiones'] = round($resumen['total_comisiones'] + (float) $parsed['total_comisiones'], 2);
                $resumen['total_neto'] = round($resumen['total_neto'] + (float) $parsed['valor_neto'], 2);

                if ((int) $parsed['id_tipo_operacion'] === 205) {
                    $resumen['ventas']++;
                } else {
                    $resumen['compras']++;
                }

                if ($idInstrumento) {
                    $avisos[] = "Instrumento vinculado ({$matchMetodo}): #{$idInstrumento} {$nombreInstrumento}";
                } else {
                    $avisos[] = "Se creará automáticamente el instrumento de acción para: " . ($nombreEmisor ?? $parsed['emisor_nombre']);
                }
            }

            $previewItems[] = [
                'id_temporal' => uniqid('acc_pdf_'),
                'filename' => $originalName,
                'bolsa' => $parsed['bolsa'],
                'tipo_titulo' => 'ACCION',
                'id_tipo_operacion' => (int) $parsed['id_tipo_operacion'],
                'tipo_operacion_codigo' => $parsed['tipo_operacion_codigo'],
                'tipo_operacion_nombre' => $parsed['tipo_operacion_nombre'],
                'liquidacion' => $parsed['liquidacion'],
                'fecha_operacion' => $parsed['fecha_operacion'],
                'fecha_valor' => $parsed['fecha_valor'],
                'comitente_nombre' => $parsed['comitente_nombre'],
                'comitente_identificacion' => $parsed['comitente_identificacion'],
                'id_persona' => $idPersona,
                'persona_detectada' => $nombrePersona,
                'emisor_nombre' => $parsed['emisor_nombre'],
                'codigo_vector' => $parsed['codigo_vector'],
                'codigo_seb' => $parsed['codigo_seb'] ?? 'ACC',
                'id_emisor' => $idEmisor,
                'emisor_detectado' => $nombreEmisor,
                'id_instrumento' => $idInstrumento,
                'instrumento_detectado' => $nombreInstrumento,
                'instrumento_match_metodo' => $matchMetodo,
                'cantidad' => (float) $parsed['cantidad'],
                'valor_nominal_unitario' => (float) $parsed['valor_nominal_unitario'],
                'valor_nominal_total' => (float) $parsed['valor_nominal_total'],
                'precio_unitario' => (float) $parsed['precio_unitario'],
                'valor_bruto' => (float) $parsed['valor_bruto'],
                'comision_bolsa' => (float) $parsed['comision_bolsa'],
                'comision_operador' => (float) $parsed['comision_operador'],
                'total_comisiones' => (float) $parsed['total_comisiones'],
                'valor_neto' => (float) $parsed['valor_neto'],
                'factura_bolsa' => $parsed['factura_bolsa'],
                'factura_casa_valores' => $parsed['factura_casa_valores'],
                'operador_valores' => $parsed['operador_valores'],
                'estado' => $estado,
                'duplicado_bd' => $esDuplicado,
                'id_operacion_existente' => $existente->id_accion_operacion ?? null,
                'stock_disponible' => $stockDisponible,
                'observacion_sistema' => implode(' | ', $avisos),
                'seleccionado' => ($estado === 'LISTO'),
            ];
        }

        return [
            'resumen' => $resumen,
            'items' => $previewItems,
            'catalogos' => [
                'personas' => $personas,
                'emisores' => $emisores,
                'instrumentos' => $instrumentos,
                'tipos_operacion' => [
                    ['id_catalogo_valor' => 204, 'codigo' => 'COMPRA_ACCION', 'nombre' => 'Compra de Acciones'],
                    ['id_catalogo_valor' => 205, 'codigo' => 'VENTA_ACCION', 'nombre' => 'Venta de Acciones'],
                ],
            ],
        ];
    }

    /**
     * Confirma y guarda en base de datos las operaciones de Renta Variable seleccionadas
     */
    public function confirm(array $operacionesInput, bool $registrarMovimientoCapital = true): array
    {
        $guardadas = [];
        $omitidas = [];

        DB::beginTransaction();

        try {
            foreach ($operacionesInput as $item) {
                $liquidacion = trim((string) ($item['liquidacion'] ?? ''));
                if ($liquidacion === '') {
                    continue;
                }

                // Verificar duplicado en accion_operacion
                $liqClean = preg_replace('/\s+/', '', $liquidacion);
                $existe = DB::table('accion_operacion')
                    ->where('eliminado', 0)
                    ->where('activo', 1)
                    ->whereRaw("REPLACE(liquidacion, ' ', '') = ?", [$liqClean])
                    ->first();

                if ($existe) {
                    $omitidas[] = [
                        'liquidacion' => $liquidacion,
                        'motivo' => "Ya existe en Renta Variable con ID #{$existe->id_accion_operacion}",
                    ];
                    continue;
                }

                $idPersona = (int) ($item['id_persona'] ?? 1);
                $idTipoOperacion = (int) ($item['id_tipo_operacion'] ?? 204);
                $fechaOperacion = $item['fecha_operacion'] ?? now()->format('Y-m-d');

                // Resolver o crear Emisor e Instrumento (id_tipo_inversion = 203 ACNPI)
                $idInstrumento = !empty($item['id_instrumento']) ? (int) $item['id_instrumento'] : null;
                if (!$idInstrumento) {
                    $idInstrumento = $this->obtenerOCrearInstrumentoAccion($item, $fechaOperacion);
                }

                $cantidad = round((float) ($item['cantidad'] ?? 0), 6);
                $precioUnitario = round((float) ($item['precio_unitario'] ?? 0), 6);
                $valorBruto = isset($item['valor_bruto']) && (float) $item['valor_bruto'] > 0
                    ? round((float) $item['valor_bruto'], 2)
                    : round($cantidad * $precioUnitario, 2);

                $comisionBolsa = round((float) ($item['comision_bolsa'] ?? 0), 2);
                $comisionOperador = round((float) ($item['comision_operador'] ?? 0), 2);
                $totalComisiones = round($comisionBolsa + $comisionOperador, 2);

                $valorNeto = isset($item['valor_neto']) && (float) $item['valor_neto'] > 0
                    ? round((float) $item['valor_neto'], 2)
                    : ($idTipoOperacion === 205
                        ? round($valorBruto - $totalComisiones, 2)
                        : round($valorBruto + $totalComisiones, 2));

                // Validar stock disponible si es Venta (205)
                if ($idTipoOperacion === 205) {
                    $posicion = DB::table('vw_accion_posicion')
                        ->where('id_persona', $idPersona)
                        ->where('id_instrumento', $idInstrumento)
                        ->first();
                    $stockActual = $posicion ? (float) $posicion->cantidad_actual : 0.0;
                    if ($stockActual < $cantidad) {
                        throw new \RuntimeException(
                            "Stock insuficiente para la liquidación {$liquidacion}: disponible {$stockActual}, solicitado {$cantidad}."
                        );
                    }
                }

                $observacion = $item['observacion'] ?? ('Importado desde PDF: ' . ($item['filename'] ?? $liquidacion));

                $payload = [
                    'id_inversion' => null,
                    'id_instrumento' => $idInstrumento,
                    'id_persona' => $idPersona,
                    'id_tipo_operacion' => $idTipoOperacion,
                    'fecha_operacion' => $fechaOperacion,
                    'liquidacion' => $liquidacion,
                    'cantidad' => $cantidad,
                    'precio_unitario' => $precioUnitario,
                    'valor_bruto' => $valorBruto,
                    'comision_bolsa' => $comisionBolsa,
                    'comision_operador' => $comisionOperador,
                    'total_comisiones' => $totalComisiones,
                    'valor_neto' => $valorNeto,
                    'observacion' => mb_substr($observacion, 0, 500),
                    'activo' => true,
                    'eliminado' => false,
                    'fecha_creacion' => now(),
                    'fecha_actualizacion' => now(),
                ];

                if ($registrarMovimientoCapital) {
                    // AccionOperacionObserver crea automáticamente el registro en movimiento_capital y actualiza id_movimiento_capital
                    $operacion = AccionOperacion::create($payload);
                } else {
                    $operacion = AccionOperacion::withoutEvents(function () use ($payload) {
                        return AccionOperacion::create($payload);
                    });
                }

                $guardadas[] = [
                    'id_accion_operacion' => $operacion->id_accion_operacion,
                    'id_instrumento' => $idInstrumento,
                    'id_persona' => $idPersona,
                    'id_movimiento_capital' => $operacion->id_movimiento_capital,
                    'liquidacion' => $liquidacion,
                    'cantidad' => $cantidad,
                    'precio_unitario' => $precioUnitario,
                    'valor_neto' => $valorNeto,
                ];
            }

            DB::commit();

            return [
                'total_guardados' => count($guardadas),
                'total_omitidos' => count($omitidas),
                'guardadas' => $guardadas,
                'omitidas' => $omitidas,
            ];
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Resuelve el id_persona del comitente por cédula o nombre
     */
    private function resolverPersona(?string $identificacion, ?string $nombrePdf, $personas): array
    {
        if ($identificacion) {
            foreach ($personas as $p) {
                if (!empty($p->identificacion) && str_starts_with(trim($p->identificacion), trim($identificacion))) {
                    return [$p->id_persona, trim("{$p->nombres} {$p->apellidos}")];
                }
            }
        }

        if ($nombrePdf) {
            $upper = mb_strtoupper($nombrePdf);
            foreach ($personas as $p) {
                $pNombre = mb_strtoupper(trim($p->nombres));
                $pApellido = mb_strtoupper(trim($p->apellidos));
                if ($pNombre && $pApellido && str_contains($upper, $pNombre) && str_contains($upper, $pApellido)) {
                    return [$p->id_persona, trim("{$p->nombres} {$p->apellidos}")];
                }
            }

            if (str_contains($upper, 'JHON')) {
                return [1, 'Jhon Orellana'];
            }
            if (str_contains($upper, 'CRISTIAN')) {
                return [3, 'Cristian Orellana'];
            }
            if (str_contains($upper, 'ISABEL')) {
                return [2, 'Isabel Cepeda'];
            }
            if (str_contains($upper, 'ARGENTINA')) {
                return [4, 'Argentina Campaña'];
            }
        }

        return [1, 'Jhon Orellana'];
    }

    /**
     * Resuelve el Emisor y el Instrumento de Acción (id_tipo_inversion = 203)
     */
    private function resolverEmisorEInstrumento(
        ?string $emisorPdf,
        ?string $codigoVector,
        $emisores,
        $instrumentos
    ): array {
        $upper = mb_strtoupper((string) $emisorPdf);
        $ticker = strtoupper((string) $codigoVector);

        // 1. Mapeo directo por Ticker oficial de BVQ/BVG o palabras clave inequívocas
        $targetInstrumentoId = null;
        $targetEmisorId = null;
        $metodo = null;

        if ($ticker === 'BLD' || str_contains($upper, 'BOLIVARIANO')) {
            $targetInstrumentoId = 224;
            $targetEmisorId = 5;
            $metodo = $ticker === 'BLD' ? 'Código Vector (BLD)' : 'Nombre Emisor';
        } elseif ($ticker === 'BVQ' || (str_contains($upper, 'BOLSA') && str_contains($upper, 'QUITO'))) {
            $targetInstrumentoId = 240;
            $targetEmisorId = 16;
            $metodo = $ticker === 'BVQ' ? 'Código Vector (BVQ)' : 'Nombre Emisor';
        } elseif ($ticker === 'PRE' || str_contains($upper, 'PRODUBANCO') || str_contains($upper, 'PRODUCCION')) {
            $targetInstrumentoId = 98;
            $targetEmisorId = 6;
            $metodo = $ticker === 'PRE' ? 'Código Vector (PRE)' : 'Nombre Emisor';
        } elseif ($ticker === 'GYL' || (str_contains($upper, 'GUAYAQUIL') && str_contains($upper, 'BANCO'))) {
            $targetInstrumentoId = 192;
            $targetEmisorId = 7;
            $metodo = $ticker === 'GYL' ? 'Código Vector (GYL)' : 'Nombre Emisor';
        } elseif ($ticker === 'PCD' || str_contains($upper, 'PICHINCHA')) {
            $targetInstrumentoId = 194;
            $targetEmisorId = 8;
            $metodo = $ticker === 'PCD' ? 'Código Vector (PCD)' : 'Nombre Emisor';
        } elseif ($ticker === 'AST' || str_contains($upper, 'AUSTRO')) {
            $targetInstrumentoId = 117;
            $targetEmisorId = 10;
            $metodo = $ticker === 'AST' ? 'Código Vector (AST)' : 'Nombre Emisor';
        } elseif ($ticker === 'SLU' || str_contains($upper, 'FAVORITA')) {
            $targetInstrumentoId = 196;
            $targetEmisorId = 32;
            $metodo = $ticker === 'SLU' ? 'Código Vector (SLU)' : 'Nombre Emisor';
        } elseif ($ticker === 'CRS' || str_contains($upper, 'CRIDESA')) {
            $targetInstrumentoId = 221;
            $targetEmisorId = 29;
            $metodo = $ticker === 'CRS' ? 'Código Vector (CRS)' : 'Nombre Emisor';
        } elseif ($ticker === 'BRI' || str_contains($upper, 'BRIKAPITAL')) {
            $targetInstrumentoId = 25;
            $targetEmisorId = 14;
            $metodo = $ticker === 'BRI' ? 'Código Vector (BRI)' : 'Nombre Emisor';
        }

        if ($targetInstrumentoId) {
            foreach ($instrumentos as $inst) {
                if ((int) $inst->id_instrumento === $targetInstrumentoId) {
                    return [
                        (int) $inst->id_emisor,
                        $inst->emisor_nombre ?? $inst->nombre,
                        (int) $inst->id_instrumento,
                        $inst->nombre,
                        $metodo,
                    ];
                }
            }
        }

        // 2. Búsqueda dinámica en instrumentos existentes (203 ACNPI) y emisores
        if ($upper !== '') {
            foreach ($instrumentos as $inst) {
                $instNom = mb_strtoupper((string) $inst->nombre);
                $emiNom = mb_strtoupper((string) $inst->emisor_nombre);
                if (
                    ($instNom !== '' && (str_contains($upper, $instNom) || str_contains($instNom, $upper)))
                    || ($emiNom !== '' && (str_contains($upper, $emiNom) || str_contains($emiNom, $upper)))
                ) {
                    return [
                        (int) $inst->id_emisor,
                        $inst->emisor_nombre ?? $inst->nombre,
                        (int) $inst->id_instrumento,
                        $inst->nombre,
                        'Coincidencia en Catálogo',
                    ];
                }
            }

            foreach ($emisores as $em) {
                $emiNom = mb_strtoupper((string) $em->nombre);
                if ($emiNom !== '' && (str_contains($upper, $emiNom) || str_contains($emiNom, $upper))) {
                    // Buscar si ese emisor tiene un instrumento 203
                    foreach ($instrumentos as $inst) {
                        if ((int) $inst->id_emisor === (int) $em->id_emisor) {
                            return [
                                (int) $em->id_emisor,
                                $em->nombre,
                                (int) $inst->id_instrumento,
                                $inst->nombre,
                                'Por Emisor Registrado',
                            ];
                        }
                    }

                    return [(int) $em->id_emisor, $em->nombre, null, null, 'Solo Emisor (Instrumento Nuevo)'];
                }
            }
        }

        return [null, $emisorPdf, null, null, null];
    }

    /**
     * Crea automáticamente el Emisor (si no existe) y el Instrumento perpetuo de Acción (id_tipo_inversion = 203)
     */
    private function obtenerOCrearInstrumentoAccion(array $item, string $fechaOperacion): int
    {
        $idEmisor = !empty($item['id_emisor']) ? (int) $item['id_emisor'] : null;
        $nombreEmisor = trim((string) ($item['emisor_nombre'] ?? 'EMISOR ACCION'));
        $sigla = strtoupper(trim((string) ($item['codigo_vector'] ?? '')));

        if ($sigla === '') {
            $palabras = preg_split('/\s+/', preg_replace('/[^A-Z0-9\s]/i', '', $nombreEmisor));
            $sigla = strtoupper(substr(end($palabras) ?: 'ACC', 0, 10));
        }

        if (!$idEmisor) {
            $emisorExistente = DB::table('emisor')
                ->whereRaw('UPPER(nombre) = ?', [mb_strtoupper($nombreEmisor)])
                ->first();

            if ($emisorExistente) {
                $idEmisor = (int) $emisorExistente->id_emisor;
            } else {
                $idEmisor = DB::table('emisor')->insertGetId([
                    'nombre' => mb_strtoupper($nombreEmisor),
                    'sigla' => mb_substr($sigla, 0, 20),
                    'valor_nominal' => (float) ($item['valor_nominal_unitario'] ?? 1.00),
                    'id_tipo_emisor' => 156,
                    'activo' => 1,
                    'fecha_creacion' => now(),
                    'fecha_actualizacion' => now(),
                ]);
            }
        }

        // Verificar si ya existe un instrumento 203 para este emisor
        $instExistente = DB::table('instrumento')
            ->where('id_emisor', $idEmisor)
            ->where('id_tipo_inversion', 203)
            ->where('activo', 1)
            ->first();

        if ($instExistente) {
            return (int) $instExistente->id_instrumento;
        }

        $instrumento = Instrumento::create([
            'id_emisor' => $idEmisor,
            'id_tipo_inversion' => 203, // ACNPI - Acción sin pago interés
            'codigo_titulo' => 'INV_73_20341231_' . $sigla,
            'nombre' => mb_strtoupper($nombreEmisor),
            'fecha_emision' => $fechaOperacion,
            'fecha_vencimiento' => '2034-12-31',
            'tasa_referencial' => 1.00000000,
            'codigo_titulo_vector' => 'ACC ' . $sigla,
            'codigo_seb' => 'ACC',
            'activo' => true,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now(),
        ]);

        return (int) $instrumento->id_instrumento;
    }
}

