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
        if (Schema::connection('mysql_inversion')->hasTable('bond_his')) {
            Schema::connection('mysql_inversion')->table('bond_his', function (Blueprint $table) {
                if (!Schema::connection('mysql_inversion')->hasColumn('bond_his', 'TIR_TEA')) {
                    $table->double('TIR_TEA')->nullable()->after('RENDIMIENTO_PORC');
                }
                if (!Schema::connection('mysql_inversion')->hasColumn('bond_his', 'VALOR_NOMINAL_ORIGINAL')) {
                    $table->double('VALOR_NOMINAL_ORIGINAL')->nullable()->after('TASA_INTERES');
                }
                if (!Schema::connection('mysql_inversion')->hasColumn('bond_his', 'CLASE')) {
                    $table->string('CLASE', 50)->nullable()->after('TIPO');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::connection('mysql_inversion')->hasTable('bond_his')) {
            Schema::connection('mysql_inversion')->table('bond_his', function (Blueprint $table) {
                $columnsToDrop = [];
                if (Schema::connection('mysql_inversion')->hasColumn('bond_his', 'TIR_TEA')) {
                    $columnsToDrop[] = 'TIR_TEA';
                }
                if (Schema::connection('mysql_inversion')->hasColumn('bond_his', 'VALOR_NOMINAL_ORIGINAL')) {
                    $columnsToDrop[] = 'VALOR_NOMINAL_ORIGINAL';
                }
                if (Schema::connection('mysql_inversion')->hasColumn('bond_his', 'CLASE')) {
                    $columnsToDrop[] = 'CLASE';
                }
                if (!empty($columnsToDrop)) {
                    $table->dropColumn($columnsToDrop);
                }
            });
        }
    }
};
