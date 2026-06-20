<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccionUltimoPrecio extends Model
{
    protected $table = 'accion_ultimo_precio';
    protected $primaryKey = 'id_accion_ultimo_precio';
    public $timestamps = false;
    public $incrementing = true;

    protected $fillable = [
        'id_emisor',
        'emisor',
        'fecha_ultimo_precio',
        'precio_ultimo',
        'precio_anterior',
        'variacion_precio',
        'variacion_porcentaje',
        'precio_minimo_dia',
        'precio_maximo_dia',
        'volumen_ultimo_dia',
        'valor_ultimo_dia',
        'transacciones_ultimo_dia',
        'precio_minimo_30d',
        'precio_maximo_30d',
        'precio_promedio_30d',
        'dias_sin_negociacion',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $casts = [
        'fecha_ultimo_precio' => 'date',
        'precio_ultimo' => 'decimal:6',
        'precio_anterior' => 'decimal:6',
        'variacion_precio' => 'decimal:6',
        'variacion_porcentaje' => 'decimal:6',
        'precio_minimo_dia' => 'decimal:6',
        'precio_maximo_dia' => 'decimal:6',
        'volumen_ultimo_dia' => 'integer',
        'valor_ultimo_dia' => 'decimal:2',
        'transacciones_ultimo_dia' => 'integer',
        'precio_minimo_30d' => 'decimal:6',
        'precio_maximo_30d' => 'decimal:6',
        'precio_promedio_30d' => 'decimal:6',
        'dias_sin_negociacion' => 'integer'
    ];

    // Relaciones
    public function emisor()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_emisor');
    }
}
