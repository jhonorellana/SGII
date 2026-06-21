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
        if (Schema::hasColumn('movimiento_capital', 'id_accion_operacion')) {
            Schema::table('movimiento_capital', function (Blueprint $table) {
                $table->dropColumn('id_accion_operacion');
            });
        }

        Schema::table('movimiento_capital', function (Blueprint $table) {
            $table->integer('id_accion_operacion')->nullable()->after('id_inversion');
            $table->foreign('id_accion_operacion')
                  ->references('id_accion_operacion')
                  ->on('accion_operacion')
                  ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('movimiento_capital', function (Blueprint $table) {
            $table->dropForeign(['id_accion_operacion']);
            $table->dropColumn('id_accion_operacion');
        });
    }
};
