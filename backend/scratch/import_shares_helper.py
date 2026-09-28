import sys
import json
import pandas as pd
import mysql.connector

def run_import(excel_file_path, aaaa):
    db_config = {
        'host': '127.0.0.1',
        'user': 'root',
        'password': '',
        'database': 'inversion',
        'port': 3306
    }
    
    try:
        # 1. Leer el Excel desde la hoja del año omitiendo las 8 filas de título
        df = pd.read_excel(excel_file_path, sheet_name=str(aaaa), skiprows=8, usecols=lambda x: x not in [0])
        df = df.dropna(how='all')
        
        if df.empty:
            print(json.dumps({'status': 'SUCCESS', 'imported_count': 0, 'message': 'No hay datos en el archivo Excel.'}))
            return

        cnx = mysql.connector.connect(**db_config)
        cursor = cnx.cursor()

        # 2. Recrear tabla temporal staging 'shares_jao'
        cursor.execute("DROP TABLE IF EXISTS shares_jao")
        cursor.execute("""
            CREATE TABLE shares_jao (
                FECHA DATETIME,
                EMISOR VARCHAR(255),
                VALOR VARCHAR(255),
                `VALOR NOMINAL` DOUBLE,
                PRECIO DOUBLE,
                `NUMERO ACCIONES` DOUBLE,
                `VALOR EFECTIVO` DOUBLE,
                PROCEDENCIA VARCHAR(10)
            )
        """)

        # 3. Cargar registros a staging
        insert_stmt = """
            INSERT INTO shares_jao (FECHA, EMISOR, VALOR, `VALOR NOMINAL`, PRECIO, `NUMERO ACCIONES`, `VALOR EFECTIVO`, PROCEDENCIA)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        records = []
        for _, row in df.iterrows():
            fecha = row.get('FECHA')
            emisor = str(row.get('EMISOR', '')).strip()
            valor = str(row.get('VALOR', '')).strip()
            v_nominal = float(row.get('VALOR NOMINAL', 0) or 0)
            precio = float(row.get('PRECIO', 0) or 0)
            cant = float(row.get('NUMERO ACCIONES', 0) or 0)
            v_efectivo = float(row.get('VALOR EFECTIVO', 0) or 0)
            procedencia = str(row.get('PROCEDENCIA', 'Q')).strip()

            if pd.notnull(fecha) and cant > 0:
                fecha_str = fecha.strftime('%Y-%m-%d %H:%M:%S') if hasattr(fecha, 'strftime') else str(fecha)
                records.append((fecha_str, emisor, valor, v_nominal, precio, cant, v_efectivo, procedencia))

        if records:
            batch_size = 500
            for i in range(0, len(records), batch_size):
                batch = records[i:i + batch_size]
                cursor.executemany(insert_stmt, batch)
            cnx.commit()

        # 4. Insertar de manera incremental a la tabla principal 'shares'
        sql_insert = """
            INSERT INTO shares (
                `SHA_ISSUER_ID`, `SHA_DATE`, `SHA_ISSUER`, `SHA_TYPE`, `SHA_NOMINAL_VALUE`, 
                `SHA_PRICE`, `SHA_NUMBER`, `SHA_CASH_VALUE`, `SHA_PROVENANCE`
            ) 
            SELECT 
                '1', FECHA, EMISOR, VALOR, `VALOR NOMINAL`, 
                PRECIO, `NUMERO ACCIONES`, `VALOR EFECTIVO`, PROCEDENCIA 
            FROM shares_jao 
            WHERE `NUMERO ACCIONES` <> 0 
              AND fecha >= (SELECT DATE_ADD(IFNULL(MAX(SHA_DATE), '2000-01-01'), INTERVAL 1 DAY) FROM shares)
        """
        cursor.execute(sql_insert)
        imported_count = cursor.rowcount

        # 5. Homologar SHA_ISSUER_ID con la tabla dictionary
        sql_update_dict = """
            UPDATE shares A 
            JOIN dictionary D ON A.SHA_ISSUER = D.DIC_VALUE 
            SET A.SHA_ISSUER_ID = D.DIC_ID
            WHERE A.SHA_ISSUER_ID = '1' OR A.SHA_ISSUER_ID IS NULL
        """
        cursor.execute(sql_update_dict)
        cnx.commit()

        cursor.close()
        cnx.close()

        print(json.dumps({
            'status': 'SUCCESS',
            'imported_count': max(0, imported_count),
            'message': f'Se importaron exitosamente {max(0, imported_count)} registros nuevos en la tabla shares.'
        }))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == '__main__':
    if len(sys.argv) >= 3:
        run_import(sys.argv[1], sys.argv[2])
    else:
        print(json.dumps({'error': 'Argumentos insuficientes'}))