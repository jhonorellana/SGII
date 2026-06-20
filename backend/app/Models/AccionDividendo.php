<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccionDividendo extends Model
{
    protected $table = 'accion_dividendo';
    protected $primaryKey = 'id_accion_dividendo';
    public $timestamps = false;
    public $incrementing = true;

    protected $fillable = [
        'id_persona',
        'id_instrumento',
        'id_tipo_dividendo',
        'fecha_declaracion',
        'fecha_corte',
        'fecha_pago',
        'cantidad_acciones_base',
        'dividendo_por_accion',
        'valor_bruto',
        'retencion',
        'valor_neto',
        'acciones_recibidas',
        'factor_acciones',
        'precio_referencial_accion',
        'valor_referencial_acciones',
        'id_cuenta_bancaria',
        'id_movimiento_capital',
        'observacion',
        'activo',
        'eliminado',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $casts = [
        'fecha_declaracion' => 'date',
        'fecha_corte' => 'date',
        'fecha_pago' => 'date',
        'cantidad_acciones_base' => 'decimal:6',
        'dividendo_por_accion' => 'decimal:6',
        'valor_bruto' => 'decimal:2',
        'retencion' => 'decimal:2',
        'valor_neto' => 'decimal:2',
        'acciones_recibidas' => 'decimal:6',
        'factor_acciones' => 'decimal:6',
        'precio_referencial_accion' => 'decimal:6',
        'valor_referencial_acciones' => 'decimal:2',
        'activo' => 'boolean',
        'eliminado' => 'boolean'
    ];

    // Relaciones
    public function persona()
    {
        return $this->belongsTo(Persona::class, 'id_persona');
    }

    public function instrumento()
    {
        return $this->belongsTo(Instrumento::class, 'id_instrumento');
    }

    public function tipoDividendo()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_tipo_dividendo');
    }

    public function cuentaBancaria()
    {
        return $this->belongsTo(CuentaBancaria::class, 'id_cuenta_bancaria');
    }

    public function movimientoCapital()
    {
        return $this->belongsTo(MovimientoCapital::class, 'id_movimiento_capital');
    }
}
