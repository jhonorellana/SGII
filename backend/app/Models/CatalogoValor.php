<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CatalogoValor extends Model
{
    protected $table = 'catalogo_valor';
    protected $primaryKey = 'id_catalogo_valor';
    public $timestamps = false;

    protected $fillable = [
        'id_catalogo',
        'codigo',
        'nombre',
        'descripcion',
        'orden_visual',
        'activo',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    // Relaciones
    public function catalogo()
    {
        return $this->belongsTo(Catalogo::class, 'id_catalogo');
    }
}
