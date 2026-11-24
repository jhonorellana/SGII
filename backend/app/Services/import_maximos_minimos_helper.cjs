const fs = require('fs');
const path = require('path');

// Resolver modulo xlsx
let xlsx;
try {
  xlsx = require('xlsx');
} catch (e) {
  xlsx = require('c:/PROYECTOS/SIPRO_07/frontend/node_modules/xlsx');
}

function formatDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    val = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
    const months = {
      'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
      'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
    };
    const m = val.match(/^(\d{1,2})-([a-zA-Z]{3})\.?-(\d{4})/);
    if (m) {
      const day = m[1].padStart(2, '0');
      const mon = months[m[2].toLowerCase()] || '01';
      return `${m[3]}-${mon}-${day}`;
    }
  }
  return null;
}

function parseNum(v) {
  if (v === null || v === undefined || v === '' || v === '-') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function extractDateFromPath(filePath) {
  const parts = filePath.split(/[\\\/]/);
  for (const p of parts) {
    const m = p.match(/(\d{4})_(\d{2})_(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  let year = null;
  let mmdd = null;
  for (const p of parts) {
    if (/^\d{4}$/.test(p)) year = p;
    const m = p.match(/^(\d{2})_(\d{2})$/);
    if (m) mmdd = `${m[1]}-${m[2]}`;
  }
  if (year && mmdd) return `${year}-${mmdd}`;
  return null;
}

function parseMaximosMinimosFile(filePath) {
  try {
    const basename = path.basename(filePath);
    let fechaInfo = extractDateFromPath(filePath);

    const wb = xlsx.readFile(filePath, { cellDates: true });
    
    // Buscar la hoja de datos principal (evitando hojas técnicas auxiliares como 'LOG' o 'NOTA')
    let sheetName = wb.SheetNames.find(n => /MAX.*MIN/i.test(n) || /ACCION/i.test(n) || /BVQ/i.test(n));
    if (!sheetName) {
      sheetName = wb.SheetNames.find(n => !/^LOG/i.test(n) && !/^NOTA/i.test(n)) || wb.SheetNames[0];
    }
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return null;

    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    if (!rows || rows.length < 10) return null;

    // Buscar fecha de vigencia (usualmente en filas 4 a 8)
    let fechaVigencia = null;
    for (let r = 3; r <= Math.min(8, rows.length - 1); r++) {
      const row = rows[r];
      if (!row) continue;
      for (const cell of row) {
        const d = formatDate(cell);
        if (d) {
          fechaVigencia = d;
          break;
        }
      }
      if (fechaVigencia) break;
    }

    // Si aún no tenemos fechaInfo, intentar derivarla de fechaVigencia
    if (!fechaInfo && fechaVigencia) {
      const vigDate = new Date(fechaVigencia + 'T12:00:00Z');
      // Si vigencia es lunes (1), la fecha de información fue viernes (3 días antes)
      const dayOfWeek = vigDate.getUTCDay();
      const daysBack = (dayOfWeek === 1) ? 3 : 1;
      vigDate.setUTCDate(vigDate.getUTCDate() - daysBack);
      fechaInfo = vigDate.toISOString().split('T')[0];
    }

    if (!fechaInfo) {
      return {
        success: false,
        file: filePath,
        error: 'No se pudo determinar fecha_informacion a partir de la ruta ni del contenido'
      };
    }

    let started = false;
    let esLiquido = 1;
    let sector = 'BANCOS';
    const records = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const col1 = r[1] ? String(r[1]).trim() : '';
      const col2 = r[2] ? String(r[2]).trim() : '';

      // Detección de secciones y cabeceras
      if (!col2 || col2.length > 10 || col2.includes(' ')) {
        if (/TITULOS\s+LIQUIDOS/i.test(col1)) {
          started = true;
          esLiquido = 1;
        } else if (/TITULOS\s+NO\s+LIQUIDOS/i.test(col1)) {
          started = true;
          esLiquido = 0;
        } else if (started) {
          const clean = col1.replace(/\s+/g, '').toUpperCase();
          if (clean === 'BANCOS') sector = 'BANCOS';
          else if (clean === 'FINANCIERAS') sector = 'FINANCIERAS';
          else if (clean.startsWith('COMPA')) sector = 'COMPAÑIAS';
          else if (clean === 'FONDOS') sector = 'FONDOS';
        }
        continue;
      }

      if (!started) continue;
      if (['CODIGO', 'EN SEB', 'SEB'].includes(col2.toUpperCase())) continue;

      records.push({
        fecha_informacion: fechaInfo,
        fecha_vigencia: fechaVigencia,
        es_liquido: esLiquido,
        sector: sector,
        emisor: col1,
        codigo_seb: col2,
        valor_nominal: parseNum(r[3]) || 0,
        precio_cierre: parseNum(r[4]),
        precio_maximo: parseNum(r[5]),
        precio_minimo: parseNum(r[6]),
        num_acc_ult_cierre: parseNum(r[7]),
        fecha_ult_cierre: formatDate(r[8]),
        fecha_ult_negoc: formatDate(r[9]),
        precio_cierre_bvq: parseNum(r[10]),
        num_acc_ult_bvq: parseNum(r[11]),
        fecha_ult_cierre_bvq: formatDate(r[12]),
        archivo_origen: basename
      });
    }

    return {
      success: true,
      file: filePath,
      fecha_informacion: fechaInfo,
      fecha_vigencia: fechaVigencia,
      count: records.length,
      records: records
    };
  } catch (err) {
    return {
      success: false,
      file: filePath,
      error: err.message
    };
  }
}

// CLI Execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(JSON.stringify({ success: false, message: 'Argumentos requeridos: --file <path> o --batch <dir> [--out <output.json>]' }));
  process.exit(1);
}

if (args[0] === '--file' || (!args[0].startsWith('--') && fs.existsSync(args[0]))) {
  const targetFile = args[0] === '--file' ? args[1] : args[0];
  const res = parseMaximosMinimosFile(targetFile);
  console.log(JSON.stringify(res));
  process.exit(res && res.success ? 0 : 1);
}

if (args[0] === '--batch') {
  const targetDir = args[1];
  let outFile = null;
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1 && args[outIdx + 1]) {
    outFile = args[outIdx + 1];
  }

  const files = [];
  function scan(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) scan(path.join(dir, e.name));
        else if (e.isFile() && /maximos.*\.xls$/i.test(e.name)) files.push(path.join(dir, e.name));
      }
    } catch (e) {}
  }
  scan(targetDir);

  const allRecords = [];
  let filesProcessed = 0;
  let errors = 0;

  for (const f of files) {
    const res = parseMaximosMinimosFile(f);
    if (res && res.success) {
      filesProcessed++;
      for (const rec of res.records) {
        allRecords.push(rec);
      }
    } else {
      errors++;
    }
  }

  const outputData = {
    success: true,
    target_dir: targetDir,
    total_files: files.length,
    files_processed: filesProcessed,
    errors: errors,
    total_records: allRecords.length,
    records: allRecords
  };

  if (outFile) {
    fs.writeFileSync(outFile, JSON.stringify(outputData), 'utf8');
    console.log(JSON.stringify({
      success: true,
      output_file: outFile,
      total_files: files.length,
      files_processed: filesProcessed,
      errors: errors,
      total_records: allRecords.length
    }));
  } else {
    console.log(JSON.stringify(outputData));
  }
}
