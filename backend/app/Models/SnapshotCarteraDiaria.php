<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SnapshotCarteraDiaria extends Model
{
    use HasFactory;

    protected $table = 'snapshot_cartera_diaria';
    protected $primaryKey = 'id_snapshot';

    protected $fillable = [
        'id_emisor',
        'fecha',
        'cantidad_posicion',
        'costo_promedio',
        'precio_mercado',
        'valor_mercado',
        'pl_no_realizado',
        'porcentaje_no_realizado',
        'sma_5',
        'sma_20',
        'vr',
        'dias_sin_negociacion',
        'alertas'
    ];

    protected $casts = [
        'fecha' => 'date',
        'cantidad_posicion' => 'decimal:6',
        'costo_promedio' => 'decimal:6',
        'precio_mercado' => 'decimal:6',
        'valor_mercado' => 'decimal:6',
        'pl_no_realizado' => 'decimal:6',
        'porcentaje_no_realizado' => 'decimal:2',
        'sma_5' => 'decimal:6',
        'sma_20' => 'decimal:6',
        'vr' => 'decimal:2',
        'dias_sin_negociacion' => 'integer',
        'alertas' => 'array',
    ];

    public function instrumento()
    {
        // Snapshot is per-emisor, but we might want to link it to specific instruments if needed.
        // Usually we link to emisor or a default instrument for the emisor.
        return $this->belongsTo(Instrumento::class, 'id_emisor', 'id_emisor')->where('activo', 1);
    }

    public function emisor()
    {
        return $this->belongsTo(Emisor::class, 'id_emisor');
    }
}
