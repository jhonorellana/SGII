<?php

namespace App\Services;

use App\Models\Inversion;
use App\Models\VentaInversion;
use App\Models\InversionRelacionVenta;
use App\Models\Amortizacion;
use App\Models\MovimientoCapital;
use App\Models\CatalogoValor;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class VentaInversionService
{
    /**
     * Calcular datos financieros de una venta
     */
    public function calcularDatosVenta(array $datos): array
    {
        // Implementar cálculos financieros
        // Utilidad, ROI, rendimiento, etc.
        return $datos;
    }

    /**
     * Procesar venta total de una inversión
     */
    public function procesarVentaTotal(int $idInversion, array $datosVenta): array
    {
        return DB::transaction(function () use ($idInversion, $datosVenta) {
            $inversion = Inversion::findOrFail($idInversion);

            // Paso 1: Actualizar inversión
            $inversion->update([
                'fecha_venta' => $datosVenta['fecha_venta'],
                'id_estado_inversion' => $this->getEstadoVendidaTotal(),
                'activo' => false,
                'fecha_actualizacion' => now()
            ]);

            // Paso 2: Inactivar amortizaciones futuras
            $this->inactivarAmortizacionesFuturas($idInversion, $datosVenta['fecha_venta'], 227);

            // Paso 3: Crear registro en venta_inversion
            $venta = VentaInversion::create($datosVenta);

            // Paso 4: Crear movimiento de capital
            $this->crearMovimientoCapitalVenta($venta->id_venta_inversion, $inversion->id_propietario, $idInversion, $datosVenta['valor_venta_con_comision'], $datosVenta['fecha_venta']);

            return [
                'success' => true,
                'message' => 'Venta total procesada exitosamente',
                'venta' => $venta
            ];
        });
    }

    /**
     * Procesar venta total de todas las inversiones de un instrumento
     */
    public function procesarVentaTotalInstrumento(int $idInstrumento, array $datosVenta): array
    {
        return DB::transaction(function () use ($idInstrumento, $datosVenta) {
            $inversiones = Inversion::where('id_instrumento', $idInstrumento)
                ->where('activo', true)
                ->where('eliminado', false)
                ->get();

            $ventas = [];

            foreach ($inversiones as $inversion) {
                $datosVentaInversion = array_merge($datosVenta, [
                    'id_inversion' => $inversion->id_inversion,
                    'id_propietario' => $inversion->id_propietario
                ]);

                $resultado = $this->procesarVentaTotal($inversion->id_inversion, $datosVentaInversion);
                if (!$resultado['success']) {
                    throw new \Exception("Error al procesar inversión {$inversion->id_inversion}: {$resultado['message']}");
                }

                $ventas[] = $resultado['venta'];
            }

            return [
                'success' => true,
                'message' => 'Venta total de instrumento procesada exitosamente',
                'ventas' => $ventas
            ];
        });
    }

    /**
     * Procesar venta parcial de una inversión
     */
    public function procesarVentaParcial(int $idInversion, array $datosVenta, float $porcentajeVendido): array
    {
        return DB::transaction(function () use ($idInversion, $datosVenta, $porcentajeVendido) {
            $inversionOriginal = Inversion::findOrFail($idInversion);
            $porcentajeRemanente = 100 - $porcentajeVendido;

            // Paso 1: Cerrar inversión original
            $inversionOriginal->update([
                'fecha_venta' => $datosVenta['fecha_venta'],
                'id_estado_inversion' => $this->getEstadoVendidaTotal(),
                'activo' => false,
                'fecha_actualizacion' => now()
            ]);

            // Paso 2: Inactivar amortizaciones futuras
            $this->inactivarAmortizacionesFuturas($idInversion, $datosVenta['fecha_venta'], 200);

            // Paso 3: Crear inversión PARTE_VENDIDA
            $inversionVendida = $this->crearInversionDerivada(
                $inversionOriginal,
                $porcentajeVendido,
                $this->getTipoRelacionParteVendida(),
                false // No requiere amortización
            );

            // Paso 4: Crear inversión PARTE_REMANENTE
            $inversionRemanente = $this->crearInversionDerivada(
                $inversionOriginal,
                $porcentajeRemanente,
                $this->getTipoRelacionParteRemanente(),
                true // Requiere amortización
            );

            // Paso 5: Crear nueva amortización para la inversión remanente
            $this->crearAmortizacionRemanente($inversionOriginal->id_inversion, $inversionRemanente->id_inversion, $porcentajeRemanente);

            // Paso 6: Crear registro en venta_inversion
            $datosVenta['id_inversion'] = $inversionVendida->id_inversion;
            $venta = VentaInversion::create($datosVenta);

            // Paso 7: Crear movimiento de capital (solo parte vendida)
            $this->crearMovimientoCapitalVenta(
                $venta->id_venta_inversion,
                $inversionOriginal->id_propietario,
                $inversionVendida->id_inversion,
                $datosVenta['valor_venta_con_comision'],
                $datosVenta['fecha_venta']
            );

            // Paso 8: Crear registros en inversion_relacion_venta
            $this->crearRelacionesVenta(
                $inversionOriginal->id_inversion,
                $inversionVendida->id_inversion,
                $inversionRemanente->id_inversion,
                $venta->id_venta_inversion,
                $porcentajeVendido,
                $porcentajeRemanente
            );

            return [
                'success' => true,
                'message' => 'Venta parcial procesada exitosamente',
                'venta' => $venta,
                'inversion_vendida' => $inversionVendida,
                'inversion_remanente' => $inversionRemanente
            ];
        });
    }

    /**
     * Procesar venta parcial de múltiples inversiones (ordenadas por rendimiento)
     */
    public function procesarVentaParcialInstrumento(int $idInstrumento, array $datosVenta, float $montoAVender): array
    {
        return DB::transaction(function () use ($idInstrumento, $datosVenta, $montoAVender) {
            // Obtener inversiones activas ordenadas por rendimiento (menor a mayor)
            $inversiones = Inversion::where('id_instrumento', $idInstrumento)
                ->where('activo', true)
                ->where('eliminado', false)
                ->orderBy('rendimiento_efectivo', 'asc')
                ->get();

            $montoRestante = $montoAVender;
            $ventas = [];
            $valorNominalTotal = $inversiones->sum('valor_nominal');

            foreach ($inversiones as $inversion) {
                if ($montoRestante <= 0) {
                    break;
                }

                $valorNominalInversion = $inversion->valor_nominal ?? 0;
                $porcentajeAVender = min(($montoRestante / $valorNominalTotal) * 100, ($montoRestante / $valorNominalInversion) * 100);

                if ($porcentajeAVender >= 100) {
                    // Venta total de esta inversión
                    $datosVentaInversion = array_merge($datosVenta, [
                        'id_inversion' => $inversion->id_inversion,
                        'id_propietario' => $inversion->id_propietario,
                        'porcentaje_vendido' => 100
                    ]);

                    $resultado = $this->procesarVentaTotal($inversion->id_inversion, $datosVentaInversion);
                    $montoRestante -= $valorNominalInversion;
                } else {
                    // Venta parcial de esta inversión
                    $datosVentaInversion = array_merge($datosVenta, [
                        'id_inversion' => $inversion->id_inversion,
                        'id_propietario' => $inversion->id_propietario,
                        'porcentaje_vendido' => $porcentajeAVender
                    ]);

                    $resultado = $this->procesarVentaParcial($inversion->id_inversion, $datosVentaInversion, $porcentajeAVender);
                    $montoRestante -= ($valorNominalInversion * $porcentajeAVender / 100);
                }

                if (!$resultado['success']) {
                    throw new \Exception("Error al procesar inversión {$inversion->id_inversion}: {$resultado['message']}");
                }

                $ventas[] = $resultado['venta'];
            }

            return [
                'success' => true,
                'message' => 'Venta parcial de instrumento procesada exitosamente',
                'ventas' => $ventas
            ];
        });
    }

    /**
     * Crear inversión derivada (PARTE_VENDIDA o PARTE_REMANENTE)
     */
    protected function crearInversionDerivada(Inversion $inversionOriginal, float $porcentaje, int $idTipoRelacion, bool $requiereAmortizacion): Inversion
    {
        $datosDerivada = $this->recalcularFinancieroProporcional($inversionOriginal, $porcentaje);

        $datosDerivada['id_estado_inversion'] = $idTipoRelacion === $this->getTipoRelacionParteVendida()
            ? $this->getEstadoVendidaTotal()
            : $this->getEstadoActiva();

        $datosDerivada['activo'] = $idTipoRelacion === $this->getTipoRelacionParteRemanente();
        $datosDerivada['fecha_compra'] = $inversionOriginal->fecha_compra; // Conservar fecha de compra original
        $datosDerivada['fecha_creacion'] = now();
        $datosDerivada['fecha_actualizacion'] = now();

        return Inversion::create($datosDerivada);
    }

    /**
     * Recalcular financieramente proporcionalmente
     */
    protected function recalcularFinancieroProporcional(Inversion $inversion, float $porcentaje): array
    {
        $factor = $porcentaje / 100;

        return [
            'id_grupo_familiar' => $inversion->id_grupo_familiar,
            'id_instrumento' => $inversion->id_instrumento,
            'id_propietario' => $inversion->id_propietario,
            'id_aportante' => $inversion->id_aportante,
            'liquidacion' => $inversion->liquidacion,
            'valor_nominal' => round($inversion->valor_nominal * $factor, 2),
            'monto_a_negociar' => round($inversion->monto_a_negociar * $factor, 2),
            'capital_invertido' => round($inversion->capital_invertido * $factor, 2),
            'tasa_interes' => $inversion->tasa_interes,
            'rendimiento_nominal' => $inversion->rendimiento_nominal,
            'rendimiento_efectivo' => $inversion->rendimiento_efectivo,
            'valor_efectivo' => round($inversion->valor_efectivo * $factor, 2),
            'valor_sin_comision' => round($inversion->valor_sin_comision * $factor, 2),
            'valor_con_interes' => round($inversion->valor_con_interes * $factor, 2),
            'interes_acumulado_previo' => round($inversion->interes_acumulado_previo * $factor, 2),
            'interes_mensual' => round($inversion->interes_mensual * $factor, 2),
            'interes_primer_mes' => round($inversion->interes_primer_mes * $factor, 2),
            'total_comisiones' => round($inversion->total_comisiones * $factor, 2),
            'tasa_mensual_real' => $inversion->tasa_mensual_real,
            'fecha_primer_pago' => $inversion->fecha_primer_pago,
            'precio_compra' => $inversion->precio_compra,
            'precio_neto_compra' => $inversion->precio_neto_compra,
            'comision_bolsa' => round($inversion->comision_bolsa * $factor, 2),
            'comision_casa_valores' => round($inversion->comision_casa_valores * $factor, 2),
            'retencion_fuente' => round($inversion->retencion_fuente * $factor, 2),
            'observacion' => $inversion->observacion,
            'expirado' => $inversion->expirado,
            'eliminado' => false
        ];
    }

    /**
     * Inactivar amortizaciones futuras
     */
    protected function inactivarAmortizacionesFuturas(int $idInversion, string $fechaVenta, int $estadoTarget): void
    {
        Amortizacion::where('id_inversion', $idInversion)
            ->where('fecha_pago', '>=', $fechaVenta)
            ->update([
                'id_estado_amortizacion' => $estadoTarget,
                'fecha_actualizacion' => now()
            ]);
    }

    /**
     * Crear amortización para inversión remanente
     */
    protected function crearAmortizacionRemanente(int $idInversionOriginal, int $idInversionRemanente, float $porcentajeRemanente): void
    {
        $amortizacionesOriginales = Amortizacion::where('id_inversion', $idInversionOriginal)
            ->whereNotIn('id_estado_amortizacion', [137, 200, 227]) // Solo cuotas válidas
            ->where('eliminado', false)
            ->get();

        foreach ($amortizacionesOriginales as $amortizacionOriginal) {
            $factor = $porcentajeRemanente / 100;

            Amortizacion::create([
                'id_inversion' => $idInversionRemanente,
                'numero_cuota' => $amortizacionOriginal->numero_cuota,
                'fecha_pago' => $amortizacionOriginal->fecha_pago,
                'interes' => round($amortizacionOriginal->interes * $factor, 2),
                'capital' => round($amortizacionOriginal->capital * $factor, 2),
                'descuento' => round($amortizacionOriginal->descuento * $factor, 2),
                'total' => round($amortizacionOriginal->total * $factor, 2),
                'int_parcial' => round($amortizacionOriginal->int_parcial * $factor, 2),
                'retencion' => round($amortizacionOriginal->retencion * $factor, 2),
                'id_estado_amortizacion' => 134, // Pendiente de pago
                'eliminado' => false,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);
        }
    }

    /**
     * Crear movimiento de capital para venta
     */
    protected function crearMovimientoCapitalVenta(int $idVentaInversion, int $idPersona, int $idInversion, float $monto, string $fechaMovimiento): void
    {
        MovimientoCapital::create([
            'id_tipo_movimiento' => 182, // Tipo movimiento venta
            'id_persona' => $idPersona,
            'id_inversion' => $idInversion,
            'id_venta_inversion' => $idVentaInversion,
            'id_cuenta_bancaria' => null,
            'id_signo' => 190, // Positivo
            'monto' => $monto,
            'fecha_movimiento' => $fechaMovimiento,
            'descripcion' => 'Venta de inversión',
            'conciliado' => false,
            'fecha_conciliacion' => null,
            'activo' => true,
            'eliminado' => false,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);
    }

    /**
     * Crear relaciones en inversion_relacion_venta
     */
    protected function crearRelacionesVenta(int $idInversionOriginal, int $idInversionVendida, int $idInversionRemanente, int $idVentaInversion, float $porcentajeVendido, float $porcentajeRemanente): void
    {
        // Relación PARTE_VENDIDA
        InversionRelacionVenta::create([
            'id_inversion_original' => $idInversionOriginal,
            'id_inversion_generada' => $idInversionVendida,
            'id_venta_inversion' => $idVentaInversion,
            'id_tipo_relacion' => $this->getTipoRelacionParteVendida(),
            'porcentaje_asignado' => $porcentajeVendido,
            'valor_nominal_asignado' => 0, // Se calcula al crear la inversión
            'observacion' => 'Parte vendida de la inversión original',
            'activo' => true,
            'eliminado' => false,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);

        // Relación PARTE_REMANENTE
        InversionRelacionVenta::create([
            'id_inversion_original' => $idInversionOriginal,
            'id_inversion_generada' => $idInversionRemanente,
            'id_venta_inversion' => $idVentaInversion,
            'id_tipo_relacion' => $this->getTipoRelacionParteRemanente(),
            'porcentaje_asignado' => $porcentajeRemanente,
            'valor_nominal_asignado' => 0, // Se calcula al crear la inversión
            'observacion' => 'Parte remanente de la inversión original',
            'activo' => true,
            'eliminado' => false,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);
    }

    // Helpers para obtener IDs del catálogo
    protected function getEstadoVendidaTotal(): int
    {
        return CatalogoValor::where('codigo', 'VENDIDA_TOTAL')->value('id_catalogo_valor') ?? 0;
    }

    protected function getEstadoActiva(): int
    {
        return CatalogoValor::where('codigo', 'ACTIVA')->value('id_catalogo_valor') ?? 0;
    }

    protected function getTipoRelacionParteVendida(): int
    {
        return CatalogoValor::where('codigo', 'PARTE_VEND')->value('id_catalogo_valor') ?? 0;
    }

    protected function getTipoRelacionParteRemanente(): int
    {
        return CatalogoValor::where('codigo', 'PARTE_RESTANTE')->value('id_catalogo_valor') ?? 0;
    }
}
