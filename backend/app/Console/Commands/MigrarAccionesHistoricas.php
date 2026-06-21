<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Exception;

class MigrarAccionesHistoricas extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:migrar-acciones-historicas {--dry-run : Realizar una simulación sin aplicar cambios} {--force : Forzar la migración sin confirmación interactiva}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Migra las inversiones en acciones históricas a las nuevas tablas de Renta Variable y las anula en Renta Fija.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn("=== EJECUTANDO EN MODO SIMULACIÓN (DRY-RUN) ===");
            $this->warn("Ningún cambio será guardado permanentemente en la base de datos.");
        } else {
            $this->warn("=== EJECUTANDO MIGRACIÓN REAL ===");
            if (!$this->option('force') && !$this->confirm('¿Está seguro de que desea proceder con la migración real en la base de datos?')) {
                $this->info('Migración cancelada por el usuario.');
                return 0;
            }
        }

        // Códigos de id_instrumento que corresponden a acciones
        $targetInstrumentos = [98, 117, 192, 194, 196, 221, 224];

        // 1. Cargar inversiones a migrar
        $inversiones = DB::table('inversion')
            ->whereIn('id_instrumento', $targetInstrumentos)
            ->where('eliminado', 0) // Evitar duplicar migración si ya fueron eliminadas
            ->get();

        if ($inversiones->isEmpty()) {
            $this->error("No se encontraron inversiones en acciones válidas para migrar en la tabla 'inversion'.");
            return 0;
        }

        $this->info("Se encontraron " . $inversiones->count() . " inversiones de acciones para migrar.");

        DB::beginTransaction();

        try {
            $migradasCount = 0;
            $movimientosVinculadosCount = 0;
            $ventasMigradasCount = 0;

            foreach ($inversiones as $inv) {
                $capital = (float)$inv->capital_invertido;
                $nominal = (float)$inv->valor_nominal;

                // Definir la cantidad de acciones y el precio unitario
                if ($nominal <= 0) {
                    // Si no está el valor nominal (cantidad de acciones), asumimos cantidad = capital a $1.00 por acción
                    $cantidad = $capital;
                    $precioUnitario = 1.0;
                } else {
                    $cantidad = $nominal;
                    $precioUnitario = $capital / $nominal;
                }

                $this->line("\n------------------------------------------------------------");
                $this->line("Procesando Inversión ID: {$inv->id_inversion} | Socio: {$inv->id_propietario} | Instrumento: {$inv->id_instrumento}");
                $this->line("  Fecha Compra: {$inv->fecha_compra} | Capital: \$" . number_format($capital, 2) . " | Cantidad: " . number_format($cantidad, 4) . " @ \$" . number_format($precioUnitario, 4));

                // Buscar movimientos de capital asociados en la base de datos real
                $movs = DB::table('movimiento_capital')
                    ->where('id_inversion', $inv->id_inversion)
                    ->get();

                // El primer movimiento de compra de capital será el que enlacemos a la operación
                $idMovimientoPrincipal = $movs->isNotEmpty() ? $movs->first()->id_movimiento_capital : null;

                // 2. Insertar la operación de compra en accion_operacion
                $idOperacionCompra = null;
                if (!$dryRun) {
                    $idOperacionCompra = DB::table('accion_operacion')->insertGetId([
                        'id_instrumento' => $inv->id_instrumento,
                        'id_persona' => $inv->id_propietario,
                        'id_tipo_operacion' => 204, // COMPRA_ACCION
                        'id_movimiento_capital' => $idMovimientoPrincipal,
                        'fecha_operacion' => $inv->fecha_compra,
                        'cantidad' => $cantidad,
                        'precio_unitario' => $precioUnitario,
                        'valor_bruto' => $capital,
                        'comision_bolsa' => $inv->comision_bolsa ?: 0.0,
                        'comision_operador' => $inv->comision_casa_valores ?: 0.0,
                        'total_comisiones' => $inv->total_comisiones ?: 0.0,
                        'valor_neto' => $capital,
                        'costo_promedio_unitario' => $precioUnitario,
                        'observacion' => trim('[MIGRADO] Migrado de Inversión ID: ' . $inv->id_inversion . '. ' . $inv->observacion),
                        'activo' => 1,
                        'eliminado' => 0,
                        'fecha_creacion' => now(),
                        'fecha_actualizacion' => now()
                    ]);
                    $migradasCount++;
                }

                $this->info("  [COMPRA] Creada operación de Renta Variable.");

                // 3. Re-vincular los movimientos de capital históricos desvinculándolos de Renta Fija
                foreach ($movs as $mov) {
                    $this->line("  [MOVIMIENTO] Desvinculando Movimiento ID: {$mov->id_movimiento_capital} de Renta Fija");
                    if (!$dryRun) {
                        DB::table('movimiento_capital')
                            ->where('id_movimiento_capital', $mov->id_movimiento_capital)
                            ->update([
                                'id_inversion' => null, // Desvincular de Renta Fija
                                'id_accion_operacion' => $idOperacionCompra, // Vincular a Renta Variable
                                'fecha_actualizacion' => now()
                            ]);
                        $movimientosVinculadosCount++;
                    }
                }

                // 4. Si el estado de la inversión es 132 (Liquidada/Vendida), crear la operación de Venta
                if ($inv->id_estado_inversion == 132) {
                    $fechaVenta = $inv->fecha_venta ?: ($inv->fecha_primer_pago ?: now());
                    $this->warn("  [LIQUIDADA] Creando operación de venta correspondiente a fecha: {$fechaVenta}");
                    if (!$dryRun) {
                        DB::table('accion_operacion')->insert([
                            'id_instrumento' => $inv->id_instrumento,
                            'id_persona' => $inv->id_propietario,
                            'id_tipo_operacion' => 205, // VENTA_ACCION
                            'fecha_operacion' => $fechaVenta,
                            'cantidad' => $cantidad,
                            'precio_unitario' => $precioUnitario,
                            'valor_bruto' => $capital,
                            'comision_bolsa' => 0.0,
                            'comision_operador' => 0.0,
                            'total_comisiones' => 0.0,
                            'valor_neto' => $capital,
                            'observacion' => '[MIGRADO] Liquidación migrada de Inversión ID: ' . $inv->id_inversion,
                            'activo' => 1,
                            'eliminado' => 0,
                            'fecha_creacion' => now(),
                            'fecha_actualizacion' => now()
                        ]);
                        $ventasMigradasCount++;
                    }
                }

                // 5. Anular registros en Renta Fija (Inversión y Amortización) de forma lógica
                if (!$dryRun) {
                    // Desactivar inversión
                    DB::table('inversion')
                        ->where('id_inversion', $inv->id_inversion)
                        ->update([
                            'activo' => 0,
                            'eliminado' => 1,
                            'observacion' => trim($inv->observacion . ' [MIGRADO A RENTA VARIABLE]'),
                            'fecha_actualizacion' => now()
                        ]);

                    // Desactivar amortizaciones
                    DB::table('amortizacion')
                        ->where('id_inversion', $inv->id_inversion)
                        ->update([
                            'activo' => 0,
                            'eliminado' => 1,
                            'fecha_actualizacion' => now()
                        ]);
                }
                $this->info("  [ANULACIÓN] Inversión y amortizaciones anuladas lógicamente en Renta Fija.");
            }

            if ($dryRun) {
                DB::rollBack();
                $this->info("\n============================================================");
                $this->info("Simulación (dry-run) finalizada correctamente. No se aplicó ningún cambio.");
                $this->info("Si ejecutas sin el flag --dry-run se hubieran:");
                $this->line("  - Migrado " . $inversiones->count() . " compras de acciones.");
                $this->line("  - Creado operaciones de venta para las inversiones ya liquidadas.");
                $this->line("  - Re-vinculado todos los movimientos de capital.");
                $this->line("  - Anulado lógicamente los registros históricos de Renta Fija.");
            } else {
                DB::commit();
                $this->info("\n============================================================");
                $this->info("¡MIGRACIÓN COMPLETADA EXITOSAMENTE!");
                $this->line("  - Compras migradas: {$migradasCount}");
                $this->line("  - Ventas registradas: {$ventasMigradasCount}");
                $this->line("  - Movimientos vinculados: {$movimientosVinculadosCount}");
                $this->line("  - Inversiones y amortizaciones anuladas lógicamente.");
            }

        } catch (Exception $e) {
            DB::rollBack();
            $this->error("\nError durante el proceso de migración: " . $e->getMessage());
            return 1;
        }

        return 0;
    }
}
