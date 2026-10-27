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

            // Obtener la persona dueña de la inversión (id_propietario)
            $idPersona = $inversion->id_propietario;

            // Usar valor_con_interes como monto, o capital_invertido como fallback (para papeles comerciales u otros)
            $monto = $inversion->valor_con_interes ?? $inversion->capital_invertido ?? 0;

            // Generar descripción según el tipo de instrumento y fecha de vencimiento
            $descripcion = self::generarDescripcionCompra($inversion);

            MovimientoCapital::create([
                'fecha_movimiento' => $inversion->fecha_compra,
                'id_tipo_movimiento' => $tipoCompraInversion->id_catalogo_valor,
                'id_persona' => $idPersona,
                'id_signo' => $tipoNegativo ? $tipoNegativo->id_catalogo_valor : 191, // NEGATIVO
                'monto' => $monto,
                'id_inversion' => $inversion->id_inversion,
                'descripcion' => $descripcion,
                'conciliado' => false,
                'activo' => true,
                'eliminado' => false,
                'fecha_creacion' => now(),
                'fecha_actualizacion' => now()
            ]);
        }
    }

    /**
     * Generar descripción para la compra de renta fija (ej: 'Compra de Bono 2030-12-08')
     */
    public static function generarDescripcionCompra($inversion): string
    {
        if (!$inversion) {
            return 'Compra de inversión';
        }

        $inversion->loadMissing(['instrumento.tipoInversion']);
        $instrumento = $inversion->instrumento;
        $tipo = $instrumento?->tipoInversion;

        $codigo = strtoupper($tipo?->codigo ?? '');
        $nombreTipo = $tipo?->nombre ?? '';

        switch ($codigo) {
            case 'BONO':
                $tipoStr = 'Bono';
                break;
            case 'OBLI':
                $tipoStr = 'Obligación';
                break;
            case 'PAPEL':
                $tipoStr = 'Papel Comercial';
                break;
            case 'CERT':
                $tipoStr = 'Certificado de Inversión';
                break;
            case 'FACT':
                $tipoStr = 'Factura Comercial';
                break;
            case 'TIT':
                $tipoStr = 'Titularización';
                break;
            case 'NOTCR':
                $tipoStr = 'Nota de Crédito';
                break;
            case 'ACPI':
            case 'ACNPI':
                $tipoStr = 'Acciones';
                break;
            default:
                $tipoStr = !empty($nombreTipo) ? $nombreTipo : 'inversión';
                break;
        }

        $fechaVenc = null;
        if ($instrumento?->fecha_vencimiento) {
            $fechaVenc = \Carbon\Carbon::parse($instrumento->fecha_vencimiento)->format('Y-m-d');
        }

        if ($fechaVenc) {
            return "Compra de {$tipoStr} {$fechaVenc}";
        }

        return "Compra de {$tipoStr}";
    }
}
