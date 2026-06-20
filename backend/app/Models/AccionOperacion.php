<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccionOperacion extends Model
{
    protected $table = 'accion_operacion';
    protected $primaryKey = 'id_accion_operacion';
    public $timestamps = false;
    public $incrementing = true;

    protected $fillable = [
        'id_inversion',
        'id_instrumento',
        'id_persona',
        'id_tipo_operacion',
        'id_movimiento_capital',
        'fecha_operacion',
        'liquidacion',
        'cantidad',
        'precio_unitario',
        'valor_bruto',
        'comision_bolsa',
        'comision_operador',
        'total_comisiones',
        'valor_neto',
        'costo_promedio_unitario',
        'utilidad_perdida',
        'observacion',
        'activo',
        'eliminado',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $casts = [
        'fecha_operacion' => 'date',
        'cantidad' => 'decimal:6',
        'precio_unitario' => 'decimal:6',
        'valor_bruto' => 'decimal:2',
        'comision_bolsa' => 'decimal:2',
        'comision_operador' => 'decimal:2',
        'total_comisiones' => 'decimal:2',
        'valor_neto' => 'decimal:2',
        'costo_promedio_unitario' => 'decimal:6',
        'utilidad_perdida' => 'decimal:2',
        'activo' => 'boolean',
        'eliminado' => 'boolean'
    ];

    // Relaciones
    public function inversion()
    {
        return $this->belongsTo(Inversion::class, 'id_inversion');
    }

    public function instrumento()
    {
        return $this->belongsTo(Instrumento::class, 'id_instrumento');
    }

    public function persona()
    {
        return $this->belongsTo(Persona::class, 'id_persona');
    }

    public function tipoOperacion()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_tipo_operacion');
    }

    public function movimientoCapital()
    {
        return $this->belongsTo(MovimientoCapital::class, 'id_movimiento_capital');
    }
}
