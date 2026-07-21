<?php

namespace App\Services;

use App\Models\Inversion;

class VentaAgrupadaCalculator
{
    /**
     * Calcular resumen de compra para un conjunto de inversiones
     */
    public function calcularResumenCompra(array $idsInversiones, ?int $idPersonaSeleccionada = null): array
    {
        $inversiones = Inversion::whereIn('id_inversion', $idsInversiones)
            ->where('eliminado', false)
            ->with('propietario')
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
        $inversionesReasignar = [];

        foreach ($inversiones as $inversion) {
            $valorNominal = $inversion->valor_nominal ?? 0;
            $valorCompra = $inversion->capital_invertido ?? 0;
            $porcentajeCompra = $inversion->porcentaje_compra ?? 0;

            $valorNominalTotal += $valorNominal;
            $valorCompraTotal += $valorCompra;

            $detalle = [
                'id_inversion' => $inversion->id_inversion,
                'valor_nominal' => $valorNominal,
                'valor_compra' => $valorCompra,
                'porcentaje_compra' => $porcentajeCompra,
                'fecha_compra' => $inversion->fecha_compra,
                'instrumento' => $inversion->instrumento->nombre ?? '-',
                'propietario_nombre' => $inversion->propietario ? $inversion->propietario->nombre : '-',
                'id_propietario' => $inversion->id_propietario
            ];

            // Detectar si necesita reasignación
            if ($idPersonaSeleccionada && $inversion->id_propietario != $idPersonaSeleccionada) {
                $detalle['requiere_reasignacion'] = true;
                $detalle['id_propietario_anterior'] = $inversion->id_propietario;
                $detalle['id_propietario_nuevo'] = $idPersonaSeleccionada;
                $inversionesReasignar[] = $detalle;
            } else {
                $detalle['requiere_reasignacion'] = false;
            }

            $detalles[] = $detalle;
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
                'detalles' => $detalles,
                'inversiones_reasignar' => $inversionesReasignar
            ]
        ];
    }

    /**
     * Calcular distribución de venta para un conjunto de inversiones
     */
    public function calcularDistribucionVenta(array $idsInversiones, float $precio, float $valorTotalRecibido, float $comisionOperador = 0, float $comisionBolsa = 0, ?int $idPersonaSeleccionada = null): array
    {
        $resumenCompra = $this->calcularResumenCompra($idsInversiones, $idPersonaSeleccionada);

        if (!$resumenCompra['success']) {
            return $resumenCompra;
        }

        $data = $resumenCompra['data'];
        $valorCompraTotal = $data['valor_compra_total'];
        $valorNominalTotal = $data['valor_nominal_total'];

        // Calcular valor de venta total (Valor Efectivo)
        $valorVentaTotal = 0;
        if ($precio > 0) {
            $valorVentaTotal = ($valorNominalTotal * $precio / 100);
        } elseif ($valorTotalRecibido > 0) {
            $valorVentaTotal = $valorTotalRecibido;
        }

        // Calcular comisiones
        $totalComisiones = $comisionOperador + $comisionBolsa;

        // Valor neto recibido (Valor Total Recibido)
        $valorNetoRecibido = $valorVentaTotal - $totalComisiones;

        // Calcular utilidad total
        $utilidadTotal = $valorNetoRecibido - $valorCompraTotal;

        // Calcular ROI total
        $roiTotal = $valorCompraTotal > 0 ? ($utilidadTotal / $valorCompraTotal) * 100 : 0;

        // Distribuir proporcionalmente
        $detallesDistribucion = [];
        $maxDiasTranscurridos = 0;
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

            // Ganancia Anual individual
            $diasTranscurridos = $this->calcularDiasTranscurridos($detalle['fecha_compra'] ?? null);
            $gananciaAnualIndividual = $diasTranscurridos > 0
                ? ($rendimientoIndividual * 365 / $diasTranscurridos)
                : 0;
            
            if ($diasTranscurridos > $maxDiasTranscurridos) {
                $maxDiasTranscurridos = $diasTranscurridos;
            }

            $detallesDistribucion[] = [
                'id_inversion' => $detalle['id_inversion'],
                'propietario_nombre' => $detalle['propietario_nombre'],
                'valor_nominal' => $detalle['valor_nominal'],
                'valor_compra' => $detalle['valor_compra'],
                'porcentaje_compra' => $detalle['porcentaje_compra'],
                'valor_venta_asignado' => $valorVentaAsignado,
                'porcentaje_venta' => $porcentajeVentaIndividual,
                'utilidad' => $utilidadIndividual,
                'rendimiento' => $rendimientoIndividual,
                'ganancia_anual' => $gananciaAnualIndividual,
                'proporcion' => $proporcion * 100,
                'requiere_reasignacion' => $detalle['requiere_reasignacion'] ?? false,
                'id_propietario_anterior' => $detalle['id_propietario_anterior'] ?? null,
                'id_propietario_nuevo' => $detalle['id_propietario_nuevo'] ?? null
            ];
        }

        $gananciaAnualTotal = $maxDiasTranscurridos > 0 ? ($roiTotal * 365 / $maxDiasTranscurridos) : 0;

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
                'ganancia_anual_total' => $gananciaAnualTotal,
                'detalles_distribucion' => $detallesDistribucion,
                'inversiones_reasignar' => $data['inversiones_reasignar'] ?? []
            ]
        ];
    }

    /**
     * Previsualizar venta agrupada
     */
    public function previsualizarVenta(array $idsInversiones, ?float $precio, ?float $valorTotalRecibido, float $comisionOperador = 0, float $comisionBolsa = 0, ?int $idPersonaSeleccionada = null): array
    {
        // Validar que se proporcione precio o valor_total_recibido
        if (!$precio && !$valorTotalRecibido) {
            return [
                'success' => false,
                'message' => 'Debe proporcionar precio o valor_total_recibido'
            ];
        }

        return $this->calcularDistribucionVenta($idsInversiones, $precio ?? 0, $valorTotalRecibido ?? 0, $comisionOperador, $comisionBolsa, $idPersonaSeleccionada);
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
