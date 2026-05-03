<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Amortizacion extends Model
{
    protected $table = 'amortizacion';
    protected $primaryKey = 'id_amortizacion';
    public $timestamps = false;

    protected $fillable = [
        'id_inversion',
        'numero_cuota',
        'fecha_pago',
        'interes',
        'capital',
        'descuento',
        'total',
        'int_parcial',
        'retencion',
        'id_estado_amortizacion',
        'pagada',
        'activo',
        'eliminado',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $casts = [
        'interes' => 'decimal:2',
        'capital' => 'decimal:2',
        'descuento' => 'decimal:2',
        'total' => 'decimal:2',
        'int_parcial' => 'decimal:2',
        'retencion' => 'decimal:2',
        'fecha_pago' => 'date',
        'pagada' => 'boolean',
        'activo' => 'boolean',
        'eliminado' => 'boolean'
    ];

    // Relaciones
    public function inversion()
    {
        return $this->belongsTo(Inversion::class, 'id_inversion');
    }

    public function estadoAmortizacion()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_estado_amortizacion');
    }
}
