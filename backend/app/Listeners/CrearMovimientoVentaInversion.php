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

        // Buscar tipo de movimiento VENTA_INVERSION
        $tipoVentaInversion = CatalogoValor::where('codigo', 'TPIJ')->first(); // VENTA_INVERSION

        if ($tipoVentaInversion) {
            MovimientoCapital::create([
                'fecha_movimiento' => $ventaInversion->fecha_venta,
                'id_tipo_movimiento' => $tipoVentaInversion->id_catalogo_valor,
                'signo' => '+', // Signo positivo para ventas
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
