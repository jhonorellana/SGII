<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Persona extends Model
{
    protected $table = 'persona';
    protected $primaryKey = 'id_persona';
    public $timestamps = false;

    protected $fillable = [
        'nombres',
        'apellidos',
        'identificacion',
        'correo',
        'telefono',
        'activo',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    // Relaciones
    public function usuario()
    {
        return $this->hasOne(Usuario::class, 'id_persona');
    }

    public function grupoFamiliarPatriarca()
    {
        return $this->hasOne(GrupoFamiliar::class, 'id_patriarca');
    }

    public function gruposFamiliares()
    {
        return $this->belongsToMany(GrupoFamiliar::class, 'grupo_familiar_persona', 'id_persona', 'id_grupo_familiar')
                    ->withPivot('id_tipo_relacion', 'activo', 'fecha_creacion', 'fecha_actualizacion');
    }

    public function inversionesPropietario()
    {
        return $this->hasMany(Inversion::class, 'id_propietario');
    }

    public function inversionesAportante()
    {
        return $this->hasMany(Inversion::class, 'id_aportante');
    }
}
