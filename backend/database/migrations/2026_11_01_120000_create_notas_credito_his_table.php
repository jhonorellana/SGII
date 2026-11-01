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

        if (!$schema->hasTable('notas_credito_his')) {
            $schema->create('notas_credito_his', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->date('FECHA')->index('idx_nc_fecha');
                $table->string('TITULO', 60)->index('idx_nc_titulo');
                $table->string('EMISOR', 150)->index('idx_nc_emisor');
                $table->double('PRECIO_PORC')->index('idx_nc_precio');
                $table->string('MERCADO', 30)->nullable();
                $table->decimal('VALOR_NOMINAL', 14, 2);
                $table->decimal('VALOR_EFECTIVO', 14, 2);
                $table->string('CASA_COMPRADORA', 120)->nullable()->index('idx_nc_casa_comp');
                $table->string('CASA_VENDEDORA', 120)->nullable()->index('idx_nc_casa_vend');
                $table->string('BOLSA', 10)->index('idx_nc_bolsa');
                $table->timestamp('created_at')->useCurrent();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::connection('mysql_inversion')->dropIfExists('notas_credito_his');
    }
};

