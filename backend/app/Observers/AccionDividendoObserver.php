<?php

namespace App\Observers;

use App\Models\AccionDividendo;
use App\Models\AccionOperacion;
use App\Models\MovimientoCapital;

class AccionDividendoObserver
{
    /**
     * Handle the AccionDividendo "created" event.
     */
    public function created(AccionDividendo $dividendo): void
    {
        $tipoDiv = (int)$dividendo->id_tipo_dividendo;

        // 1. Si hay parte en efectivo (Efectivo 209 o Mixto 211), generar MovimientoCapital
        if (($tipoDiv === 209 || $tipoDiv === 211) && $dividendo->valor_neto > 0) {
            $movimiento = new MovimientoCapital();
            $movimiento->fecha_movimiento = $dividendo->fecha_pago;
            $movimiento->id_persona = $dividendo->id_persona;
            $movimiento->id_tipo_movimiento = 213; // DIVIDENDO
            $movimiento->id_signo = 190; // POSITIVO
            $movimiento->monto = $dividendo->valor_neto;
            $movimiento->id_cuenta_bancaria = $dividendo->id_cuenta_bancaria;
            $movimiento->descripcion = "[Acciones] Cobro de dividendo en efectivo - " . $dividendo->observacion;
            $movimiento->conciliado = false;
            $movimiento->activo = true;
            $movimiento->eliminado = false;
            $movimiento->fecha_creacion = now();
            $movimiento->fecha_actualizacion = now();
            $movimiento->save();

            // Guardar relacion de vuelta
            $dividendo->id_movimiento_capital = $movimiento->id_movimiento_capital;
            $dividendo->saveQuietly();
        }

        // 2. Si hay parte en acciones (Acciones 210 o Mixto 211), generar AccionOperacion (tipo 206 - BONIF_ACCIONES)
        if (($tipoDiv === 210 || $tipoDiv === 211) && $dividendo->acciones_recibidas > 0) {
            $operacion = new AccionOperacion();
            $operacion->id_instrumento = $dividendo->id_instrumento;
            $operacion->id_persona = $dividendo->id_persona;
            $operacion->id_tipo_operacion = 206; // BONIF_ACCIONES
            $operacion->fecha_operacion = $dividendo->fecha_pago;
            $operacion->cantidad = $dividendo->acciones_recibidas;
            $operacion->precio_unitario = $dividendo->precio_referencial_accion ?? 0.00;
            $operacion->valor_bruto = $dividendo->valor_referencial_acciones ?? 0.00;
            $operacion->comision_bolsa = 0.00;
            $operacion->comision_operador = 0.00;
            $operacion->total_comisiones = 0.00;
            $operacion->valor_neto = $dividendo->valor_referencial_acciones ?? 0.00;
            $operacion->costo_promedio_unitario = 0.00; // Recibidas gratis
            $operacion->utilidad_perdida = 0.00;
            $operacion->observacion = "[Acciones] Ingreso por dividendo en acciones - Ref. dividendo ID " . $dividendo->id_accion_dividendo;
            $operacion->activo = true;
            $operacion->eliminado = false;
            $operacion->fecha_creacion = now();
            $operacion->fecha_actualizacion = now();
            $operacion->save();
        }
    }

