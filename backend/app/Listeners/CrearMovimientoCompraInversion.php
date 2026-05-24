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

        // Buscar tipo de movimiento COMPRA_INVERSION (id_catalogo_valor = 181)
        $tipoCompraInversion = CatalogoValor::where('id_catalogo_valor', 181)->first();

        if ($tipoCompraInversion) {
            $tipoNegativo = CatalogoValor::where('codigo', 'NEGATIVO')->first();

            // Obtener la persona dueña de la inversión
            $idPersona = null;
            if ($inversion->id_persona) {
                $idPersona = $inversion->id_persona;
            } elseif ($inversion->cuentaBancaria && $inversion->cuentaBancaria->id_persona) {
                $idPersona = $inversion->cuentaBancaria->id_persona;
            }

            MovimientoCapital::create([
                'fecha_movimiento' => $inversion->fecha_compra,
                'id_tipo_movimiento' => $tipoCompraInversion->id_catalogo_valor,
                'id_persona' => $idPersona,
                'id_signo' => $tipoNegativo ? $tipoNegativo->id_catalogo_valor : 191, // NEGATIVO
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
