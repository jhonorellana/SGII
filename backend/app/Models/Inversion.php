<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inversion extends Model
{
    protected $table = 'inversion';
    protected $primaryKey = 'id_inversion';
    public $timestamps = false;

    protected $fillable = [
        'id_grupo_familiar',
        'id_instrumento',
        'id_propietario',
        'id_aportante',
        'liquidacion',
        'id_estado_inversion',
        'fecha_compra',
        'fecha_venta',
        'valor_nominal',
        'monto_a_negociar',
        'capital_invertido',
        'tasa_interes',
        'rendimiento_nominal',
        'rendimiento_efectivo',
        'valor_efectivo',
        'valor_sin_comision',
        'valor_con_interes',
        'interes_acumulado_previo',
        'interes_mensual',
        'interes_primer_mes',
        'total_comisiones',
        'tasa_mensual_real',
        'fecha_primer_pago',
        'precio_compra',
        'precio_neto_compra',
        'comision_bolsa',
        'comision_casa_valores',
        'retencion_fuente',
        'observacion',
        'expirado',
        'activo',
        'eliminado',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $casts = [
        'valor_nominal' => 'decimal:2',
        'monto_a_negociar' => 'decimal:2',
        'capital_invertido' => 'decimal:2',
        'tasa_interes' => 'decimal:8',
        'rendimiento_nominal' => 'decimal:8',
        'rendimiento_efectivo' => 'decimal:8',
        'valor_efectivo' => 'decimal:2',
        'valor_sin_comision' => 'decimal:2',
        'valor_con_interes' => 'decimal:2',
        'interes_acumulado_previo' => 'decimal:2',
        'interes_mensual' => 'decimal:2',
        'interes_primer_mes' => 'decimal:2',
        'total_comisiones' => 'decimal:2',
        'tasa_mensual_real' => 'decimal:2',
        'precio_compra' => 'decimal:8',
        'precio_neto_compra' => 'decimal:8',
        'comision_bolsa' => 'decimal:2',
        'comision_casa_valores' => 'decimal:2',
        'retencion_fuente' => 'decimal:2',
        'fecha_compra' => 'date',
        'fecha_venta' => 'date',
        'fecha_primer_pago' => 'date',
        'expirado' => 'boolean',
        'activo' => 'boolean',
        'eliminado' => 'boolean'
    ];

    // Relaciones
    public function grupoFamiliar()
    {
        return $this->belongsTo(GrupoFamiliar::class, 'id_grupo_familiar');
    }

    public function instrumento()
    {
        return $this->belongsTo(Instrumento::class, 'id_instrumento');
    }

    public function estadoInversion()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_estado_inversion');
    }

    public function propietario()
    {
        return $this->belongsTo(Persona::class, 'id_propietario');
    }

    public function aportante()
    {
        return $this->belongsTo(Persona::class, 'id_aportante');
    }

    public function amortizaciones()
    {
        return $this->hasMany(Amortizacion::class, 'id_inversion');
    }

    public function ventas()
    {
        return $this->hasMany(VentaInversion::class, 'id_inversion');
    }

    public function documentos()
    {
        return $this->hasMany(DocumentoInversion::class, 'id_inversion');
    }
}
