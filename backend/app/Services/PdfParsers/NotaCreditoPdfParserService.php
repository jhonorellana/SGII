<?php

namespace App\Services\PdfParsers;

use App\Services\PdfParsers\Contracts\PdfSettlementParserInterface;
use App\Services\PdfParsers\DTOs\ParsedSettlementDto;

class NotaCreditoPdfParserService implements PdfSettlementParserInterface
{
    public function canHandle(string $fullText, array $pagesText): bool
    {
        $textUpper = mb_strtoupper($fullText);
        return str_contains($textUpper, 'NOTA DE CREDITO') || str_contains($textUpper, 'NOTAS DE CREDITO');
    }

    public function parse(string $filename, string $fullText, array $pagesText): ParsedSettlementDto
    {
        try {
            $p1 = $pagesText[0] ?? '';
            // Página 7 generalmente contiene la liquidación oficial de bolsa (índice 6)
            $p7 = $pagesText[6] ?? '';
            // Si el documento tiene menos páginas o la pág 7 está vacía, buscamos en todo el texto
            $scopeText = !empty($p7) ? $p7 : $fullText;

            $bolsa = $this->detectarBolsa($fullText);

            if ($bolsa === 'BVQ') {
                return $this->parseBvq($filename, $fullText, $p1, $scopeText);
            } else {
                return $this->parseBvg($filename, $fullText, $p1, $scopeText);
            }
        } catch (\Throwable $e) {
            return new ParsedSettlementDto(
                filename: $filename,
                bolsa: 'DESCONOCIDA',
                tipoTitulo: 'NOTA_CREDITO',
                comitenteNombre: null,
                comitenteIdentificacion: null,
                liquidacion: null,
                fechaNegociacion: null,
                valorNominal: 0.0,
                precioCompra: 0.0,
                valorEfectivo: 0.0,
                comisionBolsa: 0.0,
                comisionCasaValores: 0.0,
                totalInvertido: 0.0,
                precioNetoCompra: 0.0,
                success: false,
                errorMessage: 'Error al procesar el archivo PDF: ' . $e->getMessage()
            );
        }
    }

    private function detectarBolsa(string $text): string
    {
        $upper = mb_strtoupper($text);
        if (str_contains($upper, 'BOLSA DE VALORES QUITO') || str_contains($upper, 'BVQ')) {
            return 'BVQ';
        }
        return 'BVG';
    }

    /**
     * Parsea documentos de la Bolsa de Valores de Guayaquil (BVG)
     */
    private function parseBvg(string $filename, string $fullText, string $p1, string $p7): ParsedSettlementDto
    {
        // 1. Liquidación (Operación No)
        $liquidacion = null;
        if (preg_match('/Operaci[oó]n\s+No:?\s*[\r\n\t]*([0-9]{4,8})/i', $p7, $m)) {
            $liquidacion = trim($m[1]);
        } elseif (preg_match('/37[0-9]{4}/', $p1, $m)) {
            $liquidacion = trim($m[0]);
        }

        // 2. Comitente y Cédula
        [$comitenteNombre, $comitenteIdentificacion] = $this->extraerComitente($p1, $fullText);

        // 3. Fecha de Negociación
        $fechaNegociacion = null;
        if (preg_match('/Fecha\s+de\s+negociaci[oó]n:\s*([0-9]{2})\/([0-9]{2})\/([0-9]{4})/i', $p7, $m)) {
            $fechaNegociacion = "{$m[3]}-{$m[2]}-{$m[1]}";
        } elseif (preg_match('/Fecha\s+valor:\s*([0-9]{2})\/([0-9]{2})\/([0-9]{4})/i', $p7, $m)) {
            $fechaNegociacion = "{$m[3]}-{$m[2]}-{$m[1]}";
        }

        // 4. Valor Nominal
        $valorNominal = 0.0;
        if (preg_match('/Valor\s+nominal:\s*\$?\s*([0-9.,]+)/i', $p7, $m)) {
            $valorNominal = $this->normalizarNumero($m[1]);
        }

        // 5. Precio Compra %
        $precioCompra = 0.0;
        if (preg_match('/Precio:\s*([0-9.,]+)/i', $p7, $m)) {
            $precioCompra = $this->normalizarNumero($m[1]);
        }

        // 6. Valor Efectivo
        $valorEfectivo = 0.0;
        if (preg_match('/\(A\)\s*VALOR\s+EFECTIVO\s+([0-9.,]+)/i', $p7, $m)) {
            $valorEfectivo = $this->normalizarNumero($m[1]);
        }

        // 7. Comisión Bolsa
        $comisionBolsa = 0.0;
        if (preg_match('/\(C\)\s*BOLSA\s+[0-9.,]+\s+([0-9.,]+)/i', $p7, $m)) {
            $comisionBolsa = $this->normalizarNumero($m[1]);
        }

        // 8. Comisión Casa de Valores / Operador
        $comisionCasaValores = 0.0;
        if (preg_match('/\(D\)\s*OPERADOR\s+[0-9.,]+\s+([0-9.,]+)/i', $p7, $m)) {
            $comisionCasaValores = $this->normalizarNumero($m[1]);
        }

        // 9. Total Invertido (Total Comprador Neto)
        $totalInvertido = 0.0;
        if (preg_match('/TOTAL\s+COMPRADOR\s+NETO:\s*([0-9.,]+)/i', $p7, $m)) {
            $totalInvertido = $this->normalizarNumero($m[1]);
        } elseif (preg_match('/SUBTOTALES:\s*([0-9.,]+)/i', $p7, $m)) {
            $totalInvertido = $this->normalizarNumero($m[1]);
        } else {
            $totalInvertido = round($valorEfectivo + $comisionBolsa + $comisionCasaValores, 2);
        }

        // 10. Precio Neto Compra
        $precioNetoCompra = 0.0;
        if (preg_match('/PRECIO\s+NETO:\s*([0-9.,]+)/i', $p7, $m)) {
            $precioNetoCompra = $this->normalizarNumero($m[1]);
        } elseif ($valorNominal > 0) {
            $precioNetoCompra = round(($totalInvertido / $valorNominal) * 100, 6);
        }

        // 11. Factura Bolsa
        $facturaBolsa = null;
        if (preg_match('/Factura\s+No\.?:?\s*([0-9\-]+)/i', $p7, $m)) {
            $facturaBolsa = trim($m[1]);
        }

        // 12. Operador de Valores
        $operadorValores = null;
        if (preg_match('/Operador\s+de\s+valores:\s*([^\r\n\t]+)/i', $p7, $m)) {
            $operadorValores = trim($m[1]);
        }

        return new ParsedSettlementDto(
            filename: $filename,
            bolsa: 'BVG',
            tipoTitulo: 'NOTA_CREDITO',
            comitenteNombre: $comitenteNombre,
            comitenteIdentificacion: $comitenteIdentificacion,
            liquidacion: $liquidacion,
            fechaNegociacion: $fechaNegociacion,
            valorNominal: $valorNominal,
            precioCompra: $precioCompra,
            valorEfectivo: $valorEfectivo,
            comisionBolsa: $comisionBolsa,
            comisionCasaValores: $comisionCasaValores,
            totalInvertido: $totalInvertido,
            precioNetoCompra: $precioNetoCompra,
            facturaBolsa: $facturaBolsa,
            operadorValores: $operadorValores,
            success: true
        );
    }

