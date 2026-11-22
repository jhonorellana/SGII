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
        $schema = Schema::connection('mysql_inversion');

        if (!$schema->hasTable('maximos_minimos_acciones')) {
            $schema->create('maximos_minimos_acciones', function (Blueprint $table) {
                $table->id();
                $table->date('fecha_informacion')->index();
                $table->date('fecha_vigencia')->nullable()->index();
                $table->boolean('es_liquido')->default(false)->index();
                $table->string('sector', 50)->nullable()->index();
                $table->string('emisor', 255)->index();
                $table->string('codigo_seb', 30)->index();
                $table->decimal('valor_nominal', 14, 4)->default(0);
                $table->decimal('precio_cierre', 14, 4)->nullable();
                $table->decimal('precio_maximo', 14, 4)->nullable();
                $table->decimal('precio_minimo', 14, 4)->nullable();
                $table->decimal('num_acc_ult_cierre', 18, 2)->nullable();
                $table->date('fecha_ult_cierre')->nullable();
                $table->date('fecha_ult_negoc')->nullable();
                $table->decimal('precio_cierre_bvq', 14, 4)->nullable();
                $table->decimal('num_acc_ult_bvq', 18, 2)->nullable();
                $table->date('fecha_ult_cierre_bvq')->nullable();
                $table->string('archivo_origen', 255)->nullable();
                $table->timestamps();

                $table->unique(['fecha_informacion', 'codigo_seb'], 'maxmin_fecha_codigo_unique');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $schema = Schema::connection('mysql_inversion');
        $schema->dropIfExists('maximos_minimos_acciones');
    }
};
