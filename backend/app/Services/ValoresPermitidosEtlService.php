<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ValoresPermitidosEtlService
{
    /**
     * Procesa e importa el archivo Excel de Valores Permitidos de la Bolsa de Valores
     */
    public function importValoresPermitidos(?string $filePath = null): array
    {
        $startTime = microtime(true);

        if (!$filePath || !file_exists($filePath)) {
            // Buscar en el directorio por defecto de descargas BVG/BVQ
            $todayPath = 'C:\\Users\\super\\DATOS\\004. DatosBVG\\' . date('Y_m') . '\\' . date('Y_m_d') . '\\003_VectorDePrecios\\valores-permitidos_' . date('Y_m_d') . '.xlsx';
            if (file_exists($todayPath)) {
                $filePath = $todayPath;
            } else {
                // Intentar buscar cualquier archivo valores-permitidos_*.xlsx reciente
                $searchPattern = 'C:\\Users\\super\\DATOS\\004. DatosBVG\\*\\*\\003_VectorDePrecios\\valores-permitidos_*.xlsx';
                $files = glob($searchPattern);
                if (!empty($files)) {
                    usort($files, function ($a, $b) {
                        return filemtime($b) - filemtime($a);
                    });
                    $filePath = $files[0];
                }
            }
        }

        if (!$filePath || !file_exists($filePath)) {
            return [
                'success' => false,
                'message' => 'No se encontró el archivo valores-permitidos.xlsx en la ruta especificada.',
                'imported_count' => 0
            ];
        }

        try {
            // Utilizar script auxiliar de Node.js / PHP ZipArchive para extraer datos de las pestañas
            $nodeExec = 'node';
            $scriptPath = base_path('scratch/import_valores_permitidos_helper.cjs');
            $this->ensureHelperScriptExists($scriptPath);

            $cmd = sprintf('"%s" "%s" "%s"', $nodeExec, $scriptPath, $filePath);
            $output = shell_exec($cmd . ' 2>&1');

            Log::info('Valores Permitidos Helper Output: ' . substr($output, 0, 500));

            $result = json_decode($output, true);
            if (!$result || !isset($result['data'])) {
                return [
                    'success' => false,
                    'message' => 'Error al analizar el contenido de las pestañas del archivo Excel.',
                    'output' => $output
                ];
            }

            $actionsData = $result['data']['acciones'] ?? [];
            $genericosData = $result['data']['genericos'] ?? [];
            $obligacionesData = $result['data']['obligaciones'] ?? [];

            $updatedCount = 0;

            // 1. Procesar Pestaña ACCIONES (Actualizar Valor Nominal)
            foreach ($actionsData as $act) {
                $nombreRaw = trim($act['emisor'] ?? '');
                $nominal = (float)($act['nominal'] ?? 1.00);

                if (empty($nombreRaw)) continue;

                $matchedId = $this->findEmisorId($nombreRaw);
                if ($matchedId) {
                    DB::table('emisor')
                        ->where('id_emisor', $matchedId)
                        ->update([
                            'valor_nominal' => $nominal,
                            'fecha_actualizacion' => now()
                        ]);
                    $updatedCount++;
                }
            }

            // 2. Procesar Pestaña VALORES GENÉRICOS (Actualizar Ratings Bancos y Cooperativas)
            foreach ($genericosData as $gen) {
                $nombreRaw = trim($gen['emisor'] ?? '');
                $rating = trim($gen['calificacion'] ?? '');
                $calificadora = trim($gen['calificadora'] ?? '');
                $patrimoniosbs = isset($gen['patrimonio_sbs']) ? (float)$gen['patrimonio_sbs'] : null;

                if (empty($nombreRaw)) continue;

                $matchedId = $this->findEmisorId($nombreRaw);
                if ($matchedId) {
                    $updateData = ['fecha_actualizacion' => now()];
                    if (!empty($rating)) $updateData['calificacion_riesgo'] = $rating;
                    if (!empty($calificadora)) $updateData['calificadora_riesgo'] = $calificadora;
                    if ($patrimoniosbs !== null) $updateData['patrimonio_tecnico_sbs'] = $patrimoniosbs;

                    DB::table('emisor')
                        ->where('id_emisor', $matchedId)
                        ->update($updateData);
                    $updatedCount++;
                }
            }

            // 3. Procesar Pestaña OBLIGACIONES CP Y LP (Actualizar Ratings Corporativos)
            foreach ($obligacionesData as $obl) {
                $nombreRaw = trim($obl['emisor'] ?? '');
                $rating = trim($obl['calificacion'] ?? '');
                $calificadora = trim($obl['calificadora'] ?? '');

                if (empty($nombreRaw) || empty($rating)) continue;

                $matchedId = $this->findEmisorId($nombreRaw);
                if ($matchedId) {
                    // Actualizar solo si la calificación actual está vacía o es de menor prioridad
                    $updateData = [
                        'calificacion_riesgo' => $rating,
                        'calificadora_riesgo' => $calificadora,
                        'fecha_actualizacion' => now()
                    ];

                    DB::table('emisor')
                        ->where('id_emisor', $matchedId)
                        ->update($updateData);
                    $updatedCount++;
                }
            }

            $executionTime = round(microtime(true) - $startTime, 2);

            return [
                'success' => true,
                'message' => "Proceso de homologación e importación de Valores Permitidos completado exitosamente.",
                'file_processed' => basename($filePath),
                'updated_emisores_count' => $updatedCount,
                'tiempo_ejecucion_segundos' => $executionTime
            ];
        } catch (\Exception $e) {
            Log::error('Error en ValoresPermitidosEtlService: ' . $e->getMessage());
            return [
                'success' => false,
                'message' => 'Error al procesar el archivo de Valores Permitidos',
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Busca el ID del emisor en la DB usando coincidencia directa o por palabras clave
     */
    protected function findEmisorId(string $nombreRaw): ?int
    {
        $normalized = mb_strtoupper(trim($nombreRaw));

        // 1. Coincidencia exacta por nombre
        $emisor = DB::table('emisor')->where('nombre', $normalized)->first();
        if ($emisor) return $emisor->id_emisor;

        // 2. Coincidencia por palabra clave principal
        $keywords = array_filter(explode(' ', str_replace(['.', ',', '-'], ' ', $normalized)), function ($w) {
            return strlen($w) > 3 && !in_array($w, ['BANCO', 'COMPAÑIA', 'CORPORACION', 'SOCIEDAD', 'GRUPO', 'HOLDING', 'LTDA', 'S.A.', 'C.A.']);
        });

        if (!empty($keywords)) {
            $kwList = array_values($keywords);
            $mainKw = $kwList[0];

            $emisorKw = DB::table('emisor')
                ->where('nombre', 'LIKE', '%' . $mainKw . '%')
                ->first();

            if ($emisorKw) return $emisorKw->id_emisor;
        }

        return null;
    }

    /**
     * Asegura la presencia del script ejecutor Node.js helper
     */
    protected function ensureHelperScriptExists(string $scriptPath): void
    {
        if (file_exists($scriptPath)) return;

        $dir = dirname($scriptPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $jsContent = <<<'JS'
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) {
  console.log(JSON.stringify({ error: 'File not found' }));
  process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvg_zip_'));
const zipPath = path.join(tmpDir, 'excel.zip');

try {
  fs.copyFileSync(filePath, zipPath);
  execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force"`);

  const wbXml = fs.readFileSync(path.join(tmpDir, 'xl/workbook.xml'), 'utf8');
  const sheetRegex = /<sheet [^>]*name="([^"]+)"[^>]*sheetId="([^"]+)"[^>]*r:id="([^"]+)"/g;
  let match;
  const sheets = [];
  while ((match = sheetRegex.exec(wbXml)) !== null) {
    sheets.push({ name: match[1], sheetId: match[2], rId: match[3] });
  }

  const ssPath = path.join(tmpDir, 'xl/sharedStrings.xml');
  const sharedStrings = [];
  if (fs.existsSync(ssPath)) {
    const ssXml = fs.readFileSync(ssPath, 'utf8');
    const siMatches = ssXml.match(/<si>(.*?)<\/si>/gs) || [];
    siMatches.forEach(si => {
      const tMatches = si.match(/<t[^>]*>(.*?)<\/t>/gs) || [];
      const text = tMatches.map(t => t.replace(/<[^>]+>/g, '')).join('');
      sharedStrings.push(text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
    });
  }

  const relsXml = fs.readFileSync(path.join(tmpDir, 'xl/_rels/workbook.xml.rels'), 'utf8');
  const relRegex = /<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
  const rIdMap = {};
  while ((match = relRegex.exec(relsXml)) !== null) {
    rIdMap[match[1]] = match[2];
  }

  function getSheetData(sheetName) {
    const s = sheets.find(x => x.name.toLowerCase().includes(sheetName.toLowerCase()));
    if (!s) return [];

    let target = rIdMap[s.rId];
    if (target.startsWith('/')) target = target.slice(1);
    if (!target.startsWith('xl/')) target = 'xl/' + target;

    const sheetXmlPath = path.join(tmpDir, target);
    if (!fs.existsSync(sheetXmlPath)) return [];

    const sheetXml = fs.readFileSync(sheetXmlPath, 'utf8');
    const cRegex = /<c [^>]*r="([A-Z]+\d+)"([^>]*)>(.*?)<\/c>|<c [^>]*r="([A-Z]+\d+)"([^>]*)\/>/gs;
    let cMatch;
    const rows = {};

    while ((cMatch = cRegex.exec(sheetXml)) !== null) {
      const ref = cMatch[1] || cMatch[4];
      const attrs = cMatch[2] || cMatch[5] || '';
      const body = cMatch[3] || '';
      const m = ref.match(/([A-Z]+)(\d+)/);
      if (!m) continue;
      const col = m[1];
      const row = parseInt(m[2], 10);
      const tMatch = attrs.match(/t="([^"]+)"/);
      const type = tMatch ? tMatch[1] : '';

      let val = '';
      const vMatch = body.match(/<v>(.*?)<\/v>/);
      if (vMatch) val = vMatch[1];

      if (type === 's') {
        const i = parseInt(val, 10);
        val = sharedStrings[i] !== undefined ? sharedStrings[i] : val;
      }

      if (!rows[row]) rows[row] = {};
      rows[row][col] = val;
    }
    return rows;
  }

  const result = {
    acciones: [],
    genericos: [],
    obligaciones: []
  };

  // 1. Acciones
  const rowsAcc = getSheetData('Acciones');
  Object.keys(rowsAcc).forEach(rNum => {
    const r = rowsAcc[rNum];
    if (r['B'] && r['B'] !== 'Emisores') {
      result.acciones.push({
        emisor: r['B'],
        nominal: parseFloat(r['C'] || 1.0)
      });
    }
  });

  // 2. Genéricos (Bancos/COACs)
  const rowsGen = getSheetData('Genéricos');
  Object.keys(rowsGen).forEach(rNum => {
    const r = rowsGen[rNum];
    if (r['A'] && r['A'] !== 'Emisor' && r['D']) {
      result.genericos.push({
        emisor: r['A'],
        patrimonio_sbs: parseFloat(r['C'] || 0),
        calificacion: r['D'],
        calificadora: r['F'] || ''
      });
    }
  });

  // 3. Obligaciones
  const rowsObl = getSheetData('Obligaciones');
  Object.keys(rowsObl).forEach(rNum => {
    const r = rowsObl[rNum];
    if (r['A'] && r['A'] !== 'Emisor' && r['D']) {
      result.obligaciones.push({
        emisor: r['A'],
        calificacion: r['D'],
        calificadora: r['F'] || ''
      });
    }
  });

  console.log(JSON.stringify({ data: result }));
} catch (err) {
  console.log(JSON.stringify({ error: err.message }));
} finally {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
}
JS;

        file_put_contents($scriptPath, $jsContent);
    }
}
