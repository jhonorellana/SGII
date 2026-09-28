import os
import sys
import json
import pandas as pd
import mysql.connector
from datetime import datetime

# Añadir ruta para importar config_utils si existe en DescargaDiaria
sys.path.append('C:/PROYECTOS/DescargaDiaria')
sys.path.append('C:/PROYECTOS/SIPRO_07/DescargaArchivos')

try:
    from config_utils import config_manager
    db_config = config_manager.get_database_config()
except Exception as e:
    # Fallback db_config si config_manager falla
    db_config = {
        'host': 'localhost',
        'user': 'root',
        'password': '',
        'database': 'inversion'
    }

def clean_val(val):
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (int, float)):
        return val
    s = str(val).strip()
    if s == '' or s.lower() == 'nan' or s.lower() == 'null':
        return None
    return s

def clean_date(val):
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.strftime('%Y-%m-%d')
    s = str(val).strip()
    if s == '' or s.lower() == 'nan' or s.lower() == 'null':
        return None
    try:
        dt = pd.to_datetime(s)
        return dt.strftime('%Y-%m-%d')
    except Exception:
        return None

def clean_num(val):
    if pd.isna(val) or val is None:
        return None
    try:
        return float(val)
    except Exception:
        return None

def clean_int(val):
    if pd.isna(val) or val is None:
        return None
    try:
        return int(float(val))
    except Exception:
        return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "ERROR", "message": "Ruta de archivo Excel no especificada"}))
        sys.exit(1)

    excel_path = sys.argv[1]
    sheet_year = sys.argv[2] if len(sys.argv) > 2 else datetime.now().strftime("%Y")

    if not os.path.exists(excel_path):
        print(json.dumps({"status": "ERROR", "message": f"El archivo no existe: {excel_path}"}))
        sys.exit(1)

    try:
        xl = pd.ExcelFile(excel_path)
        sheet_name = sheet_year if sheet_year in xl.sheet_names else xl.sheet_names[0]
        
        df = pd.read_excel(excel_path, sheet_name=sheet_name, skiprows=8)
    except Exception as e:
        print(json.dumps({"status": "ERROR", "message": f"Error leyendo Excel: {str(e)}"}))
        sys.exit(1)

    # Validar columna EMISOR y FECHA
    if 'EMISOR' not in df.columns or 'FECHA' not in df.columns:
        print(json.dumps({"status": "ERROR", "message": "El archivo Excel no tiene el formato esperado (columnas EMISOR o FECHA faltantes)"}))
        sys.exit(1)

    df = df.dropna(subset=['EMISOR'])
    df = df[df['EMISOR'].astype(str).str.strip() != '']

    if df.empty:
        print(json.dumps({"status": "SUCCESS", "imported_count": 0, "message": "No hay filas con emisor válido en el archivo Excel"}))
        sys.exit(0)

    try:
        cnx = mysql.connector.connect(**db_config)
        cursor = cnx.cursor()

        # Obtener última fecha registrada en obligaciones_his
        cursor.execute("SELECT IFNULL(MAX(FECHA), '2000-01-01') FROM obligaciones_his")
        row = cursor.fetchone()
        max_fecha_db = str(row[0]) if row and row[0] else '2000-01-01'

        # Formatear la fecha en df
        df['FECHA_STR'] = df['FECHA'].apply(clean_date)
        df_new = df[df['FECHA_STR'] > max_fecha_db].copy()

        if df_new.empty:
            cursor.close()
            cnx.close()
            print(json.dumps({
                "status": "SUCCESS",
                "imported_count": 0,
                "message": f"No hay nuevos registros de obligaciones posteriores a la fecha {max_fecha_db} en la BD",
                "max_fecha_db": max_fecha_db
            }))
            sys.exit(0)

        # Mapeo de nombres de columnas Excel
        col_precio = 'PRECIO %' if 'PRECIO %' in df_new.columns else ('PRECIO %%' if 'PRECIO %%' in df_new.columns else 'PRECIO')
        col_rend = 'RENDIMIENTO %' if 'RENDIMIENTO %' in df_new.columns else ('RENDIMIENTO %%' if 'RENDIMIENTO %%' in df_new.columns else 'RENDIMIENTO')
        col_plazo = 'PLAZO POR VENCER (DÍAS)' if 'PLAZO POR VENCER (DÍAS)' in df_new.columns else 'PLAZO'
        col_interes = 'INTERES %' if 'INTERES %' in df_new.columns else ('INTERES %%' if 'INTERES %%' in df_new.columns else 'INTERES')
        col_tir = 'TIR / TEA' if 'TIR / TEA' in df_new.columns else 'TIR_TEA'
        col_nom_orig = 'VALOR NOMINAL ORIGINAL (USD)' if 'VALOR NOMINAL ORIGINAL (USD)' in df_new.columns else 'VALOR NOMINAL ORIGINAL'
        col_nom = 'VALOR NOMINAL (USD)' if 'VALOR NOMINAL (USD)' in df_new.columns else 'VALOR NOMINAL'
        col_efec = 'VALOR EFECTIVO (USD)' if 'VALOR EFECTIVO (USD)' in df_new.columns else 'VALOR EFECTIVO'
        col_emision = 'FECHA EMISIÓN' if 'FECHA EMISIÓN' in df_new.columns else ('FECHA EMISIóN' if 'FECHA EMISIóN' in df_new.columns else 'EMISION')
        col_venc = 'FECHA VENCIMIENTO' if 'FECHA VENCIMIENTO' in df_new.columns else 'VENCIMIENTO'
        col_titulo = 'NOMBRE TITULO' if 'NOMBRE TITULO' in df_new.columns else 'NOMBRE_TITULO'
        col_procedencia = 'PROCEDENCIA'
        col_tipo_mercado = 'TIPO DE MERCADO' if 'TIPO DE MERCADO' in df_new.columns else 'TIPO MERCADO'

        rows_to_insert = []
        for _, r in df_new.iterrows():
            f_fecha = clean_date(r.get('FECHA'))
            f_emisor = clean_val(r.get('EMISOR'))
            f_precio = clean_num(r.get(col_precio))
            f_rend = clean_num(r.get(col_rend))
            f_plazo = clean_int(r.get(col_plazo))
            f_interes = clean_num(r.get(col_interes))
            f_tir = clean_num(r.get(col_tir))
            f_nom_orig = clean_num(r.get(col_nom_orig))
            f_nom = clean_num(r.get(col_nom))
            f_efec = clean_num(r.get(col_efec))
            f_emision = clean_date(r.get(col_emision))
            f_venc = clean_date(r.get(col_venc))
            f_titulo = clean_val(r.get(col_titulo))
            f_procedencia = clean_val(r.get(col_procedencia))
            f_tipo_mercado = clean_val(r.get(col_tipo_mercado))

            if f_fecha and f_emisor:
                rows_to_insert.append((
                    f_fecha, f_emisor, f_precio, f_rend, f_plazo, f_interes,
                    f_tir, f_nom_orig, f_nom, f_efec, f_emision, f_venc,
                    f_titulo, f_procedencia, f_tipo_mercado
                ))

        if not rows_to_insert:
            cursor.close()
            cnx.close()
            print(json.dumps({"status": "SUCCESS", "imported_count": 0, "message": "No se procesaron filas válidas para insertar"}))
            sys.exit(0)

        insert_sql = """
            INSERT INTO obligaciones_his (
                FECHA, EMISOR, PRECIO_PORC, RENDIMIENTO, PLAZO_DIAS, INTERES,
                TIR_TEA, VALOR_NOMINAL_ORIGINAL, VALOR_NOMINAL, VALOR_EFECTIVO, EMISION, VENCIMIENTO,
                NOMBRE_TITULO, PROCEDENCIA, TIPO_MERCADO
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        # Inserción en lotes de 500
        chunk_size = 500
        total_inserted = 0
        for i in range(0, len(rows_to_insert), chunk_size):
            chunk = rows_to_insert[i:i + chunk_size]
            cursor.executemany(insert_sql, chunk)
            total_inserted += cursor.rowcount

        cnx.commit()
        cursor.close()
        cnx.close()

        print(json.dumps({
            "status": "SUCCESS",
            "imported_count": total_inserted,
            "message": f"Se importaron {total_inserted} registros nuevos de obligaciones exitosamente a 'obligaciones_his'."
        }))

    except mysql.connector.Error as err:
        print(json.dumps({"status": "ERROR", "message": f"Error MySQL: {str(err)}"}))
        sys.exit(1)
    except Exception as ex:
        print(json.dumps({"status": "ERROR", "message": f"Error general: {str(ex)}"}))
        sys.exit(1)

if __name__ == '__main__':
    main()