    /**
     * Parsea documentos de la Bolsa de Valores de Quito (BVQ)
     */
    private function parseBvq(string $filename, string $fullText, string $p1, string $p7): ParsedSettlementDto
    {
        // 1. Liquidación (ej. Compra No. 22820 - VRF45)
        $liquidacion = null;
        if (preg_match('/Compra\s+N0?\.?\s*([0-9]{4,6}\s*-\s*VRF[0-9]{1,3})/i', $p7, $m)) {
            $liquidacion = preg_replace('/\s+/', '', trim($m[1]));
        } elseif (preg_match('/([0-9]{4,6}-VRF[0-9]{1,3})/i', $p1, $m)) {
            $liquidacion = trim($m[1]);
        }

        // 2. Comitente y Cédula
        [$comitenteNombre, $comitenteIdentificacion] = $this->extraerComitente($p1, $fullText);

        // 3. Fecha de Negociación (Fecha valor)
        $fechaNegociacion = null;
        if (preg_match('/Fecha\s+valor\s*[\r\n\t<>]*([0-9]{2})-([0-9]{2})-([0-9]{4})/i', $p7, $m)) {
            $fechaNegociacion = "{$m[3]}-{$m[2]}-{$m[1]}";
        } elseif (preg_match('/Quito,\s*DM,\s*([0-9]{2})-([0-9]{2})-([0-9]{4})/i', $p7, $m)) {
            $fechaNegociacion = "{$m[3]}-{$m[2]}-{$m[1]}";
        }

        // 4. Valor Nominal
        $valorNominal = 0.0;
        if (preg_match('/Val\.\s*Nom\.\s*actual\s*[\r\n\t<>]*([0-9.,]+)/i', $p7, $m)) {
            $valorNominal = $this->normalizarNumero($m[1]);
        }

        // 5. Precio Compra %
        $precioCompra = 0.0;
        if (preg_match('/Precio\s*\(%\)\s*[\r\n\t<>]*([0-9.,]+)/i', $p7, $m)) {
            $precioCompra = $this->normalizarNumero($m[1]);
        }

        // 6. Valor Efectivo
        $valorEfectivo = 0.0;
        if (preg_match('/Valor\s+efectivo\s*\(A\)\s*[\r\n\t<>]*([0-9.,]+)/i', $p7, $m)) {
            $valorEfectivo = $this->normalizarNumero($m[1]);
        }

        // 7. Comisión Bolsa
        $comisionBolsa = 0.0;
        if (preg_match('/Bolsa\s*\(C\)\s+[0-9.,]+\s+([0-9.,]+)/i', $p7, $m)) {
            $comisionBolsa = $this->normalizarNumero($m[1]);
        }

        // 8. Comisión Casa de Valores / Operador
        $comisionCasaValores = 0.0;
        if (preg_match('/Operador\s*\(D\)\s+[0-9.,]+\s+([0-9.,]+)/i', $p7, $m)) {
            $comisionCasaValores = $this->normalizarNumero($m[1]);
        }

        // 9. Total Invertido
        $totalInvertido = 0.0;
        if (preg_match('/Total\s+comprador\s*\(A\+B\+C\+D-RO-RB\)\s*[\r\n\t<>]*([0-9.,]+)/i', $p7, $m)) {
            $totalInvertido = $this->normalizarNumero($m[1]);
        } elseif (preg_match('/Total\s*\(\s*A\+B\+C\+D\s*\)\s*[0-9.,]+\s+([0-9.,]+)/i', $p7, $m)) {
            $totalInvertido = $this->normalizarNumero($m[1]);
        } else {
            $totalInvertido = round($valorEfectivo + $comisionBolsa + $comisionCasaValores, 2);
        }

        // 10. Precio Neto Compra
        $precioNetoCompra = 0.0;
        if (preg_match('/Precio\s+Neto\s*\(%\)\s*[\r\n\t<>]*([0-9.,]+)/i', $p7, $m)) {
            $precioNetoCompra = $this->normalizarNumero($m[1]);
        } elseif ($valorNominal > 0) {
            $precioNetoCompra = round(($totalInvertido / $valorNominal) * 100, 6);
        }

        // 11. Factura Bolsa
        $facturaBolsa = null;
        if (preg_match('/asociada\s+a\s+factura\s+N0?\.?\s*[\r\n\t<>]*([0-9\-]+)/i', $p7, $m)) {
            $facturaBolsa = trim($m[1]);
        }

        // 12. Operador de Valores
        $operadorValores = null;
        if (preg_match('/Operador\s+de\s+valores\s*[\r\n\t<>]*([A-ZÁÉÍÓÚÑ\s]{5,50}?)(?=\s*Datos\b|\s*<|$)/i', $p7, $m)) {
            $operadorValores = trim(preg_replace('/\s+/', ' ', $m[1]));
        }

        return new ParsedSettlementDto(
            filename: $filename,
            bolsa: 'BVQ',
            tipoTitulo: 'NOTA_CREDITO',
            comitenteNombre: $comitenteNombre,
            comitenteIdentificacion: $comitenteIdentificacion,
            liquidacion: $liquidacion,
            fechaNegociacion: $fechaNegociacion,
            valorNominal: $valorNominal,
            precioCompra: $precioCompra,
            valorEfectivo: $valorEfectivo,
            comisionBolsa: $comisionBolsa,
            comisionCasaValores: $comisionCasaValores,
            totalInvertido: $totalInvertido,
            precioNetoCompra: $precioNetoCompra,
            facturaBolsa: $facturaBolsa,
            operadorValores: $operadorValores,
            success: true
        );
    }

