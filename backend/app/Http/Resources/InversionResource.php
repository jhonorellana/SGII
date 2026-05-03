<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InversionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id_inversion' => $this->id_inversion,
            'id_grupo_familiar' => $this->id_grupo_familiar,
            'id_instrumento' => $this->id_instrumento,
            'id_propietario' => $this->id_propietario,
            'id_aportante' => $this->id_aportante,
            'liquidacion' => $this->liquidacion,
            'id_estado_inversion' => $this->id_estado_inversion,
            'fecha_compra' => $this->fecha_compra,
            'fecha_venta' => $this->fecha_venta,
            'valor_nominal' => $this->valor_nominal,
            'monto_a_negociar' => $this->monto_a_negociar,
            'capital_invertido' => $this->capital_invertido,
            'tasa_interes' => $this->tasa_interes,
            'rendimiento_nominal' => $this->rendimiento_nominal,
            'rendimiento_efectivo' => $this->rendimiento_efectivo,
            'valor_efectivo' => $this->valor_efectivo,
            'valor_sin_comision' => $this->valor_sin_comision,
            'valor_con_interes' => $this->valor_con_interes,
            'interes_acumulado_previo' => $this->interes_acumulado_previo,
            'interes_mensual' => $this->interes_mensual,
            'interes_primer_mes' => $this->interes_primer_mes,
            'total_comisiones' => $this->total_comisiones,
            'tasa_mensual_real' => $this->tasa_mensual_real,
            'fecha_primer_pago' => $this->fecha_primer_pago,
            'precio_compra' => $this->precio_compra,
            'precio_neto_compra' => $this->precio_neto_compra,
            'comision_bolsa' => $this->comision_bolsa,
            'comision_casa_valores' => $this->comision_casa_valores,
            'retencion_fuente' => $this->retencion_fuente,
            'observacion' => $this->observacion,
            'expirado' => (bool) $this->expirado,
            'activo' => (bool) $this->activo,
            'eliminado' => (bool) $this->eliminado,
            'fecha_creacion' => $this->fecha_creacion,
            'fecha_actualizacion' => $this->fecha_actualizacion,
            'grupoFamiliar' => $this->grupoFamiliar ? [
                'id_grupo_familiar' => $this->grupoFamiliar->id_grupo_familiar,
                'nombre' => $this->grupoFamiliar->nombre,
            ] : null,
            'instrumento' => $this->instrumento ? [
                'id_instrumento' => $this->instrumento->id_instrumento,
                'nombre' => $this->instrumento->nombre,
                'codigo_titulo' => $this->instrumento->codigo_titulo,
                'codigo_titulo_vector' => $this->instrumento->codigo_titulo_vector,
                'fecha_emision' => $this->instrumento->fecha_emision,
                'fecha_vencimiento' => $this->instrumento->fecha_vencimiento,
                'tasa_referencial' => $this->instrumento->tasa_referencial,
                'calificacion_riesgo' => $this->instrumento->calificacion_riesgo,
                'codigo_seb' => $this->instrumento->codigo_seb,
                'codigo_bce' => $this->instrumento->codigo_bce,
                'activo' => (bool) $this->instrumento->activo,
                'emisor' => $this->instrumento->emisor ? [
                    'id_emisor' => $this->instrumento->emisor->id_emisor,
                    'nombre' => $this->instrumento->emisor->nombre,
                    'sigla' => $this->instrumento->emisor->sigla,
                ] : null,
                'tipoInversion' => $this->instrumento->tipoInversion ? [
                    'id_catalogo_valor' => $this->instrumento->tipoInversion->id_catalogo_valor,
                    'nombre' => $this->instrumento->tipoInversion->nombre,
                    'descripcion' => $this->instrumento->tipoInversion->descripcion,
                ] : null,
            ] : null,
            'propietario' => $this->propietario ? [
                'id_persona' => $this->propietario->id_persona,
                'nombres' => $this->propietario->nombres,
                'apellidos' => $this->propietario->apellidos,
                'identificacion' => $this->propietario->identificacion,
            ] : null,
            'aportante' => $this->aportante ? [
                'id_persona' => $this->aportante->id_persona,
                'nombres' => $this->aportante->nombres,
                'apellidos' => $this->aportante->apellidos,
                'identificacion' => $this->aportante->identificacion,
            ] : null,
            'estadoInversion' => $this->estadoInversion ? [
                'id_catalogo_valor' => $this->estadoInversion->id_catalogo_valor,
                'nombre' => $this->estadoInversion->nombre,
                'codigo' => $this->estadoInversion->codigo,
            ] : null,
        ];
    }
}
