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

        // 1. Tabla vector_precio_diario (Matriz de valoración de títulos de Renta Fija)
        if (!$schema->hasTable('vector_precio_diario')) {
            $schema->create('vector_precio_diario', function (Blueprint $table) {
                $table->id();
                $table->date('fecha_vector')->index();
                $table->string('codigo_titulo_vector', 35)->index(); // Guardado con prefijo 'a' (ej. a685010100001310917)
                $table->string('nemo_emisor', 50)->nullable()->index();
                $table->string('nombre_emisor', 255)->nullable();
                $table->string('clase_titulo', 100)->nullable()->index(); // OBLIGACIONES, PAPEL COMERCIAL, TITULARIZACION, BONOS
                $table->string('calificacion_riesgo', 20)->nullable()->index();
                $table->decimal('precio_porcentaje', 12, 6)->default(100.000000); // ej. 100.237091%
                $table->decimal('tasa_descuento_tir', 10, 6)->default(0.000000); // ej. 6.150042%
                $table->decimal('tasa_cupon', 10, 6)->default(0.000000); // ej. 6.250000%
                $table->integer('plazo_dias_remanentes')->default(0)->index();
                $table->date('fecha_emision')->nullable();
                $table->date('fecha_vencimiento')->nullable();
                $table->string('forma_reajuste', 150)->nullable();
                $table->timestamps();

                $table->unique(['fecha_vector', 'codigo_titulo_vector'], 'vector_fecha_codigo_unique');
            });
        }

        // 2. Tabla vector_curva_rendimiento (Puntos de la curva cupón cero)
        if (!$schema->hasTable('vector_curva_rendimiento')) {
            $schema->create('vector_curva_rendimiento', function (Blueprint $table) {
                $table->id();
                $table->date('fecha_vector')->index();
                $table->integer('plazo_dias')->index();
                $table->decimal('tasa_tir', 10, 6)->default(0.000000);
                $table->timestamps();

                $table->unique(['fecha_vector', 'plazo_dias'], 'curva_fecha_plazo_unique');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $schema = Schema::connection('mysql_inversion');
        $schema->dropIfExists('vector_curva_rendimiento');
        $schema->dropIfExists('vector_precio_diario');
    }
};
