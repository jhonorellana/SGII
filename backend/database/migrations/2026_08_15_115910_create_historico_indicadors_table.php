<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('historico_indicadores', function (Blueprint $table) {
            $table->id('id_historico');
            $table->date('fecha_captura');
            $table->decimal('patrimonio_base', 15, 2)->default(0);
            $table->decimal('patrimonio_consolidado', 15, 2)->default(0);
            $table->decimal('proyeccion_1_ano', 15, 2)->default(0);
            $table->decimal('intereses_esperados', 15, 2)->default(0);
            $table->decimal('total_corriente', 15, 2)->default(0);
            $table->decimal('dividendos_acciones', 15, 2)->default(0);
            $table->decimal('plusvalia_acciones', 15, 2)->default(0);
            $table->decimal('capital_renta_fija', 15, 2)->default(0);
            $table->decimal('capital_renta_variable', 15, 2)->default(0);
            $table->decimal('capital_notas_credito', 15, 2)->default(0);
            $table->decimal('valor_compra_nc', 15, 2)->default(0);
            $table->decimal('valor_venta_nc', 15, 2)->default(0);
            $table->decimal('utilidad_nc', 15, 2)->default(0);
            
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamp('fecha_actualizacion')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('historico_indicadores');
    }
};
