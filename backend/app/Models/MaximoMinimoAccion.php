<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaximoMinimoAccion extends Model
{
    protected $connection = 'mysql_inversion';
    protected $table = 'maximos_minimos_acciones';

    protected $fillable = [
        'fecha_informacion',
        'fecha_vigencia',
        'es_liquido',
        'sector',
        'emisor',
        'codigo_seb',
        'valor_nominal',
        'precio_cierre',
        'precio_maximo',
        'precio_minimo',
        'num_acc_ult_cierre',
        'fecha_ult_cierre',
        'fecha_ult_negoc',
        'precio_cierre_bvq',
        'num_acc_ult_bvq',
        'fecha_ult_cierre_bvq',
        'archivo_origen',
    ];

    protected $casts = [
        'fecha_informacion' => 'date',
        'fecha_vigencia' => 'date',
        'es_liquido' => 'boolean',
        'valor_nominal' => 'decimal:4',
        'precio_cierre' => 'decimal:4',
        'precio_maximo' => 'decimal:4',
        'precio_minimo' => 'decimal:4',
        'num_acc_ult_cierre' => 'decimal:2',
        'fecha_ult_cierre' => 'date',
        'fecha_ult_negoc' => 'date',
        'precio_cierre_bvq' => 'decimal:4',
        'num_acc_ult_bvq' => 'decimal:2',
        'fecha_ult_cierre_bvq' => 'date',
    ];
}
