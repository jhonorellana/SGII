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
            return val.strftime('%Y-%m-%d')
        dt = pd.to_datetime(val, errors='coerce')
        if pd.isna(dt):
            return safe_str(val)
        return dt.strftime('%Y-%m-%d')
    except:
        return safe_str(val)

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
            
        # Leer el Excel con skiprows=7
        df = pd.read_excel(excel_file_path, sheet_name=sheet_target, skiprows=7)
        df = df.dropna(how='all')
        
        if df.empty:
            print(json.dumps({'status': 'SUCCESS', 'imported_count': 0, 'message': 'No hay datos en el archivo Excel.'}))
            return

        cols = {str(c).strip(): c for c in df.columns}
        
        def find_key(candidates):
            for candidate in candidates:
                for c_clean, c_orig in cols.items():
                    c_upper = c_clean.upper()
                    cand_upper = candidate.upper()
                    if cand_upper == c_upper or cand_upper in c_upper:
                        return c_orig
            return None

        col_fecha = find_key(['FECHA'])
        col_emisor = find_key(['EMISOR'])
        col_precio = find_key(['PRECIO %', 'PRECIO'])
        col_vn = find_key(['VALOR NOMINAL (USD)', 'VALOR NOMINAL'])
        col_ve = find_key(['VALOR EFECTIVO (USD)', 'VALOR EFECTIVO'])
        col_f_emis = find_key(['F. EMISION', 'FECHA EMISION', 'FECHA DE EMISION'])
        col_f_venc = find_key(['F. VENCIMIENTO', 'FECHA VENCIMIENTO', 'FECHA DE VENCIMIENTO'])
        col_rend = find_key(['RENDIMIENTO %', 'RENDIMIENTO'])
        col_proc = find_key(['PROCEDENCIA'])
        col_obs = find_key(['OBSERVACIONES'])

        col_map = {
            'fecha': col_fecha,
            'emisor': col_emisor,
            'precio': col_precio,
            'vn': col_vn,
            've': col_ve,
            'f_emis': col_f_emis,
            'f_venc': col_f_venc,
            'rend': col_rend,
            'proc': col_proc,
            'obs': col_obs
        }

        cnx = mysql.connector.connect(**db_config)
        cursor = cnx.cursor()

        # Recrear tabla de staging 'facturas_his_jao'
        cursor.execute("DROP TABLE IF EXISTS facturas_his_jao")
        cursor.execute("""
            CREATE TABLE facturas_his_jao (
                FECHA DATETIME,
                EMISOR VARCHAR(255),
                PRECIO_PORC DOUBLE,
                VALOR_NOMINAL DOUBLE,
                VALOR_EFECTIVO DOUBLE,
                EMISION DATETIME,
                VENCIMIENTO DATETIME,
                RENDIMIENTO DOUBLE,
                PROCEDENCIA VARCHAR(50),
                OBSERVACIONES TEXT
            )
        """)

        insert_stmt = """
            INSERT INTO facturas_his_jao (
                FECHA, EMISOR, PRECIO_PORC, VALOR_NOMINAL, VALOR_EFECTIVO,
                EMISION, VENCIMIENTO, RENDIMIENTO, PROCEDENCIA, OBSERVACIONES
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        records = []
        for _, row in df.iterrows():
            fecha = safe_date(get_col_val(row, col_map, 'fecha'))
            emisor = safe_str(get_col_val(row, col_map, 'emisor'))
            if not fecha or not emisor:
                continue

            precio = safe_float(get_col_val(row, col_map, 'precio'))
            vn = safe_float(get_col_val(row, col_map, 'vn'))
            ve = safe_float(get_col_val(row, col_map, 've'))
            f_emis = safe_date(get_col_val(row, col_map, 'f_emis'))
            f_venc = safe_date(get_col_val(row, col_map, 'f_venc'))
            rend = safe_float(get_col_val(row, col_map, 'rend'))
            proc = safe_str(get_col_val(row, col_map, 'proc'))
            obs = safe_str(get_col_val(row, col_map, 'obs'))

            records.append((
                fecha, emisor, precio, vn, ve,
                f_emis, f_venc, rend, proc, obs
            ))

        if records:
            batch_size = 500
            for i in range(0, len(records), batch_size):
                batch = records[i:i + batch_size]
                cursor.executemany(insert_stmt, batch)
            cnx.commit()

        # Insertar de forma incremental en 'facturas_his'
        sql_insert = """
            INSERT INTO facturas_his (
                FECHA, EMISOR, PRECIO_PORC, VALOR_NOMINAL, VALOR_EFECTIVO,
                EMISION, VENCIMIENTO, RENDIMIENTO, PROCEDENCIA, OBSERVACIONES
            )
            SELECT 
                FECHA, EMISOR, PRECIO_PORC, VALOR_NOMINAL, VALOR_EFECTIVO,
                EMISION, VENCIMIENTO, RENDIMIENTO, PROCEDENCIA, OBSERVACIONES
            FROM facturas_his_jao
            WHERE EMISOR IS NOT NULL
              AND FECHA > (SELECT IFNULL(MAX(FECHA), '2000-01-01') FROM facturas_his)
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
            'message': f'Se importaron exitosamente {max(0, imported_count)} registros nuevos a la tabla facturas_his.'
        }))

    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == '__main__':
    if len(sys.argv) >= 3:
        run_import(sys.argv[1], sys.argv[2])
    else:
        print(json.dumps({'error': 'Argumentos insuficientes'}))
