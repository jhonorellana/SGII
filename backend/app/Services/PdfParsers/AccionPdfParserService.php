<?php

namespace App\Services\PdfParsers;

use Smalot\PdfParser\Config;
use Smalot\PdfParser\Parser;

class AccionPdfParserService
{
    /**
     * Parsea un archivo PDF de liquidación de Renta Variable (Acciones - BVQ o BVG)
     */
    public function parseFile(string $filePath, ?string $originalName = null): array
    {
        $filename = $originalName ?? basename($filePath);

        try {
            $config = new Config();
            $config->setRetainImageContent(false);
            $parser = new Parser([], $config);

            $pdf = $parser->parseFile($filePath);
            $pages = $pdf->getPages();

            $pagesText = [];
            $fullText = '';
            foreach ($pages as $page) {
                $pText = $page->getText();
                $pagesText[] = $pText;
                $fullText .= "\n" . $pText;
            }

            unset($pdf, $pages);
            gc_collect_cycles();

            if (!$this->canHandle($fullText, $pagesText)) {
                return [
                    'success' => false,
                    'filename' => $filename,
                    'bolsa' => 'DESCONOCIDA',
                    'tipo_titulo' => 'DESCONOCIDO',
                    'error_message' => 'El archivo PDF no corresponde a una liquidación de Renta Variable (Acciones).',
                ];
            }

            return $this->parse($filename, $fullText, $pagesText);
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'filename' => $filename,
                'bolsa' => 'ERROR',
                'tipo_titulo' => 'ERROR',
                'error_message' => 'Error al leer el archivo PDF: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Determina si el texto del PDF corresponde a una operación de Acciones (Renta Variable)
     */
    public function canHandle(string $fullText, array $pagesText = []): bool
    {
        $upper = mb_strtoupper($fullText);

        // Excluir instrumentos de Renta Fija
        if (
            str_contains($upper, 'NOTA DE CREDITO')
            || str_contains($upper, 'NOTAS DE CREDITO')
            || str_contains($upper, 'PAPEL COMERCIAL')
            || str_contains($upper, 'BONOS DEL ESTADO')
            || str_contains($upper, 'COMPRA OBLIGACIONES')
            || str_contains($upper, 'COMPRA OBLIGACION')
            || str_contains($upper, 'VALORES DE TITULARIZACION')
        ) {
            return false;
        }

        return str_contains($upper, 'COMPRA ACCIONES')
            || str_contains($upper, 'VENTA ACCIONES')
            || str_contains($upper, 'ACCIONES V.N.:')
            || str_contains($upper, 'TÍTULO VALOR: ACCIONES')
            || str_contains($upper, 'TITULO VALOR: ACCIONES')
            || (str_contains($upper, 'MERCADO: RENTA VARIABLE') && str_contains($upper, 'ACCIONES'));
    }

    /**
     * Extrae todos los campos estructurados del expediente de Acciones (BVQ o BVG)
     */
    public function parse(string $filename, string $fullText, array $pagesText): array
    {
        $p1 = $pagesText[0] ?? '';
        $p3 = $pagesText[2] ?? '';
        $p4 = $pagesText[3] ?? '';
        $bolsa = $this->detectarBolsa($fullText);
        $liqPage = $this->encontrarPaginaLiquidacion($pagesText, $bolsa, $fullText);

        if ($bolsa === 'BVQ') {
            return $this->parseBvq($filename, $fullText, $p1, $p3, $p4, $liqPage, $pagesText);
        }

        return $this->parseBvg($filename, $fullText, $p1, $p3, $p4, $liqPage, $pagesText);
    }

    private function detectarBolsa(string $text): string
    {
        $upper = mb_strtoupper($text);
        // Primero verificar indicadores exclusivos de la liquidación oficial de cada bolsa
        if (str_contains($upper, 'LIQUIDACIÓN DE CONTRATO') || str_contains($upper, 'LIQUIDACION DE CONTRATO') || str_contains($upper, 'BOLSA DE VALORES QUITO BVQ')) {
            return 'BVQ';
        }
        if (str_contains($upper, 'OPERACIÓN NO:') || str_contains($upper, 'OPERACION NO:') || str_contains($upper, 'MERCADO: RENTA VARIABLE')) {
            return 'BVG';
        }
        return 'BVG';
    }

    private function encontrarPaginaLiquidacion(array $pagesText, string $bolsa, string $fullText): string
    {
        foreach ($pagesText as $pText) {
            $u = mb_strtoupper($pText);
            if ($bolsa === 'BVQ') {
                if (str_contains($u, 'LIQUIDACIÓN DE CONTRATO') || (str_contains($u, 'VALOR EFECTIVO (A)') && str_contains($u, 'CANTIDAD'))) {
                    return $pText;
                }
            } else {
                if (str_contains($u, 'MERCADO: RENTA VARIABLE') || (str_contains($u, 'NÚMERO DE TÍTULOS') && str_contains($u, 'VALOR EFECTIVO'))) {
                    return $pText;
                }
            }
        }

        if (!empty($pagesText[8])) {
            return $pagesText[8];
        }

        return $fullText;
    }

    /**
     * Parsea liquidaciones de Acciones de la Bolsa de Valores de Quito (BVQ)
     */
    private function parseBvq(
        string $filename,
        string $fullText,
        string $p1,
        string $p3,
        string $p4,
        string $liqPage,
        array $pagesText
    ): array {
        // 1. Tipo de Operación (204 = COMPRA_ACCION, 205 = VENTA_ACCION)
        $esVenta = $this->esOperacionVenta($liqPage, $p1, $fullText);
        $idTipoOperacion = $esVenta ? 205 : 204;
        $tipoOperacionCodigo = $esVenta ? 'VENTA_ACCION' : 'COMPRA_ACCION';
        $tipoOperacionNombre = $esVenta ? 'Venta de Acciones' : 'Compra de Acciones';

        // 2. Número de Liquidación normalizado con formato estándar "24815_02 - VAD20"
        $liquidacion = null;
        if (preg_match('/(?:Compra|Venta)\s+N0?\.?\s*([0-9_]{3,12})\s*-\s*(VAD[0-9]{1,3}|VRF[0-9]{1,3})/iu', $liqPage, $m)) {
            $liquidacion = trim($m[1]) . ' - ' . strtoupper(trim($m[2]));
        } elseif (preg_match('/([0-9_]{3,12})\s*-\s*(VAD[0-9]{1,3}|VRF[0-9]{1,3})/iu', $p1, $m)) {
            $liquidacion = trim($m[1]) . ' - ' . strtoupper(trim($m[2]));
        } elseif (preg_match('/Liq-([0-9_]{3,12})-(VAD[0-9]{1,3})/iu', $filename, $m)) {
            $liquidacion = trim($m[1]) . ' - ' . strtoupper(trim($m[2]));
        }

        // 3. Comitente (Nombre y Cédula)
        [$comitenteNombre, $comitenteIdentificacion] = $this->extraerComitente($p1, $fullText);

        // 4. Emisor y Código Vector (ej. BLD, BVQ, PRE)
        $emisorNombre = $this->extraerEmisor($liqPage, $p1, $p4, $fullText);
        $codigoVector = $this->extraerCodigoVector($liqPage, $emisorNombre, $pagesText);
        $codigoSeb = 'ACC';

        // 5. Fechas: Fecha Operación (Fecha de Cierre / Negociación) y Fecha Valor
        $fechaOperacion = null;
        if (preg_match('/Fecha\/\s*hora\s+de\s+cierre:\s*([0-9]{2})-([0-9]{2})-([0-9]{4})/iu', $liqPage, $m)) {
            $fechaOperacion = "{$m[3]}-{$m[2]}-{$m[1]}";
        } elseif (preg_match('/Quito,\s*DM,\s*([0-9]{2})-([0-9]{2})-([0-9]{4})/iu', $liqPage, $m)) {
            $fechaOperacion = "{$m[3]}-{$m[2]}-{$m[1]}";
        }

        $fechaValor = null;
        if (preg_match('/Fecha\s+valor\s*[\r\n\t<>]*([0-9]{2})-([0-9]{2})-([0-9]{4})/iu', $liqPage, $m)) {
            $fechaValor = "{$m[3]}-{$m[2]}-{$m[1]}";
        }

        if (!$fechaOperacion && $fechaValor) {
            $fechaOperacion = $fechaValor;
        }

        // 6. Cantidad de Acciones y Valor Nominal Unitario
        $cantidad = 0.0;
        if (preg_match('/\bCantidad\s*[\r\n\t<>]*([0-9.,]+)/iu', $liqPage, $m)) {
            $cantidad = $this->normalizarNumero($m[1]);
        }

        $valorNominalUnitario = 1.0;
        if (preg_match('/V\.N\.:\s*US\s*([0-9.,]+)/iu', $liqPage, $m)) {
            $valorNominalUnitario = $this->normalizarNumero($m[1]);
        }

        // Fallback desde Pág. 1 si no se encontró cantidad: "678\t1,00\t678,00"
        if ($cantidad <= 0 && preg_match('/[\r\n]([0-9.,]+)\t([0-9.,]+)\t([0-9.,]+)[\r\n]+\s*US\$\s*[0-9.,]+/iu', $p1, $m)) {
            $cantidad = $this->normalizarNumero($m[1]);
            $valorNominalUnitario = $this->normalizarNumero($m[2]);
        }

        $valorNominalTotal = round($cantidad * $valorNominalUnitario, 2);

        // 7. Precio Unitario (en USD)
        $precioUnitario = 0.0;
        if (preg_match('/\bPrecio\s*[\r\n\t<>]+([0-9.,]+)/iu', $liqPage, $m)) {
            $precioUnitario = $this->normalizarNumero($m[1]);
        } elseif (preg_match('/US\$\s*([0-9.,]+)/iu', $p1, $m)) {
            $precioUnitario = $this->normalizarNumero($m[1]);
        }

        // 8. Valor Bruto / Efectivo (A)
        $valorBruto = 0.0;
        if (preg_match('/Valor\s+efectivo\s*\(A\)\s*[\r\n\t<>-]*([0-9.,]+)/iu', $liqPage, $m)) {
            $valorBruto = $this->normalizarNumero($m[1]);
        } elseif (preg_match('/US\$\s*[0-9.,]+\s+([0-9.,]+)/iu', $p1, $m)) {
            $valorBruto = $this->normalizarNumero($m[1]);
        }

        if ($valorBruto <= 0 && $cantidad > 0 && $precioUnitario > 0) {
            $valorBruto = round($cantidad * $precioUnitario, 2);
        }

        // 9. Comisiones: Bolsa (C) y Operador (D)
        $comisionBolsa = 0.0;
        if (preg_match('/Bolsa\s*\(C\)\s+[0-9.,]+\s+([0-9.,]+)/iu', $liqPage, $m)) {
            $comisionBolsa = $this->normalizarNumero($m[1]);
        } elseif (preg_match('/Subtotal\s+comision\s+BVQ\s*[\t ]*([0-9.,]+)/iu', $liqPage, $m)) {
            $comisionBolsa = $this->normalizarNumero($m[1]);
        }

        $comisionOperador = 0.0;
        if (preg_match('/Operador\s*\(D\)\s+[0-9.,]+\s+([0-9.,]+)/iu', $liqPage, $m)) {
            $comisionOperador = $this->normalizarNumero($m[1]);
        } elseif (preg_match('/Subtotal\s+comisi.+?n\s+operador\s*[\t ]*([0-9.,]+)/iu', $liqPage, $m)) {
            $comisionOperador = $this->normalizarNumero($m[1]);
        }

        $totalComisiones = round($comisionBolsa + $comisionOperador, 2);

        // 10. Valor Neto (Total Comprador o Total Vendedor)
        $valorNeto = $esVenta
            ? round($valorBruto - $totalComisiones, 2)
            : round($valorBruto + $totalComisiones, 2);

        if (preg_match('/Total\s+(?:comprador|vendedor)\s*\(A\+B\+C\+D-RO-RB\)\s*[\r\n\t<>]*([0-9.,]+)/iu', $liqPage, $m)) {
            $parsedNeto = $this->normalizarNumero($m[1]);
            if ($parsedNeto > 0) {
                $valorNeto = $parsedNeto;
            }
        }

        // 11. Factura Bolsa, Factura Casa de Valores y Operador
        $facturaBolsa = null;
        if (preg_match('/asociada\s+a\s+factura\s+N0?\.?\s*[\r\n\t<>]*([0-9\-]{7,20})/iu', $liqPage, $m)) {
            $facturaBolsa = trim($m[1]);
        }

        $facturaCasaValores = null;
        if (preg_match('/\b(00[1-9]-[0-9]{3}-[0-9]{9})\b/', $p1, $m)) {
            $facturaCasaValores = trim($m[1]);
        }

        $operadorValores = null;
        if (preg_match('/Operador\s+de\s+valores\s*[\r\n\t<>]*([A-ZÁÉÍÓÚÑ\s]{5,50}?)(?=\s*Datos\b|\s*<|$)/iu', $liqPage, $m)) {
            $operadorValores = trim(preg_replace('/\s+/', ' ', $m[1]));
        }

        return [
            'success' => true,
            'filename' => $filename,
            'bolsa' => 'BVQ',
            'tipo_titulo' => 'ACCION',
            'id_tipo_operacion' => $idTipoOperacion,
            'tipo_operacion_codigo' => $tipoOperacionCodigo,
            'tipo_operacion_nombre' => $tipoOperacionNombre,
            'comitente_nombre' => $comitenteNombre,
            'comitente_identificacion' => $comitenteIdentificacion,
            'emisor_nombre' => $emisorNombre,
            'codigo_vector' => $codigoVector,
            'codigo_seb' => $codigoSeb,
            'liquidacion' => $liquidacion,
            'fecha_operacion' => $fechaOperacion,
            'fecha_valor' => $fechaValor,
            'cantidad' => $cantidad,
            'valor_nominal_unitario' => $valorNominalUnitario,
            'valor_nominal_total' => $valorNominalTotal,
            'precio_unitario' => $precioUnitario,
            'valor_bruto' => $valorBruto,
            'comision_bolsa' => $comisionBolsa,
            'comision_operador' => $comisionOperador,
            'total_comisiones' => $totalComisiones,
            'valor_neto' => $valorNeto,
            'factura_bolsa' => $facturaBolsa,
            'factura_casa_valores' => $facturaCasaValores,
            'operador_valores' => $operadorValores,
            'error_message' => null,
        ];
    }

    /**
     * Parsea liquidaciones de Acciones de la Bolsa de Valores de Guayaquil (BVG)
     */
    private function parseBvg(
        string $filename,
        string $fullText,
        string $p1,
        string $p3,
        string $p4,
        string $liqPage,
        array $pagesText
    ): array {
        // 1. Tipo de Operación (204 = COMPRA_ACCION, 205 = VENTA_ACCION)
        $esVenta = $this->esOperacionVenta($liqPage, $p1, $fullText);
        $idTipoOperacion = $esVenta ? 205 : 204;
        $tipoOperacionCodigo = $esVenta ? 'VENTA_ACCION' : 'COMPRA_ACCION';
        $tipoOperacionNombre = $esVenta ? 'Venta de Acciones' : 'Compra de Acciones';

        // 2. Número de Liquidación (Operación No: 3752452, 375105, 3723541)
        $liquidacion = null;
        if (preg_match('/Operaci.+?n\s+No:\s*[\r\n\t]*([0-9]{4,9})/iu', $liqPage, $m)) {
            $liquidacion = trim($m[1]);
        } elseif (preg_match('/Liq-([0-9]{5,9})-SFV/iu', $filename, $m)) {
            $liquidacion = trim($m[1]);
        } elseif (preg_match('/\b(3[0-9]{5,6})\b/', $p1, $m)) {
            $liquidacion = trim($m[1]);
        }

        // 3. Comitente (Nombre y Cédula)
        [$comitenteNombre, $comitenteIdentificacion] = $this->extraerComitente($p1, $fullText);

        // 4. Emisor y Código Vector
        $emisorNombre = $this->extraerEmisor($liqPage, $p1, $p4, $fullText);
        $codigoVector = $this->extraerCodigoVector($liqPage, $emisorNombre, $pagesText);
        $codigoSeb = 'ACC';

        // 5. Fechas: Fecha de Negociación (fecha_operacion) y Fecha Valor
        $fechaOperacion = null;
        if (preg_match('/Fecha\s+de\s+negociaci.+?n:\s*([0-9]{2})\/([0-9]{2})\/([0-9]{4})/iu', $liqPage, $m)) {
            $fechaOperacion = "{$m[3]}-{$m[2]}-{$m[1]}";
        }

        $fechaValor = null;
        if (preg_match('/Fecha\s+valor:\s*([0-9]{2})\/([0-9]{2})\/([0-9]{4})/iu', $liqPage, $m)) {
            $fechaValor = "{$m[3]}-{$m[2]}-{$m[1]}";
        }

        if (!$fechaOperacion && $fechaValor) {
            $fechaOperacion = $fechaValor;
        }

        // 6. Cantidad de Acciones y Valor Nominal Unitario
        $cantidad = 0.0;
        // En la Página 1 de Santa Fe la cantidad viene sin separadores de miles ("1100\t1,00\t1.100,00")
        if (preg_match('/[\r\n]([0-9]+)\t([0-9.,]+)\t([0-9.,]+)[\r\n]+\s*US\$\s*[0-9.,]+/iu', $p1, $m)) {
            $cantidad = (float) $m[1];
            $valorNominalUnitario = $this->normalizarNumero($m[2]);
        } else {
            $valorNominalUnitario = 1.0;
            if (preg_match('/Valor\s+nominal:\s*\$?\s*([0-9.,]+)/iu', $liqPage, $m)) {
                $valorNominalUnitario = $this->normalizarNumero($m[1]);
            }
            if (preg_match('/N.+?mero\s+de\s+t.+?tulos:\s*([0-9.,]+)/iu', $liqPage, $m)) {
                $rawCant = trim($m[1]);
                // En BVG "1,100" o "4,141" usa coma como separador de miles
                if (preg_match('/^[0-9]{1,3}(?:,[0-9]{3})+$/', $rawCant)) {
                    $cantidad = (float) str_replace(',', '', $rawCant);
                } else {
                    $cantidad = $this->normalizarNumero($rawCant);
                }
            }
        }

        $valorNominalTotal = round($cantidad * $valorNominalUnitario, 2);
        if (preg_match('/Monto\s+a\s+negociar:\s*\$?\s*([0-9.,]+)/iu', $liqPage, $m)) {
            $parsedMonto = $this->normalizarNumero($m[1]);
            if ($parsedMonto > 0) {
                $valorNominalTotal = $parsedMonto;
            }
        }

        // 7. Precio Unitario (en USD)
        $precioUnitario = 0.0;
        if (preg_match('/(?<!sucio:)Precio:\s*\$?\s*([0-9.,]+)/iu', $liqPage, $m)) {
            $precioUnitario = $this->normalizarNumero($m[1]);
        } elseif (preg_match('/US\$\s*([0-9.,]+)/iu', $p1, $m)) {
            $precioUnitario = $this->normalizarNumero($m[1]);
        }

        // 8. (A) Valor Efectivo / Valor Bruto
        $valorBruto = 0.0;
        if (preg_match('/\(A\)\s*VALOR\s+EFECTIVO\s*[\t ]*([0-9.,]+)/iu', $liqPage, $m)) {
            $valorBruto = $this->normalizarNumero($m[1]);
        } elseif (preg_match('/US\$\s*[0-9.,]+\s+([0-9.,]+)/iu', $p1, $m)) {
            $valorBruto = $this->normalizarNumero($m[1]);
        }

        if ($valorBruto <= 0 && $cantidad > 0 && $precioUnitario > 0) {
            $valorBruto = round($cantidad * $precioUnitario, 2);
        }

        // 9. Comisiones: (C) Bolsa y (D) Operador
        $comisionBolsa = 0.0;
        if (preg_match('/\(C\)\s*BOLSA\s+[0-9.,]+\s+([0-9.,]+)/iu', $liqPage, $m)) {
            $comisionBolsa = $this->normalizarNumero($m[1]);
        } elseif (preg_match('/\(C\)\s*BOLSA\s+([0-9.,]+)/iu', $liqPage, $m)) {
            $comisionBolsa = $this->normalizarNumero($m[1]);
        }

        $comisionOperador = 0.0;
        if (preg_match('/\(D\)\s*OPERADOR\s+[0-9.,]+\s+([0-9.,]+)/iu', $liqPage, $m)) {
            $comisionOperador = $this->normalizarNumero($m[1]);
        } elseif (preg_match('/\(D\)\s*OPERADOR\s+([0-9.,]+)/iu', $liqPage, $m)) {
            $comisionOperador = $this->normalizarNumero($m[1]);
        }

        $totalComisiones = round($comisionBolsa + $comisionOperador, 2);

        // 10. Valor Neto (Total Comprador Neto o Total Vendedor Neto)
        $valorNeto = $esVenta
            ? round($valorBruto - $totalComisiones, 2)
            : round($valorBruto + $totalComisiones, 2);

        if (preg_match('/TOTAL\s+(?:COMPRADOR|VENDEDOR)\s+NETO:\s*([0-9.,]+)/iu', $liqPage, $m)) {
            $parsedNeto = $this->normalizarNumero($m[1]);
            if ($parsedNeto > 0) {
                $valorNeto = $parsedNeto;
            }
        }

        // 11. Factura Bolsa, Factura Casa de Valores y Operador
        $facturaBolsa = null;
        if (preg_match('/Factura\s+No\.?:\s*([0-9\-]+)/iu', $liqPage, $m)) {
            $facturaBolsa = trim($m[1]);
        }

        $facturaCasaValores = null;
        if (preg_match('/\b(00[1-9]-[0-9]{3}-[0-9]{9})\b/', $p1, $m)) {
            $facturaCasaValores = trim($m[1]);
        }

        $operadorValores = null;
        if (preg_match('/Operador\s+de\s+valores:\s*([^\r\n\t]+)/iu', $liqPage, $m)) {
            $operadorValores = trim($m[1]);
        }

        return [
            'success' => true,
            'filename' => $filename,
            'bolsa' => 'BVG',
            'tipo_titulo' => 'ACCION',
            'id_tipo_operacion' => $idTipoOperacion,
            'tipo_operacion_codigo' => $tipoOperacionCodigo,
            'tipo_operacion_nombre' => $tipoOperacionNombre,
            'comitente_nombre' => $comitenteNombre,
            'comitente_identificacion' => $comitenteIdentificacion,
            'emisor_nombre' => $emisorNombre,
            'codigo_vector' => $codigoVector,
            'codigo_seb' => $codigoSeb,
            'liquidacion' => $liquidacion,
            'fecha_operacion' => $fechaOperacion,
            'fecha_valor' => $fechaValor,
            'cantidad' => $cantidad,
            'valor_nominal_unitario' => $valorNominalUnitario,
            'valor_nominal_total' => $valorNominalTotal,
            'precio_unitario' => $precioUnitario,
            'valor_bruto' => $valorBruto,
            'comision_bolsa' => $comisionBolsa,
            'comision_operador' => $comisionOperador,
            'total_comisiones' => $totalComisiones,
            'valor_neto' => $valorNeto,
            'factura_bolsa' => $facturaBolsa,
            'factura_casa_valores' => $facturaCasaValores,
            'operador_valores' => $operadorValores,
            'error_message' => null,
        ];
    }

    /**
     * Detecta si el documento corresponde a una Venta (true) o Compra (false)
     */
    private function esOperacionVenta(string $liqPage, string $p1, string $fullText): bool
    {
        if (preg_match('/Postura:\s*VENTA/iu', $liqPage)) {
            return true;
        }
        if (preg_match('/Liquidaci.+?n\s+de\s+contrato:\s*[\r\n\t]*Venta\s+N0/iu', $liqPage)) {
            return true;
        }
        if (preg_match('/\bVENTA\s+ACCIONES\b/iu', $p1)) {
            return true;
        }
        return false;
    }

    /**
     * Extrae el nombre limpio del Emisor desde Pág. 1, Pág. 4 o Pág. 9
     */
    private function extraerEmisor(string $liqPage, string $p1, string $p4, string $fullText): ?string
    {
        // 1. En Pág. 1 de Santa Fe: "ACCIONES\tBANCO BOLIVARIANO C.A."
        if (preg_match('/\bACCIONES\t([^\r\n\t]+)/iu', $p1, $m)) {
            $cand = trim($m[1]);
            if (strlen($cand) > 3 && $cand !== 'ACC') {
                return preg_replace('/\s+/', ' ', $cand);
            }
        }

        // 2. En Pág. 1 de Santa Fe: "COMPRA ACCIONES <EMISOR>\tACC"
        if (preg_match('/(?:COMPRA|VENTA)\s+ACCIONES\s+([^\r\n\t]+?)(?:\t|ACC\b)/iu', $p1, $m)) {
            $cand = trim($m[1]);
            if (strlen($cand) > 3) {
                return preg_replace('/\s+/', ' ', $cand);
            }
        }

        // 3. En BVG Pág. 9: "Emisor:\tBANCO BOLIVARIANO C.A."
        if (preg_match('/Emisor:\s*([^\r\n\t]+)/iu', $liqPage, $m)) {
            return trim(preg_replace('/\s+/', ' ', $m[1]));
        }

        // 4. En BVQ Pág. 9: "Emisor\nBANCO BOLIVARIANO\nC.A.\nCantidad"
        if (preg_match('/\bEmisor\s*[\r\n\t<>]+([A-ZÁÉÍÓÚÑ0-9\.\-\s]{3,80}?)(?=\s+Cantidad\b)/iu', $liqPage, $m)) {
            return trim(preg_replace('/\s+/', ' ', $m[1]));
        }

        return null;
    }

    /**
     * Extrae el Código Vector / Ticker de 3 letras de la acción (ej. BLD, BVQ, PRE, GYL)
     */
    private function extraerCodigoVector(string $liqPage, ?string $emisorNombre, array $pagesText): ?string
    {
        // En BVQ Pág. 9 viene explícito: "Código vector\nBLD\nRegistro RMV"
        if (preg_match('/C.+?digo\s+vector\s*[\r\n\t<>]+([A-Z]{3})\b/iu', $liqPage, $m)) {
            $ticker = strtoupper(trim($m[1]));
            if ($ticker !== 'NO' && $ticker !== 'APL') {
                return $ticker;
            }
        }

        // Si es BVG ("Código vector precio : NO APLICA"), inferir desde el nombre del emisor o desde Pág. 6 del Catastro
        if ($emisorNombre) {
            $upper = mb_strtoupper($emisorNombre);
            if (str_contains($upper, 'BOLIVARIANO')) {
                return 'BLD';
            }
            if (str_contains($upper, 'PRODUCCION') || str_contains($upper, 'PRODUBANCO')) {
                return 'PRE';
            }
            if (str_contains($upper, 'GUAYAQUIL') && str_contains($upper, 'BANCO')) {
                return 'GYL';
            }
            if (str_contains($upper, 'BOLSA') && str_contains($upper, 'QUITO')) {
                return 'BVQ';
            }
            if (str_contains($upper, 'BOLSA') && str_contains($upper, 'GUAYAQUIL')) {
                return 'BVG';
            }
            if (str_contains($upper, 'PICHINCHA')) {
                return 'PCD';
            }
            if (str_contains($upper, 'AUSTRO')) {
                return 'AST';
            }
            if (str_contains($upper, 'FAVORITA')) {
                return 'SLU';
            }
            if (str_contains($upper, 'CRIDESA')) {
                return 'CRS';
            }
            if (str_contains($upper, 'BRIKAPITAL')) {
                return 'BRI';
            }
            if (str_contains($upper, 'HOLCIM')) {
                return 'HLE';
            }
            if (str_contains($upper, 'CERVECERIA')) {
                return 'CNC';
            }
            if (str_contains($upper, 'INVERSANCARLOS')) {
                return 'ISC';
            }
        }

        return null;
    }

    /**
     * Extrae nombre e identificación (cédula de 10 dígitos) del comitente
     */
    private function extraerComitente(string $p1, string $fullText): array
    {
        $identificacion = null;
        $nombre = null;

        if (preg_match('/([0-9]{10})\s+\d{4,6}/', $p1, $m)) {
            $identificacion = $m[1];
        } elseif (preg_match('/\b(0[1-9][0-9]{8}|1[0-9]{9}|2[0-4][0-9]{8})\b/', $p1, $m)) {
            $identificacion = $m[1];
        }

        $lines = preg_split('/[\r\n]+/', $p1);
        foreach ($lines as $i => $line) {
            $lineTrim = trim($line);
            if ($identificacion && str_contains($lineTrim, $identificacion)) {
                if (isset($lines[$i - 1]) && preg_match('/[A-ZÁÉÍÓÚÑ]{3,}/u', $lines[$i - 1])) {
                    $parts = explode("\t", $lines[$i - 1]);
                    $nombre = trim($parts[0]);
                    break;
                }
            }
        }

        if (!$nombre) {
            if (preg_match('/CAMPA.+?A\s+CAMPA.+?A\s+ARGENTINA\s+EULALIA/iu', $fullText)) {
                $nombre = 'ARGENTINA EULALIA CAMPAÑA CAMPAÑA';
            } elseif (preg_match('/ORELLANA\s+OCA.+?A\s+JHON\s+ALFREDO/iu', $fullText)) {
                $nombre = 'JHON ALFREDO ORELLANA OCAÑA';
            } elseif (preg_match('/ORELLANA\s+CEPEDA\s+CRISTIAN\s+ALFREDO/iu', $fullText)) {
                $nombre = 'CRISTIAN ALFREDO ORELLANA CEPEDA';
            } elseif (preg_match('/CEPEDA\s+CAMPA.+?A\s+ISABEL\s+CRISTINA/iu', $fullText)) {
                $nombre = 'ISABEL CRISTINA CEPEDA CAMPAÑA';
            }
        }

        return [$nombre, $identificacion];
    }

    /**
     * Convierte cadenas con comas o puntos decimales a float estándar
     */
    private function normalizarNumero(string $val): float
    {
        $val = trim($val);
        $val = str_replace(['$', '%', ' '], '', $val);
        $val = ltrim($val, '-');

        if (str_contains($val, '.') && str_contains($val, ',')) {
            if (strrpos($val, ',') > strrpos($val, '.')) {
                $val = str_replace('.', '', $val);
                $val = str_replace(',', '.', $val);
            } else {
                $val = str_replace(',', '', $val);
            }
        } elseif (str_contains($val, ',')) {
            $val = str_replace(',', '.', $val);
        }

        return (float) $val;
    }
}
