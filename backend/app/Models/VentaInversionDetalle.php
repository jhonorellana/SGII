<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VentaInversionDetalle extends Model
{
    protected $table = 'venta_inversion_detalle';
    protected $primaryKey = 'id_venta_inversion_detalle';
    public $timestamps = false;
    public $incrementing = true;

    protected $fillable = [
        'id_venta_inversion_detalle',
        'id_venta_inversion',
        'id_inversion',
        'valor_nominal',
        'valor_compra',
        'porcentaje_compra',
        'valor_venta_asignado',
        'porcentaje_venta',
        'utilidad',
        'rendimiento',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $casts = [
        'valor_nominal' => 'decimal:2',
        'valor_compra' => 'decimal:2',
        'porcentaje_compra' => 'decimal:8',
        'valor_venta_asignado' => 'decimal:2',
        'porcentaje_venta' => 'decimal:8',
        'utilidad' => 'decimal:2',
        'rendimiento' => 'decimal:8',
        'fecha_creacion' => 'datetime',
        'fecha_actualizacion' => 'datetime'
    ];

    // Relaciones
    public function ventaInversion()
    {
        return $this->belongsTo(VentaInversion::class, 'id_venta_inversion');
    }

    public function inversion()
    {
        return $this->belongsTo(Inversion::class, 'id_inversion');
    }
}
