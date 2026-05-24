<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MovimientoCapital extends Model
{
    protected $table = 'movimiento_capital';
    protected $primaryKey = 'id_movimiento_capital';
    public $timestamps = false;
    public $incrementing = true;

    protected $fillable = [
        'id_movimiento_capital',
        'fecha_movimiento',
        'id_tipo_movimiento',
        'id_persona',
        'id_signo',
        'monto',
        'id_inversion',
        'id_venta_inversion',
        'id_cuenta_bancaria',
        'descripcion',
        'conciliado',
        'fecha_conciliacion',
        'activo',
        'eliminado',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $casts = [
        'fecha_movimiento' => 'date',
        'monto' => 'decimal:2',
        'conciliado' => 'boolean',
        'fecha_conciliacion' => 'date',
        'activo' => 'boolean',
        'eliminado' => 'boolean'
    ];

    // Relaciones
    public function persona()
    {
        return $this->belongsTo(Persona::class, 'id_persona');
    }

    public function inversion()
    {
        return $this->belongsTo(Inversion::class, 'id_inversion');
    }

    public function ventaInversion()
    {
        return $this->belongsTo(VentaInversion::class, 'id_venta_inversion');
    }

    public function cuentaBancaria()
    {
        return $this->belongsTo(CuentaBancaria::class, 'id_cuenta_bancaria');
    }

    public function tipoMovimiento()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_tipo_movimiento');
    }

    public function signoCatalogo()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_signo');
    }
}
