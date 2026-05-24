<?php

namespace App\Listeners;

use App\Events\VentaInversionRegistrada;
use App\Models\MovimientoCapital;
use App\Models\CatalogoValor;

class CrearMovimientoVentaInversion
{
    /**
     * Create the event listener.
     */
    public function __construct()
    {
        //
    }

    /**
     * Handle the event.
     */
    public function handle(VentaInversionRegistrada $event): void
    {
        $ventaInversion = $event->ventaInversion;

        // Buscar tipo de movimiento VENTA_INVERSION (id_catalogo_valor = 182)
        $tipoVentaInversion = CatalogoValor::where('id_catalogo_valor', 182)->first();

        if ($tipoVentaInversion) {
            $tipoPositivo = CatalogoValor::where('codigo', 'POSITIVO')->first();

            MovimientoCapital::create([
                'fecha_movimiento' => $ventaInversion->fecha_venta,
                'id_tipo_movimiento' => $tipoVentaInversion->id_catalogo_valor,
                'id_signo' => $tipoPositivo ? $tipoPositivo->id_catalogo_valor : 190, // POSITIVO
                'monto' => null, // No se duplica, el valor está en venta_inversion.valor_venta_con_comision
                'id_venta_inversion' => $ventaInversion->id_venta_inversion,
                'id_inversion' => $ventaInversion->id_inversion,
                'descripcion' => 'Venta de inversión',
                'conciliado' => false,
                'activo' => true,
                'eliminado' => false,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);
        }
    }
}
