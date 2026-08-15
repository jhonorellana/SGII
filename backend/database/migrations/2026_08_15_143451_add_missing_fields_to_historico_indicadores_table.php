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
        Schema::table('historico_indicadores', function (Blueprint $table) {
            $table->decimal('patrimonio_proyectado_consolidado', 15, 2)->default(0)->after('proyeccion_1_ano');
            $table->decimal('dividendos_efectivo', 15, 2)->default(0)->after('dividendos_acciones');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('historico_indicadores', function (Blueprint $table) {
            $table->dropColumn(['patrimonio_proyectado_consolidado', 'dividendos_efectivo']);
        });
    }
};
