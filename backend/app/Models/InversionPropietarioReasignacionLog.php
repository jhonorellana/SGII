<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InversionPropietarioReasignacionLog extends Model
{
    use HasFactory;

    protected $table = 'inversion_propietario_reasignacion_log';

    protected $primaryKey = 'id_reasignacion_log';

    public $timestamps = false;

    protected $fillable = [
        'id_inversion',
        'id_venta_inversion',
        'id_propietario_anterior',
        'id_propietario_nuevo',
        'motivo',
        'observacion',
        'usuario_reasignacion',
        'fecha_reasignacion'
    ];

    protected $casts = [
        'fecha_reasignacion' => 'datetime'
    ];

    public function inversion()
    {
        return $this->belongsTo(Inversion::class, 'id_inversion');
    }

    public function ventaInversion()
    {
        return $this->belongsTo(VentaInversion::class, 'id_venta_inversion');
    }

    public function propietarioAnterior()
    {
        return $this->belongsTo(Persona::class, 'id_propietario_anterior');
    }

    public function propietarioNuevo()
    {
        return $this->belongsTo(Persona::class, 'id_propietario_nuevo');
    }
}
