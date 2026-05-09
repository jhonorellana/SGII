<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OtroValor extends Model
{
    use HasFactory;

    protected $table = 'otro_valor';

    protected $primaryKey = 'id_otro_valor';

    protected $fillable = [
        'id_grupo_familiar',
        'id_propietario',
        'id_tipo_otro_valor',
        'descripcion',
        'valor',
        'fecha_desde',
        'fecha_hasta',
        'activo',
        'eliminado'
    ];

    protected $casts = [
        'valor' => 'decimal:2',
        'fecha_desde' => 'date',
        'fecha_hasta' => 'date',
        'activo' => 'boolean',
        'eliminado' => 'boolean',
        'fecha_creacion' => 'datetime',
        'fecha_actualizacion' => 'datetime'
    ];

    public $timestamps = false;

    // Relaciones
    public function grupoFamiliar()
    {
        return $this->belongsTo(GrupoFamiliar::class, 'id_grupo_familiar');
    }

    public function propietario()
    {
        return $this->belongsTo(Persona::class, 'id_propietario');
    }

    public function tipoValor()
    {
        return $this->belongsTo(CatalogoValor::class, 'id_tipo_otro_valor');
    }

    // Scopes
    public function scopeActivos($query)
    {
        return $query->where('activo', 1)->where('eliminado', 0);
    }

    public function scopeVigentes($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('fecha_desde')
              ->orWhere('fecha_desde', '<=', now());
        })->where(function ($q) {
            $q->whereNull('fecha_hasta')
              ->orWhere('fecha_hasta', '>=', now());
        });
    }

    public function scopeDelGrupo($query, $idGrupo)
    {
        return $query->where('id_grupo_familiar', $idGrupo);
    }

    public function scopeDelPropietario($query, $idPropietario)
    {
        return $query->where('id_propietario', $idPropietario);
    }

    public function scopeDelTipo($query, $idTipo)
    {
        return $query->where('id_tipo_otro_valor', $idTipo);
    }

    // Accessors
    public function getValorFormateadoAttribute()
    {
        return number_format($this->valor, 2, ',', '.');
    }

    public function getTipoNombreAttribute()
    {
        return $this->tipoValor ? $this->tipoValor->nombre : 'N/A';
    }

    public function getPropietarioNombreAttribute()
    {
        return $this->propietario ? $this->propietario->nombre_completo : 'Sin asignar';
    }

    public function getGrupoFamiliarNombreAttribute()
    {
        return $this->grupoFamiliar ? $this->grupoFamiliar->nombre : 'Sin grupo';
    }

    // Métodos
    public function esActivo(): bool
    {
        return $this->activo && !$this->eliminado;
    }

    public function esVigente(): bool
    {
        $hoy = now();

        $desdeValido = is_null($this->fecha_desde) || $this->fecha_desde <= $hoy;
        $hastaValido = is_null($this->fecha_hasta) || $this->fecha_hasta >= $hoy;

        return $desdeValido && $hastaValido;
    }

    public function esPositivo(): bool
    {
        return $this->valor > 0;
    }

    public function esNegativo(): bool
    {
        return $this->valor < 0;
    }

    public function getTipoClaseCss(): string
    {
        if ($this->esPositivo()) {
            return 'text-green-600';
        } elseif ($this->esNegativo()) {
            return 'text-red-600';
        }
        return 'text-gray-600';
    }
}
