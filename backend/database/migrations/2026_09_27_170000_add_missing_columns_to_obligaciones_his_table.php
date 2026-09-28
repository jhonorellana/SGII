<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Connection used by the migration
     */
    protected $connection = 'mysql_inversion';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::connection('mysql_inversion')->hasTable('obligaciones_his')) {
            Schema::connection('mysql_inversion')->table('obligaciones_his', function (Blueprint $table) {
                if (!Schema::connection('mysql_inversion')->hasColumn('obligaciones_his', 'TIR_TEA')) {
                    $table->decimal('TIR_TEA', 18, 4)->nullable()->after('INTERES');
                }
                if (!Schema::connection('mysql_inversion')->hasColumn('obligaciones_his', 'VALOR_NOMINAL_ORIGINAL')) {
                    $table->decimal('VALOR_NOMINAL_ORIGINAL', 18, 4)->nullable()->after('TIR_TEA');
                }
                if (!Schema::connection('mysql_inversion')->hasColumn('obligaciones_his', 'NOMBRE_TITULO')) {
                    $table->string('NOMBRE_TITULO', 200)->nullable()->after('VENCIMIENTO');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::connection('mysql_inversion')->hasTable('obligaciones_his')) {
            Schema::connection('mysql_inversion')->table('obligaciones_his', function (Blueprint $table) {
                if (Schema::connection('mysql_inversion')->hasColumn('obligaciones_his', 'TIR_TEA')) {
                    $table->dropColumn('TIR_TEA');
                }
                if (Schema::connection('mysql_inversion')->hasColumn('obligaciones_his', 'VALOR_NOMINAL_ORIGINAL')) {
                    $table->dropColumn('VALOR_NOMINAL_ORIGINAL');
                }
                if (Schema::connection('mysql_inversion')->hasColumn('obligaciones_his', 'NOMBRE_TITULO')) {
                    $table->dropColumn('NOMBRE_TITULO');
                }
            });
        }
    }
};
