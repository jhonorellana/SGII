<?php

namespace App\Services;

use App\Models\Inversion;

class VentaAgrupadaCalculator
{
    /**
     * Calcular resumen de compra para un conjunto de inversiones
     */
    public function calcularResumenCompra(array $idsInversiones): array
    {
        $inversiones = Inversion::whereIn('id_inversion', $idsInversiones)
            ->where('activo', true)
            ->where('eliminado', false)
            ->get();

        if ($inversiones->count() === 0) {
            return [
                'success' => false,
                'message' => 'No se encontraron inversiones válidas'
            ];
        }

        $valorNominalTotal = 0;
        $valorCompraTotal = 0;
        $porcentajeCompraPromedio = 0;
        $detalles = [];

        foreach ($inversiones as $inversion) {
            $valorNominal = $inversion->valor_nominal ?? 0;
            $valorCompra = $inversion->capital_invertido ?? 0;
            $porcentajeCompra = $inversion->porcentaje_compra ?? 0;

            $valorNominalTotal += $valorNominal;
            $valorCompraTotal += $valorCompra;

            $detalles[] = [
                'id_inversion' => $inversion->id_inversion,
                'valor_nominal' => $valorNominal,
                'valor_compra' => $valorCompra,
                'porcentaje_compra' => $porcentajeCompra,
                'fecha_compra' => $inversion->fecha_compra,
                'instrumento' => $inversion->instrumento->nombre ?? '-'
            ];
        }

        if ($valorNominalTotal > 0) {
            $porcentajeCompraPromedio = ($valorCompraTotal / $valorNominalTotal) * 100;
        }

        return [
            'success' => true,
            'data' => [
                'inversiones_count' => $inversiones->count(),
                'valor_nominal_total' => $valorNominalTotal,
                'valor_compra_total' => $valorCompraTotal,
                'porcentaje_compra_promedio' => $porcentajeCompraPromedio,
                'detalles' => $detalles
            ]
        ];
    }

    /**
     * Calcular distribución de venta para un conjunto de inversiones
     */
    public function calcularDistribucionVenta(array $idsInversiones, float $porcentajeVenta, float $valorTotalRecibido, float $comisionOperador = 0, float $comisionBolsa = 0): array
    {
        $resumenCompra = $this->calcularResumenCompra($idsInversiones);

        if (!$resumenCompra['success']) {
            return $resumenCompra;
        }

        $data = $resumenCompra['data'];
        $valorCompraTotal = $data['valor_compra_total'];
        $valorNominalTotal = $data['valor_nominal_total'];

        // Calcular valor de venta total
        $valorVentaTotal = 0;
        if ($porcentajeVenta > 0) {
            $valorVentaTotal = ($valorNominalTotal * $porcentajeVenta / 100);
        } elseif ($valorTotalRecibido > 0) {
            $valorVentaTotal = $valorTotalRecibido;
        }

        // Calcular comisiones
        $totalComisiones = $comisionOperador + $comisionBolsa;

        // Valor neto recibido
        $valorNetoRecibido = $valorVentaTotal - $totalComisiones;

        // Calcular utilidad total
        $utilidadTotal = $valorNetoRecibido - $valorCompraTotal;

        // Calcular ROI total
        $roiTotal = $valorCompraTotal > 0 ? ($utilidadTotal / $valorCompraTotal) * 100 : 0;

        // Distribuir proporcionalmente
        $detallesDistribucion = [];
        foreach ($data['detalles'] as $detalle) {
            $proporcion = $valorCompraTotal > 0 
                ? ($detalle['valor_compra'] / $valorCompraTotal) 
                : 0;

            // Valor de venta asignado
            $valorVentaAsignado = $valorNetoRecibido * $proporcion;

            // Utilidad individual
            $utilidadIndividual = $valorVentaAsignado - $detalle['valor_compra'];

            // Rendimiento individual (ROI)
            $rendimientoIndividual = $detalle['valor_compra'] > 0 
                ? ($utilidadIndividual / $detalle['valor_compra']) * 100 
                : 0;

            // Porcentaje de venta individual
            $porcentajeVentaIndividual = $detalle['valor_nominal'] > 0
                ? ($valorVentaAsignado / $detalle['valor_nominal']) * 100
                : 0;

            $detallesDistribucion[] = [
                'id_inversion' => $detalle['id_inversion'],
                'valor_nominal' => $detalle['valor_nominal'],
                'valor_compra' => $detalle['valor_compra'],
                'porcentaje_compra' => $detalle['porcentaje_compra'],
                'valor_venta_asignado' => $valorVentaAsignado,
                'porcentaje_venta' => $porcentajeVentaIndividual,
                'utilidad' => $utilidadIndividual,
                'rendimiento' => $rendimientoIndividual,
                'proporcion' => $proporcion * 100
            ];
        }

        return [
            'success' => true,
            'data' => [
                'resumen_compra' => $data,
                'valor_venta_total' => $valorVentaTotal,
                'comision_operador' => $comisionOperador,
                'comision_bolsa' => $comisionBolsa,
                'total_comisiones' => $totalComisiones,
                'valor_neto_recibido' => $valorNetoRecibido,
                'utilidad_total' => $utilidadTotal,
                'roi_total' => $roiTotal,
                'detalles_distribucion' => $detallesDistribucion
            ]
        ];
    }

    /**
     * Previsualizar venta agrupada
     */
    public function previsualizarVenta(array $idsInversiones, ?float $porcentajeVenta, ?float $valorTotalRecibido, float $comisionOperador = 0, float $comisionBolsa = 0): array
    {
        // Validar que se proporcione porcentaje_venta o valor_total_recibido
        if (!$porcentajeVenta && !$valorTotalRecibido) {
            return [
                'success' => false,
                'message' => 'Debe proporcionar porcentaje_venta o valor_total_recibido'
            ];
        }

        return $this->calcularDistribucionVenta($idsInversiones, $porcentajeVenta ?? 0, $valorTotalRecibido ?? 0, $comisionOperador, $comisionBolsa);
    }

    /**
     * Calcular utilidad esperada por inversión
     */
    public function calcularUtilidadIndividual(float $valorCompra, float $valorVenta): array
    {
        $utilidad = $valorVenta - $valorCompra;
        $roi = $valorCompra > 0 ? ($utilidad / $valorCompra) * 100 : 0;

        return [
            'utilidad' => $utilidad,
            'roi' => $roi,
            'porcentaje_rentabilidad' => $roi
        ];
    }

    /**
     * Calcular días transcurridos entre fechas
     */
    public function calcularDiasTranscurridos(?string $fechaCompra, ?string $fechaVenta = null): int
    {
        if (!$fechaCompra) {
            return 0;
        }

        $fechaInicio = \Carbon\Carbon::parse($fechaCompra);
        $fechaFin = $fechaVenta ? \Carbon\Carbon::parse($fechaVenta) : \Carbon\Carbon::now();

        return $fechaInicio->diffInDays($fechaFin);
    }

    /**
     * Calcular ganancia anualizada
     */
    public function calcularGananciaAnual(float $utilidad, int $diasTranscurridos): float
    {
        if ($diasTranscurridos <= 0) {
            return 0;
        }

        return ($utilidad / $diasTranscurridos) * 365;
    }
}
