<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InstrumentoResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id_instrumento' => $this->id_instrumento,
            'id_emisor' => $this->id_emisor,
            'id_tipo_inversion' => $this->id_tipo_inversion,
            'codigo_titulo' => $this->codigo_titulo,
            'nombre' => $this->nombre,
            'fecha_emision' => $this->fecha_emision,
            'fecha_vencimiento' => $this->fecha_vencimiento,
            'tasa_referencial' => $this->tasa_referencial,
            'fechas_recuperacion' => $this->fechas_recuperacion,
            'codigo_titulo_vector' => $this->codigo_titulo_vector,
            'codigo_seb' => $this->codigo_seb,
            'codigo_bce' => $this->codigo_bce,
            'activo' => (bool) $this->activo,
            'fecha_creacion' => $this->fecha_creacion,
            'fecha_actualizacion' => $this->fecha_actualizacion,
            'emisor' => $this->emisor ? [
                'id_emisor' => $this->emisor->id_emisor,
                'nombre' => $this->emisor->nombre,
                'sigla' => $this->emisor->sigla,
                'identificacion' => $this->emisor->identificacion,
            ] : null,
            'tipoInversion' => $this->tipoInversion ? [
                'id_catalogo_valor' => $this->tipoInversion->id_catalogo_valor,
                'nombre' => $this->tipoInversion->nombre,
                'codigo' => $this->tipoInversion->codigo,
            ] : null,
        ];
    }
}
