<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Catalogo extends Model
{
    protected $table = 'catalogo';
    protected $primaryKey = 'id_catalogo';
    public $timestamps = false;

    protected $fillable = [
        'codigo',
        'nombre',
        'descripcion',
        'activo',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    // Relaciones
    public function valores()
    {
        return $this->hasMany(CatalogoValor::class, 'id_catalogo');
    }
}
