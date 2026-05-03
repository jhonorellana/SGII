<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Instrumento extends Model
{
    protected $table = 'instrumento';
    protected $primaryKey = 'id_instrumento';
    public $timestamps = false;

    protected $fillable = [
        'id_emisor',
        'id_tipo_inversion',
        'codigo_titulo',
        'nombre',
        'fecha_emision',
        'fecha_vencimiento',
        'tasa_referencial',
        'valor_interes',
        'tipo_instrumento',
        'fechas_recuperacion',
        'codigo_titulo_vector',
        'codigo_seb',
        'codigo_bce',
        'calificacion_riesgo',
        'activo',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $casts = [
        'tasa_referencial' => 'decimal:8',
        'valor_interes' => 'decimal:2',
        'fecha_emision' => 'date',
        'fecha_vencimiento' => 'date',
        'activo' => 'boolean'
    ];

    // Relaciones
    public function emisor()
    {
        return $this->belongsTo(Emisor::class, 'id_emisor');
    }

    public function tipoInversion()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_tipo_inversion');
    }

    public function inversiones()
    {
        return $this->hasMany(Inversion::class, 'id_instrumento');
    }
}
