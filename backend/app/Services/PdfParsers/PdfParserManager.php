<?php

namespace App\Services\PdfParsers;

use App\Services\PdfParsers\Contracts\PdfSettlementParserInterface;
use App\Services\PdfParsers\DTOs\ParsedSettlementDto;
use Smalot\PdfParser\Config;
use Smalot\PdfParser\Parser;

class PdfParserManager
{
    /**
     * @var array<PdfSettlementParserInterface>
     */
    protected array $parsers = [];

    public function __construct(
        NotaCreditoPdfParserService $notaCreditoParser,
        PapelComercialPdfParserService $papelComercialParser,
        BonoPdfParserService $bonoParser
    ) {
        // Registrar parsers disponibles (Notas de Crédito, Papel Comercial, Bonos del Estado)
        $this->parsers[] = $notaCreditoParser;
        $this->parsers[] = $papelComercialParser;
        $this->parsers[] = $bonoParser;
    }

    /**
     * Parsea un archivo PDF desde una ruta física en disco
     */
    public function parseFile(string $filePath, ?string $originalName = null): ParsedSettlementDto
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

            // Liberar memoria del parser
            unset($pdf, $pages);
            gc_collect_cycles();

            // Buscar un parser que pueda manejar este documento
            foreach ($this->parsers as $p) {
                if ($p->canHandle($fullText, $pagesText)) {
                    return $p->parse($filename, $fullText, $pagesText);
                }
            }

            return new ParsedSettlementDto(
                filename: $filename,
                bolsa: 'DESCONOCIDA',
                tipoTitulo: 'DESCONOCIDO',
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
                errorMessage: 'No se encontró un parser adecuado para este tipo de documento bursátil.'
            );
        } catch (\Throwable $e) {
            return new ParsedSettlementDto(
                filename: $filename,
                bolsa: 'ERROR',
                tipoTitulo: 'ERROR',
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
                errorMessage: 'Error al leer el archivo PDF: ' . $e->getMessage()
            );
        }
    }
}
