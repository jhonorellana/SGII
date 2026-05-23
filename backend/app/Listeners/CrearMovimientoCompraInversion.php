<?php

namespace App\Listeners;

use App\Events\InversionCreada;
use App\Models\MovimientoCapital;
use App\Models\CatalogoValor;

class CrearMovimientoCompraInversion
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
    public function handle(InversionCreada $event): void
    {
        $inversion = $event->inversion;

        // Buscar tipo de movimiento COMPRA_INVERSION
        $tipoCompraInversion = CatalogoValor::where('codigo', 'TPAJ')->first(); // COMPRA_INVERSION

        if ($tipoCompraInversion) {
            MovimientoCapital::create([
                'fecha_movimiento' => $inversion->fecha_compra,
                'id_tipo_movimiento' => $tipoCompraInversion->id_catalogo_valor,
                'signo' => '-', // Signo negativo para compras
                'monto' => null, // No se duplica, el valor está en inversion.capital_invertido
                'id_inversion' => $inversion->id_inversion,
                'descripcion' => 'Compra de inversión',
                'conciliado' => false,
                'activo' => true,
                'eliminado' => false,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);
        }
    }
}
