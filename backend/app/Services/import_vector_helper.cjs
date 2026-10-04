const fs = require('fs');
const path = require('path');

// Resolver modulo xlsx desde node_modules de frontend si no está en root
let xlsx;
try {
  xlsx = require('xlsx');
} catch (e) {
  xlsx = require('c:/PROYECTOS/SIPRO_07/frontend/node_modules/xlsx');
}

const filePath = process.argv[2];

if (!filePath || !fs.existsSync(filePath)) {
  console.log(JSON.stringify({ success: false, message: 'Archivo no encontrado: ' + filePath }));
  process.exit(1);
}

try {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  
  // Extraer fecha del vector desde nombre de archivo o celda
  let fechaVector = null;
  const basename = path.basename(filePath);
  const match = basename.match(/(\d{4})_(\d{2})_(\d{2})/);
  if (match) {
    fechaVector = `${match[1]}-${match[2]}-${match[3]}`;
  }

  // 1. Procesar Pestaña 'Precios'
  const sheetPrecios = workbook.Sheets['Precios'];
  const rowsPrecios = xlsx.utils.sheet_to_json(sheetPrecios, { header: 1 });

  // Si no se halló fecha por nombre, buscar en celda B1 / H5
  if (!fechaVector && rowsPrecios[0] && rowsPrecios[0][1]) {
    const val = rowsPrecios[0][1];
    if (typeof val === 'number') {
      const d = new Date((val - (25567 + 2)) * 86400 * 1000);
      fechaVector = d.toISOString().split('T')[0];
    }
  }

  if (!fechaVector) {
    fechaVector = new Date().toISOString().split('T')[0];
  }

  const preciosParsed = [];
  // Las filas de datos inician en la fila 7 (índice 6)
  for (let i = 6; i < rowsPrecios.length; i++) {
    const row = rowsPrecios[i];
    if (!row || !row[1]) continue; // Sin codigo titulo

    const rawCode = String(row[1]).trim();
    if (!rawCode || rawCode.length < 5) continue;

    // Regla del prefijo 'a' para evitar truncamiento numérico
    const codigoVector = rawCode.startsWith('a') ? rawCode : 'a' + rawCode;

    const calificacion = row[2] ? String(row[2]).trim() : null;
    const nemoEmisor = row[3] ? String(row[3]).trim() : null;
    const nombreEmisor = row[4] ? String(row[4]).trim() : null;
    const claseTitulo = row[5] ? String(row[5]).trim() : null;
    
    // Convertir fechas Excel o Date
    let fechaEmision = null;
    if (row[6]) {
      if (row[6] instanceof Date) fechaEmision = row[6].toISOString().split('T')[0];
      else if (typeof row[6] === 'number') fechaEmision = new Date((row[6] - (25567 + 2)) * 86400 * 1000).toISOString().split('T')[0];
      else if (typeof row[6] === 'string') fechaEmision = row[6].trim();
    }

    let fechaVencimiento = null;
    if (row[7]) {
      if (row[7] instanceof Date) fechaVencimiento = row[7].toISOString().split('T')[0];
      else if (typeof row[7] === 'number') fechaVencimiento = new Date((row[7] - (25567 + 2)) * 86400 * 1000).toISOString().split('T')[0];
      else if (typeof row[7] === 'string') fechaVencimiento = row[7].trim();
    }

    const plazoDias = row[8] ? parseInt(row[8], 10) : 0;
    const tasaCupon = row[9] !== undefined ? parseFloat(row[9]) : 0;
    const formaReajuste = row[10] ? String(row[10]).trim() : null;
    const tasaDescuento = row[13] !== undefined ? parseFloat(row[13]) : 0;
    
    // Precio en porcentaje (ej. 1.00237091 equivale a 100.237091%)
    let precioPorcentaje = row[16] !== undefined ? parseFloat(row[16]) : 1.0;
    if (precioPorcentaje <= 5.0) {
      precioPorcentaje = precioPorcentaje * 100; // Convertir de decimal 1.00237 a porcentaje 100.237%
    }

    preciosParsed.push({
      codigo_titulo_vector: codigoVector,
      nemo_emisor: nemoEmisor,
      nombre_emisor: nombreEmisor,
      clase_titulo: claseTitulo,
      calificacion_riesgo: calificacion,
      precio_porcentaje: precioPorcentaje,
      tasa_descuento_tir: tasaDescuento > 1 ? tasaDescuento : tasaDescuento * 100, // %
      tasa_cupon: tasaCupon > 1 ? tasaCupon : tasaCupon * 100, // %
      plazo_dias_remanentes: plazoDias,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      forma_reajuste: formaReajuste
    });
  }

  // 2. Procesar Pestaña 'Curva de Rendimiento'
  const curvaParsed = [];
  const sheetCurva = workbook.Sheets['Curva de Rendimiento'];
  if (sheetCurva) {
    const rowsCurva = xlsx.utils.sheet_to_json(sheetCurva, { header: 1 });
    // Inicia en fila 3 (índice 2)
    for (let j = 2; j < rowsCurva.length; j++) {
      const r = rowsCurva[j];
      if (!r || r[0] === undefined) continue;
      const plazo = parseInt(r[0], 10);
      const tir = r[1] !== undefined ? parseFloat(r[1]) : 0;
      if (!isNaN(plazo)) {
        curvaParsed.push({
          plazo_dias: plazo,
          tasa_tir: tir > 1 ? tir : tir * 100
        });
      }
    }
  }

  console.log(JSON.stringify({
    success: true,
    fecha_vector: fechaVector,
    total_precios: preciosParsed.length,
    total_curva: curvaParsed.length,
    data_precios: preciosParsed,
    data_curva: curvaParsed
  }));

} catch (err) {
  console.log(JSON.stringify({
    success: false,
    message: 'Error al procesar el archivo Excel: ' + err.message
  }));
}
