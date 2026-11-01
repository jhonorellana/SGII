import sys
import json
import pandas as pd
import mysql.connector

# Patch openpyxl RGB color error common in BVG generated Excel files
try:
    import openpyxl.styles.colors
    _orig_rgb_set = openpyxl.styles.colors.RGB.__set__
    def _safe_rgb_set(self, instance, value):
        try:
            _orig_rgb_set(self, instance, value)
        except Exception:
            instance.__dict__[self.name] = str(value)
    openpyxl.styles.colors.RGB.__set__ = _safe_rgb_set
except Exception:
    pass

def safe_float(val, default=0.0):
    if pd.isna(val) or val is None or str(val).strip() == '':
        return default
    try:
        return float(val)
    except:
        return default

def safe_str(val, max_len=None):
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    if s == '':
        return None
    if max_len and len(s) > max_len:
        return s[:max_len]
    return s

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

def find_header_row(excel_file_path, sheet_name=None):
    """Detecta automáticamente en qué fila se encuentran los encabezados."""
    try:
        df_preview = pd.read_excel(excel_file_path, sheet_name=sheet_name or 0, header=None, nrows=10)
        for idx, row in df_preview.iterrows():
            row_str = " ".join([str(v).upper() for v in row.values if pd.notnull(v)])
            if 'FECHA' in row_str and ('TITULO' in row_str or 'TÍTULO' in row_str or 'PRECIO' in row_str):
                return idx
    except Exception:
        pass
    return 2 # Default para BVG_NotasDeCredito.xlsx

