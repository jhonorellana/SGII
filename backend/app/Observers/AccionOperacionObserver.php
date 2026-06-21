<?php

namespace App\Observers;

use App\Models\AccionOperacion;
use App\Models\MovimientoCapital;

class AccionOperacionObserver
{
    /**
     * Handle the AccionOperacion "created" event.
     */
    public function created(AccionOperacion $operacion): void
    {
        $tipoOp = (int)$operacion->id_tipo_operacion;
        if ($tipoOp === 204 || $tipoOp === 205) {
            $movimiento = new MovimientoCapital();
            $movimiento->fecha_movimiento = $operacion->fecha_operacion;
            $movimiento->id_persona = $operacion->id_persona;
            
            if ($tipoOp === 204) {
                $movimiento->id_tipo_movimiento = 181; // COM_INV
                $movimiento->id_signo = 191; // NEGATIVO
                $movimiento->descripcion = "[Acciones] Compra de acciones - Liq. " . $operacion->liquidacion;
            } else {
                $movimiento->id_tipo_movimiento = 182; // VEN_INV
                $movimiento->id_signo = 190; // POSITIVO
                $movimiento->descripcion = "[Acciones] Venta de acciones - Liq. " . $operacion->liquidacion;
            }

            $movimiento->monto = $operacion->valor_neto;
            $movimiento->id_inversion = $operacion->id_inversion;
            $movimiento->id_accion_operacion = $operacion->id_accion_operacion;
            $movimiento->conciliado = false;
            $movimiento->activo = true;
            $movimiento->eliminado = false;
            $movimiento->fecha_creacion = now();
            $movimiento->fecha_actualizacion = now();
            $movimiento->save();

            // Guardar relacion de vuelta sin disparar eventos
            $operacion->id_movimiento_capital = $movimiento->id_movimiento_capital;
            $operacion->saveQuietly();
        }
    }

    /**
     * Handle the AccionOperacion "updated" event.
     */
    public function updated(AccionOperacion $operacion): void
    {
        $tipoOp = (int)$operacion->id_tipo_operacion;
        if (($tipoOp === 204 || $tipoOp === 205) && $operacion->id_movimiento_capital) {
            $movimiento = MovimientoCapital::find($operacion->id_movimiento_capital);
            if ($movimiento) {
                $movimiento->fecha_movimiento = $operacion->fecha_operacion;
                $movimiento->id_persona = $operacion->id_persona;
                $movimiento->monto = $operacion->valor_neto;
                $movimiento->id_inversion = $operacion->id_inversion;
                $movimiento->id_accion_operacion = $operacion->id_accion_operacion;
                
                if ($tipoOp === 204) {
                    $movimiento->id_tipo_movimiento = 181; // COM_INV
                    $movimiento->id_signo = 191; // NEGATIVO
                    $movimiento->descripcion = "[Acciones] Compra de acciones - Liq. " . $operacion->liquidacion;
                } else {
                    $movimiento->id_tipo_movimiento = 182; // VEN_INV
                    $movimiento->id_signo = 190; // POSITIVO
                    $movimiento->descripcion = "[Acciones] Venta de acciones - Liq. " . $operacion->liquidacion;
                }

                $movimiento->activo = $operacion->activo;
                $movimiento->eliminado = $operacion->eliminado;
                $movimiento->fecha_actualizacion = now();
                $movimiento->save();
            }
        }
    }

    /**
     * Handle the AccionOperacion "deleted" event.
     */
    public function deleted(AccionOperacion $operacion): void
    {
        if ($operacion->id_movimiento_capital) {
            $movimiento = MovimientoCapital::find($operacion->id_movimiento_capital);
            if ($movimiento) {
                $movimiento->update([
                    'activo' => false,
                    'eliminado' => true,
                    'fecha_actualizacion' => now()
                ]);
            }
        }
    }
}
