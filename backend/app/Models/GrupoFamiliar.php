<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GrupoFamiliar extends Model
{
    protected $table = 'grupo_familiar';
    protected $primaryKey = 'id_grupo_familiar';
    public $timestamps = false;

    protected $fillable = [
        'nombre',
        'descripcion',
        'id_patriarca',
        'activo',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    // Relaciones
    public function patriarca()
    {
        return $this->belongsTo(Persona::class, 'id_patriarca');
    }

    public function personas()
    {
        return $this->belongsToMany(Persona::class, 'grupo_familiar_persona', 'id_grupo_familiar', 'id_persona')
                    ->withPivot('id_tipo_relacion', 'activo', 'fecha_creacion', 'fecha_actualizacion');
    }

    public function inversiones()
    {
        return $this->hasMany(Inversion::class, 'id_grupo_familiar');
    }

    public function otrosValores()
    {
        return $this->hasMany(OtroValor::class, 'id_grupo_familiar');
    }

    public function variacionCapital()
    {
        return $this->hasMany(VariacionCapital::class, 'id_grupo_familiar');
    }
}
