import sys
import json
import pandas as pd
import mysql.connector

def safe_float(val):
    if pd.isna(val) or val is None or str(val).strip() == '':
        return None
    try:
        return float(val)
    except:
        return None

def safe_int(val):
    if pd.isna(val) or val is None or str(val).strip() == '':
        return None
    try:
        return int(float(val))
    except:
        return None

def safe_str(val):
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    return s if s != '' else None

def safe_date(val):
    if pd.isna(val) or val is None:
        return None
    try:
        if hasattr(val, 'strftime'):
            return val.strftime('%Y-%m-%d %H:%M:%S')
        dt = pd.to_datetime(val)
        if pd.isna(dt):
            return None
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return None

def get_col_val(row, col_map, key):
    col_name = col_map.get(key)
    if col_name and col_name in row:
        return row[col_name]
    return None

def run_import(excel_file_path, aaaa):
    db_config = {
        'host': '127.0.0.1',
        'user': 'root',
        'password': '',
        'database': 'inversion',
        'port': 3306
    }
    
    try:
        xls = pd.ExcelFile(excel_file_path)
        sheet_target = str(aaaa)
        if sheet_target not in xls.sheet_names:
            sheet_target = xls.sheet_names[-1]
            
        # Leer el Excel con skiprows=11
        df = pd.read_excel(excel_file_path, sheet_name=sheet_target, skiprows=11)
        df = df.dropna(how='all')
        
        if df.empty:
            print(json.dumps({'status': 'SUCCESS', 'imported_count': 0, 'message': 'No hay datos en el archivo Excel.'}))
            return

        # Mapear columnas dinámicamente por patrones
        cols = {str(c).strip(): c for c in df.columns}
        
        def find_key(candidates):
            for candidate in candidates:
                for c_clean, c_orig in cols.items():
                    c_upper = c_clean.upper()
                    cand_upper = candidate.upper()
                    if cand_upper == c_upper or cand_upper in c_upper:
                        return c_orig
            return None

        # Identificar cada columna
        col_fecha = find_key(['FECHA'])
        col_decreto = find_key(['DECRETO'])
        col_precio = find_key(['PRECIO %', 'PRECIO'])
        col_rendimiento = find_key(['RENDIMIENTO %', 'RENDIMIENTO'])
        col_interes = find_key(['INTERÉS %', 'INTERES %', 'INTERES', 'TASA INTERES'])
        col_tir_tea = find_key(['TIR/TEA', 'TIR', 'TEA'])
        col_vn_orig = find_key(['VALOR NOMINAL ORIGINAL'])
        col_vn = find_key(['VALOR NOMINAL (USD)', 'VALOR NOMINAL'])
        col_ve = find_key(['VALOR EFECTIVO (USD)', 'VALOR EFECTIVO'])
        col_plazo = find_key(['PLAZO POR VENCER'])
        col_f_emis = find_key(['FECHA EMISION', 'FECHA DE EMISION'])
        col_f_venc = find_key(['FECHA VENCIMIENTO', 'FECHA DE VENCIMIENTO'])
        col_proc = find_key(['PROCEDENCIA'])
        col_tipo = find_key(['TIPO']) # Cuidado: no tomar TIPO MERCADO
        # Si TIPO seleccionó TIPO MERCADO, ajustar
        if col_tipo and 'MERCADO' in str(col_tipo).upper():
            col_tipo = None
            for c_clean, c_orig in cols.items():
                if c_clean.upper() == 'TIPO':
                    col_tipo = c_orig
                    break

        col_clase = find_key(['CLASE'])
        col_tipo_mercado = find_key(['TIPO MERCADO'])
        col_tipo_mercado_1 = find_key(['TIPO DE MERCADO'])

        col_map = {
            'fecha': col_fecha,
            'decreto': col_decreto,
            'precio': col_precio,
            'rendimiento': col_rendimiento,
            'interes': col_interes,
            'tir_tea': col_tir_tea,
            'vn_orig': col_vn_orig,
            'vn': col_vn,
            've': col_ve,
            'plazo': col_plazo,
            'f_emis': col_f_emis,
            'f_venc': col_f_venc,
            'proc': col_proc,
            'tipo': col_tipo,
            'clase': col_clase,
            'tipo_mercado': col_tipo_mercado,
            'tipo_mercado_1': col_tipo_mercado_1
        }

        cnx = mysql.connector.connect(**db_config)
        cursor = cnx.cursor()

        # Recrear tabla de staging 'bonds_his_jao'
        cursor.execute("DROP TABLE IF EXISTS bonds_his_jao")
        cursor.execute("""
            CREATE TABLE bonds_his_jao (
                FECHA DATETIME,
                DECRETO VARCHAR(255),
                PRECIO_PORC DOUBLE,
                RENDIMIENTO_PORC DOUBLE,
                PLAZO_POR_VENCER INT,
                TASA_INTERES DOUBLE,
                TIR_TEA VARCHAR(100),
                VALOR_NOMINAL_ORIGINAL DOUBLE,
                VALOR_NOMINAL DOUBLE,
                VALOR_EFECTIVO DOUBLE,
                FECHA_EMISION DATETIME,
                FECHA_VENCIMIENTO DATETIME,
                PROCEDENCIA VARCHAR(50),
                TIPO VARCHAR(100),
                CLASE VARCHAR(100),
                TIPO_MERCADO VARCHAR(100),
                TIPO_MERCADO_1 VARCHAR(100)
            )
        """)

        insert_stmt = """
            INSERT INTO bonds_his_jao (
                FECHA, DECRETO, PRECIO_PORC, RENDIMIENTO_PORC, PLAZO_POR_VENCER, TASA_INTERES,
                TIR_TEA, VALOR_NOMINAL_ORIGINAL, VALOR_NOMINAL, VALOR_EFECTIVO, FECHA_EMISION,
                FECHA_VENCIMIENTO, PROCEDENCIA, TIPO, CLASE, TIPO_MERCADO, TIPO_MERCADO_1
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        records = []
        for _, row in df.iterrows():
            fecha = safe_date(get_col_val(row, col_map, 'fecha'))
            if not fecha:
                continue

            decreto = safe_str(get_col_val(row, col_map, 'decreto'))
            precio = safe_float(get_col_val(row, col_map, 'precio'))
            rendimiento = safe_float(get_col_val(row, col_map, 'rendimiento'))
            plazo = safe_int(get_col_val(row, col_map, 'plazo'))
            interes = safe_float(get_col_val(row, col_map, 'interes'))
            tir_tea = safe_str(get_col_val(row, col_map, 'tir_tea'))
            vn_orig = safe_float(get_col_val(row, col_map, 'vn_orig'))
            vn = safe_float(get_col_val(row, col_map, 'vn'))
            ve = safe_float(get_col_val(row, col_map, 've'))
            f_emis = safe_date(get_col_val(row, col_map, 'f_emis'))
            f_venc = safe_date(get_col_val(row, col_map, 'f_venc'))
            proc = safe_str(get_col_val(row, col_map, 'proc'))
            tipo = safe_str(get_col_val(row, col_map, 'tipo'))
            clase = safe_str(get_col_val(row, col_map, 'clase'))
            tipo_mercado = safe_str(get_col_val(row, col_map, 'tipo_mercado'))
            tipo_mercado_1 = safe_str(get_col_val(row, col_map, 'tipo_mercado_1'))

            records.append((
                fecha, decreto, precio, rendimiento, plazo, interes,
                tir_tea, vn_orig, vn, ve, f_emis,
                f_venc, proc, tipo, clase, tipo_mercado, tipo_mercado_1
            ))

        if records:
            batch_size = 500
            for i in range(0, len(records), batch_size):
                cursor.executemany(insert_stmt, records[i:i + batch_size])
                cnx.commit()

        # Insertar de forma incremental en 'bond_his'
        sql_insert = """
            INSERT INTO bond_his (
                FECHA, DECRETO, PRECIO_PORC, RENDIMIENTO_PORC, PLAZO_POR_VENCER, TASA_INTERES,
                TIR_TEA, VALOR_NOMINAL_ORIGINAL, VALOR_NOMINAL, VALOR_EFECTIVO, FECHA_EMISION,
                FECHA_VENCIMIENTO, PROCEDENCIA, TIPO, CLASE, TIPO_MERCADO, TIPO_MERCADO_1
            )
            SELECT 
                FECHA, DECRETO, PRECIO_PORC, RENDIMIENTO_PORC, PLAZO_POR_VENCER, TASA_INTERES,
                TIR_TEA, VALOR_NOMINAL_ORIGINAL, VALOR_NOMINAL, VALOR_EFECTIVO, FECHA_EMISION,
                FECHA_VENCIMIENTO, PROCEDENCIA, TIPO, CLASE, TIPO_MERCADO, TIPO_MERCADO_1
            FROM bonds_his_jao
            WHERE FECHA > (SELECT IFNULL(MAX(FECHA), '2000-01-01') FROM bond_his)
        """
        cursor.execute(sql_insert)
        imported_count = cursor.rowcount
        cnx.commit()

        cursor.close()
        cnx.close()

        print(json.dumps({
            'status': 'SUCCESS',
            'imported_count': max(0, imported_count),
            'total_parsed': len(records),
            'message': f'Se importaron exitosamente {max(0, imported_count)} registros nuevos a la tabla bond_his.'
        }))

    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == '__main__':
    if len(sys.argv) >= 3:
        run_import(sys.argv[1], sys.argv[2])
    else:
        print(json.dumps({'error': 'Argumentos insuficientes'}))
