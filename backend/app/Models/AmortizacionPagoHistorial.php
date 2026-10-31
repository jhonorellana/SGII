<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AmortizacionPagoHistorial extends Model
{
    protected $table = 'amortizacion_pago_historial';
    protected $primaryKey = 'id_pago_historial';
    public $timestamps = false;
    public $incrementing = true;

    protected $fillable = [
        'id_pago_historial',
        'id_inversion',
        'numero_cuota',
        'id_amortizacion_pagada',
        'id_amortizacion_restante',
        'fecha_pago',
        'capital_pagado',
        'interes_pagado',
        'descuento_pagado',
        'total_pagado',
        'saldo_restante',
        'fecha_compromiso',
        'observacion',
        'id_usuario',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $casts = [
        'capital_pagado' => 'decimal:2',
        'interes_pagado' => 'decimal:2',
        'descuento_pagado' => 'decimal:2',
        'total_pagado' => 'decimal:2',
        'saldo_restante' => 'decimal:2',
        'fecha_pago' => 'date',
        'fecha_compromiso' => 'date',
        'fecha_creacion' => 'datetime',
        'fecha_actualizacion' => 'datetime'
    ];

    public function inversion()
    {
        return $this->belongsTo(Inversion::class, 'id_inversion');
    }

    public function amortizacionPagada()
    {
        return $this->belongsTo(Amortizacion::class, 'id_amortizacion_pagada');
    }

    public function amortizacionRestante()
    {
        return $this->belongsTo(Amortizacion::class, 'id_amortizacion_restante');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'id_usuario');
    }
}

