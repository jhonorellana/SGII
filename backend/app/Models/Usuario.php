<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;

class Usuario extends Model
{
    protected $table = 'usuario';
    protected $primaryKey = 'id_usuario';
    public $timestamps = false;

    protected $fillable = [
        'id_rol',
        'id_persona',
        'nombre_usuario',
        'clave_hash',
        'correo',
        'activo',
        'ultimo_acceso',
        'fecha_creacion',
        'fecha_actualizacion'
    ];

    protected $hidden = [
        'clave_hash'
    ];

    // Relaciones
    public function rol()
    {
        return $this->belongsTo(Rol::class, 'id_rol');
    }

    public function persona()
    {
        return $this->belongsTo(Persona::class, 'id_persona');
    }

    // Métodos de autenticación
    public function getAuthPassword()
    {
        return $this->clave_hash;
    }

    public function setClaveAttribute($value)
    {
        $this->attributes['clave_hash'] = Hash::make($value);
    }

    public function checkPassword($password)
    {
        return Hash::check($password, $this->clave_hash);
    }
}
