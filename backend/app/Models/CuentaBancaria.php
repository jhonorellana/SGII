<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CuentaBancaria extends Model
{
    protected $table = 'cuenta_bancaria';
    protected $primaryKey = 'id_cuenta_bancaria';
    public $timestamps = false;
    public $incrementing = true;

    protected $fillable = [
        'id_cuenta_bancaria',
        'id_persona',
        'id_banco',
        'id_tipo_cuenta',
        'numero_cuenta',
        'activo',
        'eliminado',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $casts = [
        'activo' => 'boolean',
        'eliminado' => 'boolean'
    ];

    // Relaciones
    public function persona()
    {
        return $this->belongsTo(Persona::class, 'id_persona');
    }

    public function banco()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_banco');
    }

    public function tipoCuenta()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_tipo_cuenta');
    }

    public function movimientosCapital()
    {
        return $this->hasMany(MovimientoCapital::class, 'id_cuenta_bancaria');
    }
}
