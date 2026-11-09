<?php

namespace App\Listeners;

use App\Events\InversionCreada;
use App\Models\MovimientoCapital;
use App\Models\OtroValor;
use App\Models\CatalogoValor;
use Illuminate\Support\Facades\DB;

class CrearMovimientoCompraInversion
{
    /**
     * Mapeo institucional de id_persona -> id_tipo_otro_valor (Fondos en Santa Fe Casa de Valores)
     */
    public const MAPEO_PERSONA_SANTA_FE = [
        5 => 142, // SANTA FE ARGENTINA
        2 => 143, // SANTA FE CRISTIAN
        3 => 144, // SANTA FE ISABEL
        1 => 145, // SANTA FE JHON
    ];

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
        if (!$inversion || !$inversion->id_inversion) {
            return;
        }

        // Evitar duplicados si ya existe un movimiento de compra activo para esta inversión
        $yaExiste = MovimientoCapital::where('id_inversion', $inversion->id_inversion)
            ->where('id_tipo_movimiento', 181)
            ->where('eliminado', false)
            ->exists();

        if ($yaExiste) {
            self::sincronizarSaldoSantaFePersona($inversion->id_propietario);
            return;
        }

        // Buscar tipo de movimiento COMPRA_INVERSION (id_catalogo_valor = 181)
        $tipoCompraInversion = CatalogoValor::where('id_catalogo_valor', 181)->first();

        if ($tipoCompraInversion) {
            $tipoNegativo = CatalogoValor::where('codigo', 'NEGATIVO')->first();

            // Obtener la persona dueña de la inversión (id_propietario)
            $idPersona = $inversion->id_propietario;

            // Usar valor_con_interes como monto, o capital_invertido como fallback (para papeles comerciales y notas de crédito)
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

            // Sincronizar automáticamente el saldo de "Fondos en Santa Fe" en la tabla otro_valor
            self::sincronizarSaldoSantaFePersona($idPersona);
        }
    }

    /**
     * Generar descripción para la compra de renta fija (ej: 'Compra de Papel Comercial 2027-04-09' o 'Compra Nota de Crédito')
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
        $idTipo = (int) ($instrumento?->id_tipo_inversion ?? $tipo?->id_catalogo_valor ?? 0);
        $nombreTipo = $tipo?->nombre ?? '';

        // Caso especial: Notas de Crédito (no llevan la fecha referencial 2034-12-31)
        if ($codigo === 'NOTCR' || $idTipo === 91) {
            return 'Compra Nota de Crédito';
        }

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

    /**
     * Recalcula el saldo acumulado en Casa de Valores (movimiento_capital) para una persona
     * y actualiza su registro correspondiente de "Fondos en Santa Fe" en la tabla otro_valor.
     */
    public static function sincronizarSaldoSantaFePersona(?int $idPersona): ?float
    {
        if (!$idPersona || !isset(self::MAPEO_PERSONA_SANTA_FE[$idPersona])) {
            return null;
        }

        $idTipoOtroValor = self::MAPEO_PERSONA_SANTA_FE[$idPersona];

        $saldoResult = DB::selectOne("
            SELECT ROUND(COALESCE(SUM(
                CASE 
                    WHEN mc.id_signo = 190 THEN
                        COALESCE(
                            (SELECT COALESCE(i.valor_con_interes, i.capital_invertido) FROM inversion i WHERE i.id_inversion = mc.id_inversion AND mc.id_tipo_movimiento = 181),
                            mc.monto,
                            0
                        )
                    ELSE
                        -COALESCE(
                            (SELECT COALESCE(i.valor_con_interes, i.capital_invertido) FROM inversion i WHERE i.id_inversion = mc.id_inversion AND mc.id_tipo_movimiento = 181),
                            mc.monto,
                            0
                        )
                END
            ), 0), 2) AS saldo_calculado
            FROM movimiento_capital mc
            WHERE mc.id_persona = ?
              AND mc.eliminado = 0
              AND (mc.id_tipo_movimiento != 213 OR mc.id_tipo_movimiento IS NULL)
        ", [$idPersona]);

        $nuevoSaldo = (float) ($saldoResult->saldo_calculado ?? 0.0);
        if (abs($nuevoSaldo) < 0.005) {
            $nuevoSaldo = 0.0;
        }

        OtroValor::where('id_tipo_otro_valor', $idTipoOtroValor)
            ->where('eliminado', false)
            ->update([
                'valor' => $nuevoSaldo,
                'fecha_actualizacion' => now()
            ]);

        return $nuevoSaldo;
    }
}