    /**
     * Handle the AccionDividendo "updated" event.
     */
    public function updated(AccionDividendo $dividendo): void
    {
        $tipoDiv = (int)$dividendo->id_tipo_dividendo;

        // 1. Actualizar MovimientoCapital si existe
        if ($dividendo->id_movimiento_capital) {
            $movimiento = MovimientoCapital::find($dividendo->id_movimiento_capital);
            if ($movimiento) {
                // Si cambió a un tipo no financiero o el valor neto es 0, desactivar
                if (($tipoDiv !== 209 && $tipoDiv !== 211) || $dividendo->valor_neto <= 0) {
                    $movimiento->update([
                        'activo' => false,
                        'eliminado' => true,
                        'fecha_actualizacion' => now()
                    ]);
                } else {
                    $movimiento->fecha_movimiento = $dividendo->fecha_pago;
                    $movimiento->id_persona = $dividendo->id_persona;
                    $movimiento->monto = $dividendo->valor_neto;
                    $movimiento->id_cuenta_bancaria = $dividendo->id_cuenta_bancaria;
                    $movimiento->descripcion = "[Acciones] Cobro de dividendo en efectivo - " . $dividendo->observacion;
                    $movimiento->activo = $dividendo->activo;
                    $movimiento->eliminado = $dividendo->eliminado;
                    $movimiento->fecha_actualizacion = now();
                    $movimiento->save();
                }
            }
        } elseif (($tipoDiv === 209 || $tipoDiv === 211) && $dividendo->valor_neto > 0 && $dividendo->activo && !$dividendo->eliminado) {
            // Si antes no tenía movimiento pero ahora sí califica, crearlo
            $movimiento = new MovimientoCapital();
            $movimiento->fecha_movimiento = $dividendo->fecha_pago;
            $movimiento->id_persona = $dividendo->id_persona;
            $movimiento->id_tipo_movimiento = 213; // DIVIDENDO
            $movimiento->id_signo = 190; // POSITIVO
            $movimiento->monto = $dividendo->valor_neto;
            $movimiento->id_cuenta_bancaria = $dividendo->id_cuenta_bancaria;
            $movimiento->descripcion = "[Acciones] Cobro de dividendo en efectivo - " . $dividendo->observacion;
            $movimiento->conciliado = false;
            $movimiento->activo = true;
            $movimiento->eliminado = false;
            $movimiento->fecha_creacion = now();
            $movimiento->fecha_actualizacion = now();
            $movimiento->save();

            $dividendo->id_movimiento_capital = $movimiento->id_movimiento_capital;
            $dividendo->saveQuietly();
        }

        // 2. Actualizar o crear Operacion de Acciones si existe
        $operacion = AccionOperacion::where('id_tipo_operacion', 206)
            ->where('observacion', 'like', '%Ref. dividendo ID ' . $dividendo->id_accion_dividendo)
            ->first();

        if ($operacion) {
            // Si cambió a tipo efectivo o acciones es 0, inactivar la operación
            if (($tipoDiv !== 210 && $tipoDiv !== 211) || $dividendo->acciones_recibidas <= 0) {
                $operacion->update([
                    'activo' => false,
                    'eliminado' => true,
                    'fecha_actualizacion' => now()
                ]);
            } else {
                $operacion->id_instrumento = $dividendo->id_instrumento;
                $operacion->id_persona = $dividendo->id_persona;
                $operacion->fecha_operacion = $dividendo->fecha_pago;
                $operacion->cantidad = $dividendo->acciones_recibidas;
                $operacion->precio_unitario = $dividendo->precio_referencial_accion ?? 0.00;
                $operacion->valor_bruto = $dividendo->valor_referencial_acciones ?? 0.00;
                $operacion->valor_neto = $dividendo->valor_referencial_acciones ?? 0.00;
                $operacion->activo = $dividendo->activo;
                $operacion->eliminado = $dividendo->eliminado;
                $operacion->fecha_actualizacion = now();
                $operacion->save();
            }
        } elseif (($tipoDiv === 210 || $tipoDiv === 211) && $dividendo->acciones_recibidas > 0 && $dividendo->activo && !$dividendo->eliminado) {
            // Si antes no tenía operación pero ahora sí, crearla
            $operacion = new AccionOperacion();
            $operacion->id_instrumento = $dividendo->id_instrumento;
            $operacion->id_persona = $dividendo->id_persona;
            $operacion->id_tipo_operacion = 206; // BONIF_ACCIONES
            $operacion->fecha_operacion = $dividendo->fecha_pago;
            $operacion->cantidad = $dividendo->acciones_recibidas;
            $operacion->precio_unitario = $dividendo->precio_referencial_accion ?? 0.00;
            $operacion->valor_bruto = $dividendo->valor_referencial_acciones ?? 0.00;
            $operacion->comision_bolsa = 0.00;
            $operacion->comision_operador = 0.00;
            $operacion->total_comisiones = 0.00;
            $operacion->valor_neto = $dividendo->valor_referencial_acciones ?? 0.00;
            $operacion->costo_promedio_unitario = 0.00;
            $operacion->utilidad_perdida = 0.00;
            $operacion->observacion = "[Acciones] Ingreso por dividendo en acciones - Ref. dividendo ID " . $dividendo->id_accion_dividendo;
            $operacion->activo = true;
            $operacion->eliminado = false;
            $operacion->fecha_creacion = now();
            $operacion->fecha_actualizacion = now();
            $operacion->save();
        }
    }

    /**
     * Handle the AccionDividendo "deleted" event.
     */
    public function deleted(AccionDividendo $dividendo): void
    {
        // 1. Eliminar MovimientoCapital
        if ($dividendo->id_movimiento_capital) {
            $movimiento = MovimientoCapital::find($dividendo->id_movimiento_capital);
            if ($movimiento) {
                $movimiento->update([
                    'activo' => false,
                    'eliminado' => true,
                    'fecha_actualizacion' => now()
                ]);
            }
        }

        // 2. Eliminar AccionOperacion de bonificación asociada
        $operacion = AccionOperacion::where('id_tipo_operacion', 206)
            ->where('observacion', 'like', '%Ref. dividendo ID ' . $dividendo->id_accion_dividendo)
            ->first();

        if ($operacion) {
            $operacion->update([
                'activo' => false,
                'eliminado' => true,
                'fecha_actualizacion' => now()
            ]);
        }
    }
}
