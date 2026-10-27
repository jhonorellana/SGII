<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\MovimientoCapital;
use App\Listeners\CrearMovimientoCompraInversion;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $movimientos = MovimientoCapital::with(['inversion.instrumento.tipoInversion'])
            ->where('descripcion', 'Compra de inversión')
            ->whereNotNull('id_inversion')
            ->get();

        foreach ($movimientos as $mov) {
            if ($mov->inversion) {
                $nuevaDescripcion = CrearMovimientoCompraInversion::generarDescripcionCompra($mov->inversion);
                $mov->update(['descripcion' => $nuevaDescripcion]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        MovimientoCapital::where('id_tipo_movimiento', 181)
            ->where('descripcion', 'like', 'Compra de %')
            ->update(['descripcion' => 'Compra de inversión']);
    }
};
