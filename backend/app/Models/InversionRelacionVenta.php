<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InversionRelacionVenta extends Model
{
    protected $table = 'inversion_relacion_venta';
    protected $primaryKey = 'id_inversion_relacion_venta';
    public $timestamps = false;
    public $incrementing = true;

    protected $fillable = [
        'id_inversion_relacion_venta',
        'id_inversion_original',
        'id_inversion_generada',
        'id_venta_inversion',
        'id_tipo_relacion',
        'porcentaje_asignado',
        'valor_nominal_asignado',
        'observacion',
        'activo',
        'eliminado',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $casts = [
        'porcentaje_asignado' => 'decimal:4',
        'valor_nominal_asignado' => 'decimal:2',
        'activo' => 'boolean',
        'eliminado' => 'boolean'
    ];

    // Relaciones
    public function inversionOriginal()
    {
        return $this->belongsTo(Inversion::class, 'id_inversion_original');
    }

    public function inversionGenerada()
    {
        return $this->belongsTo(Inversion::class, 'id_inversion_generada');
    }

    public function ventaInversion()
    {
        return $this->belongsTo(VentaInversion::class, 'id_venta_inversion');
    }

    public function tipoRelacion()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_tipo_relacion');
    }
}
