import sys
import json
import pandas as pd
import mysql.connector

def safe_float(val):
    if pd.isna(val) or val is None or str(val).strip() == '' or str(val).strip() == '-':
        return None
    try:
        return float(val)
    except:
        return None

def safe_str(val):
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    return s if s != '' and s != '-' else None

def safe_date(val):
    if pd.isna(val) or val is None or str(val).strip() in ['', '-']:
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

def run_import(excel_file_path):
    db_config = {
        'host': '127.0.0.1',
        'user': 'root',
        'password': '',
        'database': 'inversion',
        'port': 3306
    }
    
    try:
        xls = pd.ExcelFile(excel_file_path)
        sheet_target = 'DIVIDENDOS' if 'DIVIDENDOS' in xls.sheet_names else xls.sheet_names[0]
            
        # Leer el Excel con skiprows=6
        df = pd.read_excel(excel_file_path, sheet_name=sheet_target, skiprows=6)
        df = df.dropna(how='all')
        
        if df.empty:
            print(json.dumps({'status': 'SUCCESS', 'imported_count': 0, 'message': 'No hay datos en el archivo Excel.'}))
            return

        cols = {str(c).strip(): c for c in df.columns}
        
        def find_col(candidates):
            for cand in candidates:
                for c_clean, c_orig in cols.items():
                    c_upper = c_clean.upper()
                    cand_upper = cand.upper()
                    if cand_upper == c_upper or cand_upper in c_upper:
                        return c_orig
            return None

        # Identificar cada una de las 24 columnas
        col_emisor_id = find_col(['CÓDIGO EMISOR', 'CODIGO EMISOR'])
        col_emisor = find_col(['EMISOR'])
        # Asegurar que EMISOR no tome CÓDIGO EMISOR
        if col_emisor and 'CÓDIGO' in str(col_emisor).upper():
            col_emisor = None
            for c_clean, c_orig in cols.items():
                if c_clean.upper() == 'EMISOR':
                    col_emisor = c_orig
                    break

        col_f_resol = find_col(['FECHA DE RESOLUCION', 'FECHA RESOLUCION'])
        col_f_ult_der = find_col(['FECHA ULTIMO DERECHO', 'ULTIMO DERECHO'])
        col_f_pago = find_col(['FECHA DE PAGO', 'FECHA PAGO'])
        col_vn = find_col(['VALOR NOMINAL'])
        col_acc_antes = find_col(['NUMERO DE ACCIONES CIRCULANTES ANTES DE PAGO DE DIVIDENDOS', 'CIRCULANTES ANTES'])
        col_ult_precio = find_col(['ULTIMO PRECIO'])
        col_f_ult_precio = find_col(['FECHA ULTIMO PRECIO'])
        col_div_ef = find_col(['DIVIDENDO EFECTIVO'])
        # Evitar tomar DIVIDENDO EF. POR ACCION para DIVIDENDO EFECTIVO
        if col_div_ef and 'POR ACCION' in str(col_div_ef).upper():
            col_div_ef = None
            for c_clean, c_orig in cols.items():
                if c_clean.upper() == 'DIVIDENDO EFECTIVO':
                    col_div_ef = c_orig
                    break

        col_div_ef_acc = find_col(['DIVIDENDO EF. POR ACCION', 'POR ACCION'])
        col_precio_ajus_ef = find_col(['PRECIO AJUSTADO CON DIVIDENDO EFECTIVO'])
        col_aum_dism = find_col(['AUMENTO O DISMINUCIÓN DE CAPITAL', 'AUMENTO O DISMINUCION DE CAPITAL'])
        col_aum_susc = find_col(['AUMENTO POR SUSCRIPCION'])
        col_cap_ant = find_col(['CAPITAL ANTERIOR'])
        col_acc_antig = find_col(['NUMERO ACCIONES ANTIGUAS'])
        col_cap_luego = find_col(['CAPITAL LUEGO DEL EVENTO'])
        col_acc_totales = find_col(['NUMERO ACCIONES TOTALES'])
        col_aum_cap_ant = find_col(['AUMENTO DE CAPITAL / CAPITAL ANTERIOR'])
        col_factor_corr = find_col(['FACTOR DE CORRECCION'])
        col_precio_ajus = find_col(['PRECIO AJUSTADO'])
        if col_precio_ajus and 'CON DIVIDENDO' in str(col_precio_ajus).upper():
            col_precio_ajus = None
            for c_clean, c_orig in cols.items():
                if c_clean.upper() == 'PRECIO AJUSTADO':
                    col_precio_ajus = c_orig
                    break

        col_circular = find_col(['CIRCULAR'])
        col_util_anio = find_col(['UTILIDAD NETA DEL AÑO', 'UTILIDAD NETA DEL AÑO'])
        col_revision = find_col(['REVISION'])

        col_map = {
            'emisor_id': col_emisor_id,
            'emisor': col_emisor,
            'f_resol': col_f_resol,
            'f_ult_der': col_f_ult_der,
            'f_pago': col_f_pago,
            'vn': col_vn,
            'acc_antes': col_acc_antes,
            'ult_precio': col_ult_precio,
            'f_ult_precio': col_f_ult_precio,
            'div_ef': col_div_ef,
            'div_ef_acc': col_div_ef_acc,
            'precio_ajus_ef': col_precio_ajus_ef,
            'aum_dism': col_aum_dism,
            'aum_susc': col_aum_susc,
            'cap_ant': col_cap_ant,
            'acc_antig': col_acc_antig,
            'cap_luego': col_cap_luego,
            'acc_totales': col_acc_totales,
            'aum_cap_ant': col_aum_cap_ant,
            'factor_corr': col_factor_corr,
            'precio_ajus': col_precio_ajus,
            'circular': col_circular,
            'util_anio': col_util_anio,
            'revision': col_revision
        }

        cnx = mysql.connector.connect(**db_config)
        cursor = cnx.cursor()

        # Recrear staging table
        cursor.execute("DROP TABLE IF EXISTS dividendos_his_jao")
        cursor.execute("""
            CREATE TABLE dividendos_his_jao (
                emisor_id DOUBLE,
                emisor TEXT,
                fecha_resolucion TEXT,
                fecha_ultimo_derecho DATE,
                fecha_pago TEXT,
                valor_nominal DOUBLE,
                acciones_antes_dividendos DOUBLE,
                ultimo_precio DOUBLE,
                fecha_ultimo_precio TEXT,
                dividendo_efectivo DOUBLE,
                dividendo_ef_por_accion DOUBLE,
                precio_ajus_div_efectivo DOUBLE,
                aum_dism_capital DOUBLE,
                aumento_suscripcion DOUBLE,
                capital_anterior DOUBLE,
                acciones_antiguas DOUBLE,
                capital_luego_evento DOUBLE,
                acciones_totales DOUBLE,
                aum_capital_capital_anterior DOUBLE,
                factor_correccion DOUBLE,
                precio_ajustado DOUBLE,
                circular TEXT,
                utilidad_neta_anio DOUBLE,
                revision TEXT
            )
        """)

        insert_stmt = """
            INSERT INTO dividendos_his_jao (
                emisor_id, emisor, fecha_resolucion, fecha_ultimo_derecho, fecha_pago,
                valor_nominal, acciones_antes_dividendos, ultimo_precio, fecha_ultimo_precio,
                dividendo_efectivo, dividendo_ef_por_accion, precio_ajus_div_efectivo,
                aum_dism_capital, aumento_suscripcion, capital_anterior, acciones_antiguas,
                capital_luego_evento, acciones_totales, aum_capital_capital_anterior,
                factor_correccion, precio_ajustado, circular, utilidad_neta_anio, revision
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        def get_val(row, k):
            c = col_map.get(k)
            return row[c] if c and c in row else None

        records = []
        for _, row in df.iterrows():
            emisor = safe_str(get_val(row, 'emisor'))
            if not emisor:
                continue

            records.append((
                safe_float(get_val(row, 'emisor_id')),
                emisor,
                safe_str(get_val(row, 'f_resol')),
                safe_date(get_val(row, 'f_ult_der')),
                safe_str(get_val(row, 'f_pago')),
                safe_float(get_val(row, 'vn')),
                safe_float(get_val(row, 'acc_antes')),
                safe_float(get_val(row, 'ult_precio')),
                safe_str(get_val(row, 'f_ult_precio')),
                safe_float(get_val(row, 'div_ef')),
                safe_float(get_val(row, 'div_ef_acc')),
                safe_float(get_val(row, 'precio_ajus_ef')),
                safe_float(get_val(row, 'aum_dism')),
                safe_float(get_val(row, 'aum_susc')),
                safe_float(get_val(row, 'cap_ant')),
                safe_float(get_val(row, 'acc_antig')),
                safe_float(get_val(row, 'cap_luego')),
                safe_float(get_val(row, 'acc_totales')),
                safe_float(get_val(row, 'aum_cap_ant')),
                safe_float(get_val(row, 'factor_corr')),
                safe_float(get_val(row, 'precio_ajus')),
                safe_str(get_val(row, 'circular')),
                safe_float(get_val(row, 'util_anio')),
                safe_str(get_val(row, 'revision'))
            ))

        if records:
            batch_size = 500
            for i in range(0, len(records), batch_size):
                cursor.executemany(insert_stmt, records[i:i + batch_size])
                cnx.commit()

        # Reemplazar tabla final 'dividendos_his' con el consolidado histórico del archivo
        cursor.execute("TRUNCATE TABLE dividendos_his")
        
        sql_insert = """
            INSERT INTO dividendos_his (
                emisor_id, emisor, fecha_resolucion, fecha_ultimo_derecho, fecha_pago,
                valor_nominal, acciones_antes_dividendos, ultimo_precio, fecha_ultimo_precio,
                dividendo_efectivo, dividendo_ef_por_accion, precio_ajus_div_efectivo,
                aum_dism_capital, aumento_suscripcion, capital_anterior, acciones_antiguas,
                capital_luego_evento, acciones_totales, aum_capital_capital_anterior,
                factor_correccion, precio_ajustado, circular, utilidad_neta_anio, revision
            )
            SELECT 
                emisor_id, emisor, fecha_resolucion, fecha_ultimo_derecho, fecha_pago,
                valor_nominal, acciones_antes_dividendos, ultimo_precio, fecha_ultimo_precio,
                dividendo_efectivo, dividendo_ef_por_accion, precio_ajus_div_efectivo,
                aum_dism_capital, aumento_suscripcion, capital_anterior, acciones_antiguas,
                capital_luego_evento, acciones_totales, aum_capital_capital_anterior,
                factor_correccion, precio_ajustado, circular, utilidad_neta_anio, revision
            FROM dividendos_his_jao
            WHERE emisor IS NOT NULL
        """
        cursor.execute(sql_insert)
        imported_count = cursor.rowcount
        cnx.commit()

        # Homologar emisor_id contra el maestro de emisores sipro_desa.emisor
        try:
            cursor.execute("SELECT id_emisor, nombre, sigla FROM sipro_desa.emisor ORDER BY id_emisor ASC")
            master_emisores = cursor.fetchall()
            
            manual_overrides = {
                'BANCO DE LA PRODUCCIÓN S.A. PRODUBANCO': 6,
                'BANCO DE LA PRODUCCION S.A. PRODUBANCO': 6,
                'BANCO COFIEC S.A.': 4,
                'CORPORACIÓN MULTIBG S.A.': 52,
                'DOLMEN S.A.': None,
                'CENTRO GRAFICO': None,
            }

            def clean_str(s):
                if not s: return ""
                return str(s).upper().replace('.', ' ').replace(',', ' ').replace('-', ' ').replace('Á', 'A').replace('É', 'E').replace('Í', 'I').replace('Ó', 'O').replace('Ú', 'U').strip()

            cursor.execute("SELECT DISTINCT emisor FROM dividendos_his WHERE emisor IS NOT NULL")
            unique_emisores = [r[0] for r in cursor.fetchall()]

            for raw_name in unique_emisores:
                target_id = None
                if raw_name in manual_overrides:
                    target_id = manual_overrides[raw_name]
                else:
                    clean_raw = clean_str(raw_name)
                    best_match = None
                    best_score = 0
                    for m in master_emisores:
                        m_id, m_nombre, m_sigla = m[0], m[1], m[2]
                        m_name_clean = clean_str(m_nombre)
                        m_sigla_clean = clean_str(m_sigla)

                        raw_tokens = set(clean_raw.split()) - {'S', 'A', 'C', 'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'COMPAÑIA', 'CORPORACION', 'SOCIEDAD', 'ANONIMA'}
                        m_tokens = set(m_name_clean.split()) - {'S', 'A', 'C', 'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'COMPAÑIA', 'CORPORACION', 'SOCIEDAD', 'ANONIMA'}

                        common = raw_tokens.intersection(m_tokens)
                        score = len(common)
                        if m_sigla_clean and m_sigla_clean in raw_tokens:
                            score += 3
                        if score > best_score:
                            best_score = score
                            best_match = m_id
                    
                    if best_match and best_score >= 1:
                        target_id = best_match

                if target_id is not None:
                    cursor.execute("UPDATE dividendos_his SET emisor_id = %s WHERE emisor = %s", (target_id, raw_name))
            
            cnx.commit()
        except Exception as hex:
            pass

        cursor.close()
        cnx.close()

        print(json.dumps({
            'status': 'SUCCESS',
            'imported_count': max(0, imported_count),
            'total_parsed': len(records),
            'message': f'Se importaron exitosamente {max(0, imported_count)} registros de dividendos en dividendos_his.'
        }))

    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == '__main__':
    if len(sys.argv) >= 2:
        run_import(sys.argv[1])
    else:
        print(json.dumps({'error': 'Argumento de ruta de archivo no especificado'}))
