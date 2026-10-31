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
        Schema::create('amortizacion_pago_historial', function (Blueprint $table) {
            $table->increments('id_pago_historial');
            $table->integer('id_inversion');
            $table->integer('numero_cuota')->nullable();
            $table->integer('id_amortizacion_pagada')->nullable();
            $table->integer('id_amortizacion_restante')->nullable();
            $table->date('fecha_pago');
            $table->decimal('capital_pagado', 18, 2)->default(0);
            $table->decimal('interes_pagado', 18, 2)->default(0);
            $table->decimal('descuento_pagado', 18, 2)->default(0);
            $table->decimal('total_pagado', 18, 2)->default(0);
            $table->decimal('saldo_restante', 18, 2)->default(0);
            $table->date('fecha_compromiso')->nullable();
            $table->string('observacion', 500)->nullable();
            $table->integer('id_usuario')->nullable();
            $table->dateTime('fecha_creacion')->useCurrent();
            $table->dateTime('fecha_actualizacion')->useCurrent();

            $table->index('id_inversion');
            $table->index(['id_inversion', 'numero_cuota']);
            $table->index('id_amortizacion_pagada');
            $table->index('id_amortizacion_restante');

            $table->foreign('id_inversion')->references('id_inversion')->on('inversion')->onDelete('cascade');
            $table->foreign('id_amortizacion_pagada')->references('id_amortizacion')->on('amortizacion')->onDelete('set null');
            $table->foreign('id_amortizacion_restante')->references('id_amortizacion')->on('amortizacion')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('amortizacion_pago_historial');
    }
};

