<?php

namespace App\Services\PdfParsers\Contracts;

use App\Services\PdfParsers\DTOs\ParsedSettlementDto;

interface PdfSettlementParserInterface
{
    /**
     * Determina si este parser puede procesar el texto del documento
     */
    public function canHandle(string $fullText, array $pagesText): bool;

    /**
     * Procesa y extrae la información financiera del PDF
     *
     * @param string $filename
     * @param string $fullText
     * @param array<int, string> $pagesText
     * @return ParsedSettlementDto
     */
    public function parse(string $filename, string $fullText, array $pagesText): ParsedSettlementDto;
}
