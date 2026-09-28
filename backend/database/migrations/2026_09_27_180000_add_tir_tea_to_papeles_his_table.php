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
        if (Schema::connection('mysql_inversion')->hasTable('papeles_his')) {
            Schema::connection('mysql_inversion')->table('papeles_his', function (Blueprint $table) {
                if (!Schema::connection('mysql_inversion')->hasColumn('papeles_his', 'TIR_TEA')) {
                    $table->decimal('TIR_TEA', 18, 4)->nullable()->after('RENDIMIENTO');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::connection('mysql_inversion')->hasTable('papeles_his')) {
            Schema::connection('mysql_inversion')->table('papeles_his', function (Blueprint $table) {
                if (Schema::connection('mysql_inversion')->hasColumn('papeles_his', 'TIR_TEA')) {
                    $table->dropColumn('TIR_TEA');
                }
            });
        }
    }
};