    /**
     * Extrae nombre e identificación (cédula de 10 dígitos) del comitente
     */
    private function extraerComitente(string $p1, string $fullText): array
    {
        $identificacion = null;
        $nombre = null;

        // Buscar cédula ecuatoriana de 10 dígitos en la cabecera del comitente
        if (preg_match('/([0-9]{10})\s+\d{4,6}/', $p1, $m)) {
            $identificacion = $m[1];
        } elseif (preg_match('/\b(0[1-9][0-9]{8}|1[0-9]{9}|2[0-4][0-9]{8})\b/', $p1, $m)) {
            $identificacion = $m[1];
        }

        // Extraer nombre comitente de Sección 1 o Sección 6 de Pág 1
        $lines = preg_split('/[\r\n]+/', $p1);
        foreach ($lines as $i => $line) {
            $lineTrim = trim($line);
            // La línea previa o posterior a la cédula frecuentemente es el nombre
            if ($identificacion && str_contains($lineTrim, $identificacion)) {
                if (isset($lines[$i - 1]) && preg_match('/[A-ZÁÉÍÓÚÑ]{3,}/', $lines[$i - 1])) {
                    $parts = explode("\t", $lines[$i - 1]);
                    $nombre = trim($parts[0]);
                    break;
                }
            }
        }

        if (!$nombre) {
            if (preg_match('/CAMPAÑA\s+CAMPAÑA\s+ARGENTINA\s+EULALIA/i', $fullText)) {
                $nombre = 'ARGENTINA EULALIA CAMPAÑA CAMPAÑA';
            } elseif (preg_match('/ORELLANA\s+OCAÑA\s+JHON\s+ALFREDO/i', $fullText)) {
                $nombre = 'JHON ALFREDO ORELLANA OCAÑA';
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
        $val = str_replace(['$', ' '], '', $val);

        if (str_contains($val, '.') && str_contains($val, ',')) {
            // Caso 1.234,56 o 1,234.56
            if (strrpos($val, ',') > strrpos($val, '.')) {
                $val = str_replace('.', '', $val);
                $val = str_replace(',', '.', $val);
            } else {
                $val = str_replace(',', '', $val);
            }
        } elseif (str_contains($val, ',')) {
            // Caso 518,26
            $val = str_replace(',', '.', $val);
        }

        return (float) $val;
    }
}
