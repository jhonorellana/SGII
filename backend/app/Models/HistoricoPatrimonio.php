<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HistoricoPatrimonio extends Model
{
    use HasFactory;

    protected $table = 'historico_patrimonio';

    protected $primaryKey = 'id_historico_patrimonio';

    protected $fillable = [
        'fecha',
        'capital_jaime',
        'capital_argentina',
        'capital_cristian',
        'capital_total',
        'capital_propio',
        'capital_importacion',
        'capital_total_propio'
    ];

    protected $casts = [
        'fecha' => 'date:Y-m-d',
        'capital_jaime' => 'decimal:2',
        'capital_argentina' => 'decimal:2',
        'capital_cristian' => 'decimal:2',
        'capital_total' => 'decimal:2',
        'capital_propio' => 'decimal:2',
        'capital_importacion' => 'decimal:2',
        'capital_total_propio' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];
}
