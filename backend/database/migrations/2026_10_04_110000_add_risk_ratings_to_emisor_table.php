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
        Schema::table('emisor', function (Blueprint $table) {
            if (!Schema::hasColumn('emisor', 'calificacion_riesgo')) {
                $table->string('calificacion_riesgo', 10)->nullable()->after('identificacion');
            }
            if (!Schema::hasColumn('emisor', 'calificadora_riesgo')) {
                $table->string('calificadora_riesgo', 150)->nullable()->after('calificacion_riesgo');
            }
            if (!Schema::hasColumn('emisor', 'fecha_ultima_calificacion')) {
                $table->date('fecha_ultima_calificacion')->nullable()->after('calificadora_riesgo');
            }
            if (!Schema::hasColumn('emisor', 'patrimonio_tecnico_sbs')) {
                $table->decimal('patrimonio_tecnico_sbs', 12, 4)->nullable()->after('fecha_ultima_calificacion');
            }
            if (!Schema::hasColumn('emisor', 'valor_nominal')) {
                $table->decimal('valor_nominal', 10, 2)->nullable()->default(1.00)->after('patrimonio_tecnico_sbs');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('emisor', function (Blueprint $table) {
            $columns = [
                'calificacion_riesgo',
                'calificadora_riesgo',
                'fecha_ultima_calificacion',
                'patrimonio_tecnico_sbs',
                'valor_nominal'
            ];
            foreach ($columns as $col) {
                if (Schema::hasColumn('emisor', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
