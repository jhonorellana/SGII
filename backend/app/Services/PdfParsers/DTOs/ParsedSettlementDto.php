<?php

namespace App\Services\PdfParsers\DTOs;

class ParsedSettlementDto
{
    public function __construct(
        public string $filename,
        public string $bolsa, // 'BVQ' o 'BVG'
        public string $tipoTitulo, // 'NOTA_CREDITO' o 'PAPEL_COMERCIAL'
        public ?string $comitenteNombre,
        public ?string $comitenteIdentificacion,
        public ?string $liquidacion,
        public ?string $fechaNegociacion, // YYYY-MM-DD
        public float $valorNominal,
        public float $precioCompra, // porcentaje ej. 96.50
        public float $valorEfectivo,
        public float $comisionBolsa,
        public float $comisionCasaValores,
        public float $totalInvertido,
        public float $precioNetoCompra,
        public ?string $facturaBolsa = null,
        public ?string $operadorValores = null,
        public ?string $emisorNombre = null,
        public ?string $fechaEmision = null, // YYYY-MM-DD
        public ?string $fechaVencimiento = null, // YYYY-MM-DD
        public ?float $tasaInteres = null,
        public ?int $plazoDias = null,
        public ?string $codigoVector = null,
        public ?string $codigoSeb = null,
        public ?float $rendimientoNominal = null,
        public ?float $rendimientoEfectivo = null,
        public ?float $interesDevengado = null,
        public ?float $valorConInteres = null,
        public ?string $fechaPrimerPago = null, // YYYY-MM-DD
        public bool $success = true,
        public ?string $errorMessage = null,
        public array $rawMetadata = []
    ) {}

    public function toArray(): array
    {
        return [
            'filename' => $this->filename,
            'bolsa' => $this->bolsa,
            'tipo_titulo' => $this->tipoTitulo,
            'comitente_nombre' => $this->comitenteNombre,
            'comitente_identificacion' => $this->comitenteIdentificacion,
            'liquidacion' => $this->liquidacion,
            'fecha_negociacion' => $this->fechaNegociacion,
            'valor_nominal' => $this->valorNominal,
            'precio_compra' => $this->precioCompra,
            'valor_efectivo' => $this->valorEfectivo,
            'comision_bolsa' => $this->comisionBolsa,
            'comision_casa_valores' => $this->comisionCasaValores,
            'total_invertido' => $this->totalInvertido,
            'precio_neto_compra' => $this->precioNetoCompra,
            'factura_bolsa' => $this->facturaBolsa,
            'operador_valores' => $this->operadorValores,
            'emisor_nombre' => $this->emisorNombre,
            'fecha_emision' => $this->fechaEmision,
            'fecha_vencimiento' => $this->fechaVencimiento,
            'tasa_interes' => $this->tasaInteres,
            'plazo_dias' => $this->plazoDias,
            'codigo_vector' => $this->codigoVector,
            'codigo_seb' => $this->codigoSeb,
            'rendimiento_nominal' => $this->rendimientoNominal,
            'rendimiento_efectivo' => $this->rendimientoEfectivo,
            'interes_devengado' => $this->interesDevengado,
            'valor_con_interes' => $this->valorConInteres,
            'fecha_primer_pago' => $this->fechaPrimerPago,
            'success' => $this->success,
            'error_message' => $this->errorMessage,
            'raw_metadata' => $this->rawMetadata,
        ];
    }
}
