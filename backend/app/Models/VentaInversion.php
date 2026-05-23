<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VentaInversion extends Model
{
    protected $table = 'venta_inversion';
    protected $primaryKey = 'id_venta_inversion';
    public $timestamps = false;
    public $incrementing = true;

    protected $fillable = [
        'id_venta_inversion',
        'id_inversion',
        'id_instrumento',
        'id_tipo_venta',
        'porcentaje_vendido',
        'fecha_venta',
        'liquidacion_venta',
        'precio_venta',
        'precio_neto_venta',
        'interes_previo_venta',
        'valor_venta_sin_comision',
        'comision_operador',
        'comision_bolsa',
        'valor_venta_con_comision',
        'utilidad_sin_comision',
        'utilidad_con_comision',
        'ganancia_perdida',
        'rendimiento_total',
        'dias_transcurridos',
        'roi',
        'ganancia_anual',
        'comisiones_santa_fe',
        'retenciones',
        'observacion',
        'activo',
        'eliminado',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $casts = [
        'porcentaje_vendido' => 'decimal:2',
        'fecha_venta' => 'date',
        'precio_venta' => 'decimal:8',
        'precio_neto_venta' => 'decimal:8',
        'interes_previo_venta' => 'decimal:2',
        'valor_venta_sin_comision' => 'decimal:2',
        'comision_operador' => 'decimal:2',
        'comision_bolsa' => 'decimal:2',
        'valor_venta_con_comision' => 'decimal:2',
        'utilidad_sin_comision' => 'decimal:2',
        'utilidad_con_comision' => 'decimal:2',
        'ganancia_perdida' => 'decimal:2',
        'rendimiento_total' => 'decimal:2',
        'dias_transcurridos' => 'decimal:2',
        'roi' => 'decimal:2',
        'ganancia_anual' => 'decimal:2',
        'comisiones_santa_fe' => 'decimal:2',
        'retenciones' => 'decimal:2',
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

    public function tipoVenta()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_tipo_venta');
    }

    public function movimientosCapital()
    {
        return $this->hasMany(MovimientoCapital::class, 'id_venta_inversion');
    }
}
