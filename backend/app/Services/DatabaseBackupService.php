<?php

namespace App\Services;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;

class DatabaseBackupService
{
    /**
     * Directorio por defecto para almacenar las copias de seguridad .zip
     */
    protected string $backupDir = 'C:\\PROYECTOS\\DescargaDiaria\\backups';

    public function __construct()
    {
        $this->ensureDirectoryExists($this->backupDir);
    }

    /**
     * Garantiza la existencia del directorio de destino
     */
    protected function ensureDirectoryExists(string $path): void
    {
        if (!file_exists($path)) {
            @mkdir($path, 0777, true);
        }
    }

    /**
     * Localiza el ejecutable mysqldump en el sistema
     */
    protected function getMysqldumpPath(): string
    {
        $possiblePaths = [
            'C:\\xampp\\mysql\\bin\\mysqldump.exe',
            'C:\\Program Files\\MySQL\\MySQL Workbench 8.0 CE\\mysqldump.exe',
            'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
            'C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysqldump.exe',
            'C:\\laragon\\bin\\mysql\\mysql-8.0.30-winx64\\bin\\mysqldump.exe',
            'C:\\wamp64\\bin\\mysql\\mysql8.0.31\\bin\\mysqldump.exe'
        ];

        foreach ($possiblePaths as $path) {
            if (file_exists($path)) {
                return $path;
            }
        }

        return 'mysqldump';
    }

    /**
     * Genera backup en formato .zip de la base de datos solicitada ('inversion', 'sipro_desa' o ambos)
     */
    public function generateBackup(string $target = 'both'): array
    {
        $results = [];

        if ($target === 'inversion' || $target === 'both') {
            $results['inversion'] = $this->backupSingleDatabase('mysql_inversion', 'inversion');
        }

        if ($target === 'sipro_desa' || $target === 'both') {
            $results['sipro_desa'] = $this->backupSingleDatabase('mysql', 'sipro_desa');
        }

        $allSuccess = true;
        foreach ($results as $res) {
            if (!$res['success']) {
                $allSuccess = false;
                break;
            }
        }

        return [
            'success' => $allSuccess,
            'backup_dir' => $this->backupDir,
            'timestamp' => date('Y-m-d H:i:s'),
            'backups' => $results
        ];
    }

    /**
     * Procesa la copia de seguridad de una sola base de datos y genera su .zip
     */
    protected function backupSingleDatabase(string $connectionName, string $defaultDbName): array
    {
        $startTime = microtime(true);
        $config = Config::get("database.connections.{$connectionName}", []);

        $dbHost = $config['host'] ?? '127.0.0.1';
        $dbPort = $config['port'] ?? '3306';
        $dbName = $config['database'] ?? $defaultDbName;
        $dbUser = $config['username'] ?? 'root';
        $dbPass = $config['password'] ?? '';

        $timestamp = date('Ymd_His');
        $baseFilename = "backup_{$dbName}_{$timestamp}";
        $sqlPath = $this->backupDir . DIRECTORY_SEPARATOR . "{$baseFilename}.sql";
        $zipPath = $this->backupDir . DIRECTORY_SEPARATOR . "{$baseFilename}.zip";

        $mysqldump = $this->getMysqldumpPath();

        // Construir comando de volcado mysqldump
        $passArg = $dbPass !== '' ? sprintf('-p"%s"', addcslashes($dbPass, '"\\$')) : '';
        $cmdSql = sprintf(
            '"%s" --host="%s" --port="%s" --user="%s" %s --routines --triggers --quick --single-transaction "%s" > "%s"',
            $mysqldump,
            $dbHost,
            $dbPort,
            $dbUser,
            $passArg,
            $dbName,
            $sqlPath
        );

        // Ejecutar mysqldump
        $outputSql = shell_exec($cmdSql . ' 2>&1');

        if (!file_exists($sqlPath) || filesize($sqlPath) === 0) {
            Log::error("Error ejecutando mysqldump para {$dbName}: {$outputSql}");
            return [
                'success' => false,
                'database' => $dbName,
                'message' => "No se pudo generar el volcado SQL para la base de datos {$dbName}.",
                'output' => $outputSql
            ];
        }

        // Comprimir archivo .sql en .zip usando PowerShell Compress-Archive
        $cmdZip = sprintf(
            'powershell -Command "Compress-Archive -Path \'%s\' -DestinationPath \'%s\' -Force"',
            $sqlPath,
            $zipPath
        );

        $outputZip = shell_exec($cmdZip . ' 2>&1');

        // Eliminar archivo .sql temporal
        if (file_exists($sqlPath)) {
            @unlink($sqlPath);
        }

        if (!file_exists($zipPath) || filesize($zipPath) === 0) {
            Log::error("Error comprimiendo .zip para {$dbName}: {$outputZip}");
            return [
                'success' => false,
                'database' => $dbName,
                'message' => "Se generó el SQL pero falló la compresión a .zip para {$dbName}.",
                'output' => $outputZip
            ];
        }

        $executionTime = round(microtime(true) - $startTime, 2);
        $fileSizeBytes = filesize($zipPath);

        return [
            'success' => true,
            'database' => $dbName,
            'zip_filename' => "{$baseFilename}.zip",
            'zip_path' => $zipPath,
            'size_bytes' => $fileSizeBytes,
            'size_human' => $this->formatBytes($fileSizeBytes),
            'tiempo_ejecucion_segundos' => $executionTime,
            'message' => "Backup de '{$dbName}' guardado exitosamente en {$baseFilename}.zip ({$this->formatBytes($fileSizeBytes)})."
        ];
    }

    /**
     * Formateador auxiliar de bytes
     */
    protected function formatBytes(int $bytes): string
    {
        if ($bytes === 0) return '0 B';
        $k = 1024;
        $sizes = ['B', 'KB', 'MB', 'GB'];
        $i = (int) floor(log($bytes) / log($k));
        return round($bytes / pow($k, $i), 2) . ' ' . $sizes[$i];
    }
}
