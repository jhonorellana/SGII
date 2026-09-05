<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HistoricoIndicador extends Model
{
    use HasFactory;

    protected $table = 'historico_indicadores';
    protected $primaryKey = 'id_historico';

    const CREATED_AT = 'fecha_creacion';
    const UPDATED_AT = 'fecha_actualizacion';

    protected $fillable = [
        'fecha_captura',
        'activo',
        'patrimonio_base',
        'patrimonio_consolidado',
        'proyeccion_1_ano',
        'patrimonio_proyectado_consolidado',
        'intereses_esperados',
        'total_corriente',
        'dividendos_acciones',
        'dividendos_efectivo',
        'plusvalia_acciones',
        'capital_renta_fija',
        'capital_renta_variable',
        'valor_mercado_renta_variable',
        'plusvalia_latente_rv',
        'capital_notas_credito',
        'valor_compra_nc',
        'valor_venta_nc',
        'utilidad_nc'
    ];
}
