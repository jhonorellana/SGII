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
            $table->decimal('valor_mercado_renta_variable', 15, 2)->default(0)->after('capital_renta_variable');
            $table->decimal('plusvalia_latente_rv', 15, 2)->default(0)->after('valor_mercado_renta_variable');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('historico_indicadores', function (Blueprint $table) {
            $table->dropColumn(['valor_mercado_renta_variable', 'plusvalia_latente_rv']);
        });
    }
};
