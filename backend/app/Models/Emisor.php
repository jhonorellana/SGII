<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Emisor extends Model
{
    protected $table = 'emisor';
    protected $primaryKey = 'id_emisor';
    public $timestamps = false;

    protected $fillable = [
        'nombre',
        'sigla',
        'identificacion',
        'id_tipo_emisor',
        'activo',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    // Relaciones
    public function tipoEmisor()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_tipo_emisor');
    }

    public function instrumentos()
    {
        return $this->hasMany(Instrumento::class, 'id_emisor');
    }

    public function inversiones()
    {
        return $this->hasMany(Inversion::class, 'id_emisor');
    }
}
