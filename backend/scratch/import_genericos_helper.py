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
            
        # Leer el Excel con skiprows=9
        df = pd.read_excel(excel_file_path, sheet_name=sheet_target, skiprows=9)
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
        col_rend = find_key(['RENDIMIENTO %', 'RENDIMIENTO'])
        col_tir_tea = find_key(['TIR / TEA', 'TIR/TEA', 'TIR', 'TEA'])
        col_plazo = find_key(['PLAZO POR VENCER', 'PLAZO'])
        col_interes = find_key(['INTERÉS %', 'INTERES %', 'INTERES'])
        col_vn = find_key(['VALOR NOMINAL (USD)', 'VALOR NOMINAL'])
        col_ve = find_key(['VALOR EFECTIVO (USD)', 'VALOR EFECTIVO'])
        col_f_emis = find_key(['FECHA DE EMISIÓN', 'FECHA DE EMISION', 'F. EMISION', 'FECHA EMISION'])
        col_f_venc = find_key(['FECHA VENCIMIENTO', 'FECHA DE VENCIMIENTO', 'F. VENCIMIENTO'])
        col_proc = find_key(['PROCEDENCIA'])
        col_titulo = find_key(['TÍTULO', 'TITULO'])
        col_mercado = find_key(['MERCADO.1', 'TIPO DE MERCADO', 'MERCADO'])

        col_map = {
            'fecha': col_fecha,
            'emisor': col_emisor,
            'precio': col_precio,
            'rend': col_rend,
            'tir_tea': col_tir_tea,
            'plazo': col_plazo,
            'interes': col_interes,
            'vn': col_vn,
            've': col_ve,
            'f_emis': col_f_emis,
            'f_venc': col_f_venc,
            'proc': col_proc,
            'titulo': col_titulo,
            'mercado': col_mercado
        }

        cnx = mysql.connector.connect(**db_config)
        cursor = cnx.cursor()

        # Recrear tabla de staging 'genericos_his_jao'
        cursor.execute("DROP TABLE IF EXISTS genericos_his_jao")
        cursor.execute("""
            CREATE TABLE genericos_his_jao (
                FECHA DATETIME,
                EMISOR VARCHAR(255),
                PRECIO_PORC DOUBLE,
                RENDIMIENTO DOUBLE,
                TIR_TEA VARCHAR(100),
                PLAZO_DIAS INT,
                INTERES DOUBLE,
                VALOR_NOMINAL DOUBLE,
                VALOR_EFECTIVO DOUBLE,
                EMISION DATETIME,
                VENCIMIENTO DATETIME,
                PROCEDENCIA VARCHAR(50),
                TITULO VARCHAR(100),
                MERCADO VARCHAR(50)
            )
        """)

        insert_stmt = """
            INSERT INTO genericos_his_jao (
                FECHA, EMISOR, PRECIO_PORC, RENDIMIENTO, TIR_TEA, PLAZO_DIAS, INTERES,
                VALOR_NOMINAL, VALOR_EFECTIVO, EMISION, VENCIMIENTO, PROCEDENCIA, TITULO, MERCADO
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        records = []
        for _, row in df.iterrows():
            fecha = safe_date(get_col_val(row, col_map, 'fecha'))
            emisor = safe_str(get_col_val(row, col_map, 'emisor'))
            if not fecha or not emisor:
                continue

            precio = safe_float(get_col_val(row, col_map, 'precio'))
            rend = safe_float(get_col_val(row, col_map, 'rend'))
            tir_tea = safe_str(get_col_val(row, col_map, 'tir_tea'))
            plazo = safe_int(get_col_val(row, col_map, 'plazo'))
            interes = safe_float(get_col_val(row, col_map, 'interes'))
            vn = safe_float(get_col_val(row, col_map, 'vn'))
            ve = safe_float(get_col_val(row, col_map, 've'))
            f_emis = safe_date(get_col_val(row, col_map, 'f_emis'))
            f_venc = safe_date(get_col_val(row, col_map, 'f_venc'))
            proc = safe_str(get_col_val(row, col_map, 'proc'))
            titulo = safe_str(get_col_val(row, col_map, 'titulo'))
            mercado = safe_str(get_col_val(row, col_map, 'mercado'))

            records.append((
                fecha, emisor, precio, rend, tir_tea, plazo, interes,
                vn, ve, f_emis, f_venc, proc, titulo, mercado
            ))

        if records:
            batch_size = 500
            for i in range(0, len(records), batch_size):
                batch = records[i:i + batch_size]
                cursor.executemany(insert_stmt, batch)
            cnx.commit()

        # Insertar de forma incremental en 'genericos_his'
        sql_insert = """
            INSERT INTO genericos_his (
                FECHA, EMISOR, PRECIO_PORC, RENDIMIENTO, TIR_TEA, PLAZO_DIAS, INTERES,
                VALOR_NOMINAL, VALOR_EFECTIVO, EMISION, VENCIMIENTO, PROCEDENCIA, TITULO, MERCADO
            )
            SELECT 
                FECHA, EMISOR, PRECIO_PORC, RENDIMIENTO, TIR_TEA, PLAZO_DIAS, INTERES,
                VALOR_NOMINAL, VALOR_EFECTIVO, EMISION, VENCIMIENTO, PROCEDENCIA, TITULO, MERCADO
            FROM genericos_his_jao
            WHERE EMISOR IS NOT NULL
              AND FECHA > (SELECT IFNULL(MAX(FECHA), '2000-01-01') FROM genericos_his)
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
            'message': f'Se importaron exitosamente {max(0, imported_count)} registros nuevos a la tabla genericos_his.'
        }))

    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == '__main__':
    if len(sys.argv) >= 3:
        run_import(sys.argv[1], sys.argv[2])
    else:
        print(json.dumps({'error': 'Argumentos insuficientes'}))