def run_import(excel_file_path, force_all=False):
    db_config = {
        'host': '127.0.0.1',
        'user': 'root',
        'password': '',
        'database': 'inversion',
        'port': 3306
    }
    
    try:
        xls = pd.ExcelFile(excel_file_path)
        sheet_target = 'Base' if 'Base' in xls.sheet_names else xls.sheet_names[0]
        
        header_row = find_header_row(excel_file_path, sheet_target)
        df = pd.read_excel(excel_file_path, sheet_name=sheet_target, skiprows=header_row)
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

        col_fecha = find_key(['FECHA NEGOCIACIÓN', 'FECHA NEGOCIACION', 'FECHA'])
        col_titulo = find_key(['TÍTULO', 'TITULO', 'VALOR'])
        col_emisor = find_key(['EMISOR'])
        col_precio = find_key(['PRECIO', 'PRECIO %'])
        col_mercado = find_key(['MERCADO'])
        col_vn = find_key(['VALOR NOMINAL', 'VALOR NOMINAL (USD)', 'VN'])
        col_ve = find_key(['VALOR EFECTIVO', 'VALOR EFECTIVO (USD)', 'VE'])
        col_casa_comp = find_key(['CASA COMPRADORA', 'COMPRADOR', 'CASA_COMPRADORA'])
        col_casa_vend = find_key(['CASA VENDEDORA', 'VENDEDOR', 'CASA_VENDEDORA'])
        col_bolsa = find_key(['BOLSA'])

        cnx = mysql.connector.connect(**db_config)
        cursor = cnx.cursor()

        # 1. Asegurar tabla destino notas_credito_his
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS `notas_credito_his` (
                `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                `FECHA` DATE NOT NULL,
                `TITULO` VARCHAR(60) NOT NULL,
                `EMISOR` VARCHAR(150) NOT NULL,
                `PRECIO_PORC` DOUBLE NOT NULL,
                `MERCADO` VARCHAR(30) NULL,
                `VALOR_NOMINAL` DECIMAL(14,2) NOT NULL,
                `VALOR_EFECTIVO` DECIMAL(14,2) NOT NULL,
                `CASA_COMPRADORA` VARCHAR(120) NULL,
                `CASA_VENDEDORA` VARCHAR(120) NULL,
                `BOLSA` VARCHAR(10) NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX `idx_nc_fecha` (`FECHA`),
                INDEX `idx_nc_titulo` (`TITULO`),
                INDEX `idx_nc_emisor` (`EMISOR`),
                INDEX `idx_nc_casa_comp` (`CASA_COMPRADORA`),
                INDEX `idx_nc_casa_vend` (`CASA_VENDEDORA`),
                INDEX `idx_nc_precio` (`PRECIO_PORC`),
                INDEX `idx_nc_bolsa` (`BOLSA`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)

        # 2. Recrear tabla de staging notas_credito_his_jao
        cursor.execute("DROP TABLE IF EXISTS notas_credito_his_jao")
        cursor.execute("""
            CREATE TABLE notas_credito_his_jao (
                FECHA DATE,
                TITULO VARCHAR(60),
                EMISOR VARCHAR(150),
                PRECIO_PORC DOUBLE,
                MERCADO VARCHAR(30),
                VALOR_NOMINAL DECIMAL(14,2),
                VALOR_EFECTIVO DECIMAL(14,2),
                CASA_COMPRADORA VARCHAR(120),
                CASA_VENDEDORA VARCHAR(120),
                BOLSA VARCHAR(10)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """)

        insert_staging_stmt = """
            INSERT INTO notas_credito_his_jao (
                FECHA, TITULO, EMISOR, PRECIO_PORC, MERCADO,
                VALOR_NOMINAL, VALOR_EFECTIVO, CASA_COMPRADORA, CASA_VENDEDORA, BOLSA
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        records = []
        for _, row in df.iterrows():
            fecha = safe_date(row[col_fecha]) if col_fecha and col_fecha in row else None
            if not fecha:
                continue

            titulo = safe_str(row[col_titulo], 60) if col_titulo and col_titulo in row else 'NOTA DE CREDITO'
            emisor = safe_str(row[col_emisor], 150) if col_emisor and col_emisor in row else 'SERVICIO DE RENTAS INTERNAS'
            precio = safe_float(row[col_precio]) if col_precio and col_precio in row else 0.0
            mercado = safe_str(row[col_mercado], 30) if col_mercado and col_mercado in row else 'Secundario'
            vn = safe_float(row[col_vn]) if col_vn and col_vn in row else 0.0
            ve = safe_float(row[col_ve]) if col_ve and col_ve in row else 0.0
            casa_comp = safe_str(row[col_casa_comp], 120) if col_casa_comp and col_casa_comp in row else None
            casa_vend = safe_str(row[col_casa_vend], 120) if col_casa_vend and col_casa_vend in row else None
            bolsa = safe_str(row[col_bolsa], 10) if col_bolsa and col_bolsa in row else 'BVG'

            records.append((
                fecha, titulo, emisor, precio, mercado,
                vn, ve, casa_comp, casa_vend, bolsa or 'BVG'
            ))

        if records:
            batch_size = 2000
            for i in range(0, len(records), batch_size):
                batch = records[i:i + batch_size]
                cursor.executemany(insert_staging_stmt, batch)
            cnx.commit()

        # 3. Inserción en notas_credito_his
        if force_all:
            cursor.execute("TRUNCATE TABLE notas_credito_his")
            sql_insert = """
                INSERT INTO notas_credito_his (
                    FECHA, TITULO, EMISOR, PRECIO_PORC, MERCADO,
                    VALOR_NOMINAL, VALOR_EFECTIVO, CASA_COMPRADORA, CASA_VENDEDORA, BOLSA
                )
                SELECT 
                    FECHA, TITULO, EMISOR, PRECIO_PORC, MERCADO,
                    VALOR_NOMINAL, VALOR_EFECTIVO, CASA_COMPRADORA, CASA_VENDEDORA, BOLSA
                FROM notas_credito_his_jao
                WHERE FECHA IS NOT NULL AND EMISOR IS NOT NULL
            """
        else:
            # Incremental: sólo registros con fecha posterior a la última fecha en BD
            cursor.execute("SELECT MAX(FECHA) FROM notas_credito_his")
            max_row = cursor.fetchone()
            max_fecha = max_row[0] if max_row and max_row[0] else None

            if max_fecha is None:
                # BD vacía: importar todo
                sql_insert = """
                    INSERT INTO notas_credito_his (
                        FECHA, TITULO, EMISOR, PRECIO_PORC, MERCADO,
                        VALOR_NOMINAL, VALOR_EFECTIVO, CASA_COMPRADORA, CASA_VENDEDORA, BOLSA
                    )
                    SELECT 
                        FECHA, TITULO, EMISOR, PRECIO_PORC, MERCADO,
                        VALOR_NOMINAL, VALOR_EFECTIVO, CASA_COMPRADORA, CASA_VENDEDORA, BOLSA
                    FROM notas_credito_his_jao
                    WHERE FECHA IS NOT NULL AND EMISOR IS NOT NULL
                """
            else:
                sql_insert = """
                    INSERT INTO notas_credito_his (
                        FECHA, TITULO, EMISOR, PRECIO_PORC, MERCADO,
                        VALOR_NOMINAL, VALOR_EFECTIVO, CASA_COMPRADORA, CASA_VENDEDORA, BOLSA
                    )
                    SELECT 
                        FECHA, TITULO, EMISOR, PRECIO_PORC, MERCADO,
                        VALOR_NOMINAL, VALOR_EFECTIVO, CASA_COMPRADORA, CASA_VENDEDORA, BOLSA
                    FROM notas_credito_his_jao
                    WHERE FECHA IS NOT NULL AND EMISOR IS NOT NULL
                      AND FECHA > %s
                """

        if not force_all and max_fecha is not None:
            cursor.execute(sql_insert, (max_fecha,))
        else:
            cursor.execute(sql_insert)

        imported_count = cursor.rowcount
        cnx.commit()

        # Obtener nueva fecha máxima y total de registros
        cursor.execute("SELECT MAX(FECHA), COUNT(*) FROM notas_credito_his")
        stats = cursor.fetchone()
        new_max_fecha = str(stats[0]) if stats and stats[0] else None
        total_in_db = stats[1] if stats else 0

        cursor.close()
        cnx.close()

        print(json.dumps({
            'status': 'SUCCESS',
            'imported_count': max(0, imported_count),
            'total_parsed': len(records),
            'total_in_db': total_in_db,
            'last_date_in_db': new_max_fecha,
            'message': f'Se procesaron {len(records)} registros del archivo. Se insertaron {max(0, imported_count)} registros nuevos a notas_credito_his.'
        }))

    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == '__main__':
    if len(sys.argv) >= 2:
        excel_path = sys.argv[1]
        force = len(sys.argv) >= 3 and sys.argv[2].lower() in ['--force', 'force', 'true', '1']
        run_import(excel_path, force_all=force)
    else:
        print(json.dumps({'error': 'Argumentos insuficientes: ruta del archivo Excel requerida'}))

