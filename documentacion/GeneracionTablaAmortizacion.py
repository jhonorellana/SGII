393import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import pandas as pd
from datetime import datetime, timedelta
import pymysql
from dateutil.relativedelta import relativedelta

def connect_to_database():
    database='inversion'
    conn = pymysql.connect(host="localhost",user="root",passwd="",db=database)
    return conn

def generate_files():
    conn = connect_to_database()
    cursor = conn.cursor()
    try:
        investment_id = entry_investment_id.get()
        payment_frequency = int(entry_payment_frequency.get() or 1)
        deferral_installments = int(entry_deferral_installments.get() or 0)
        amortization_type = entry_amortization_type.get()
        # Convertir de texto completo a código interno
        if amortization_type == "Alemana":
            amortization_type = "A"
        elif amortization_type == "Francesa":
            amortization_type = "F"

        sql="SELECT * FROM inversion WHERE id = %s"
        valores=(investment_id)
        cursor.execute(sql, valores)
        values = cursor.fetchone()
        columns = [i[0] for i in cursor.description]
        investment = pd.DataFrame([values], columns=columns)
        
        # Obtener primera fecha de pago desde la base de datos
        first_interest_payment_date = investment['inv_fecha_primer_pago'][0]
        
        # Obtener valores especiales para la primera cuota
        primer_mes_interes = investment['inv_interes_primer_mes'][0]
        interes_acumulado_previo = investment['inv_interes_acumulado_previo'][0]
        
        # Obtener fechas de pago de capital desde la base de datos
        capital_repayments_str = investment['inv_fechas_pagos_capital'][0]
        if capital_repayments_str and capital_repayments_str.strip():
            try:
                capital_repayments_dates = [datetime.strptime(d.strip(), '%Y-%m-%d') for d in capital_repayments_str.split(',')]
            except:
                capital_repayments_dates = []
        else:
            capital_repayments_dates = []
        principal = investment['inv_valor_nominal'][0]
        first_installment_date = investment['inv_fecha_emision'][0] + relativedelta(months=payment_frequency)
        maturity_date = investment['inv_fecha_vencimiento'][0]
        annual_interest_rate = investment['inv_tasa_interes'][0]
        amount_paid = investment['inv_capital_invertido'][0]-investment['inv_valor_interes'][0]

        payment_dates = []
        interest_payments = []
        principal_remaining = []
        principal_returned = []
        actual_principal_returned = []
        prize = []
        monthly_interest_rate = annual_interest_rate / 100 / 12 * payment_frequency
        
        current_date = first_installment_date

        while current_date <= maturity_date:
            payment_dates.append(current_date)
            next_month = current_date.month + payment_frequency if current_date.month + payment_frequency <= 12 else current_date.month + payment_frequency - 12
            next_year = current_date.year if current_date.month + payment_frequency <= 12 else current_date.year + 1
            current_date = datetime(next_year, next_month, maturity_date.day)
            current_date = current_date.date()
        
        if (len(capital_repayments_dates)>0):
            capital_repayments_dates = [d.date() for d in capital_repayments_dates]
        else:
            capital_repayments_dates = payment_dates[deferral_installments:]

        num_capital_repayments = len(capital_repayments_dates)
        
        remaining_principal = principal
        
        repayment_amount = round(principal / num_capital_repayments,2)
        principal_return = repayment_amount
        actual_principal_return = round(amount_paid / num_capital_repayments, 2)
        
        total_payment = (principal * monthly_interest_rate * pow(1+monthly_interest_rate,num_capital_repayments))/(pow(1+monthly_interest_rate,num_capital_repayments)-1)

        for date in payment_dates:
            interest_payment = remaining_principal * monthly_interest_rate
            interest_payments.append(round(interest_payment, 2))
            if date in capital_repayments_dates:
                if(amortization_type=='A'):
                    remaining_principal -= repayment_amount
                    principal_returned.append(repayment_amount)
                    actual_principal_returned.append(actual_principal_return)
                    prize.append(round(repayment_amount-actual_principal_return,2))
                elif(amortization_type=='F'):
                    repayment_amount = total_payment - interest_payment
                    remaining_principal -= repayment_amount
                    principal_returned.append(round(repayment_amount,2))
                    principal_equivalent=round(actual_principal_return*repayment_amount/principal_return,2)
                    actual_principal_returned.append(principal_equivalent)
                    prize.append(round(repayment_amount-principal_equivalent,2))
                else:
                    raise Exception("Tipo de amortización incorrecto.")
            else:
                principal_returned.append(0)
                actual_principal_returned.append(0)
                prize.append(0)
            principal_remaining.append(round(remaining_principal, 2))

        
        amortization_table = pd.DataFrame({
            "Fecha de Pago": payment_dates,
            "Capital Restante": principal_remaining,
            "Capital de retorno": principal_returned,
            "Capital Devuelto": actual_principal_returned,
            "Interés Parcial": interest_payments,
            "Premio": prize
            #"Interés Total": interest_payments + prize
        })
        
        amortization_table["Interes Total"] = amortization_table["Interés Parcial"] + amortization_table["Premio"]
        amortization_table["ID"] = investment_id
        amortization_table["Fecha de Vencimiento"] = maturity_date.strftime('%Y-%m-%d')
        amortization_table["Tasa nominal de interés anual"] = annual_interest_rate
        amortization_table["Flujo"] = amortization_table["Interés Parcial"] + amortization_table["Capital Devuelto"] + amortization_table["Premio"]
        #amortization_table = amortization_table.drop('Capital de retorno', axis=1)

        # Concatenate tables and sort by Fecha de Pago
        final_table = pd.concat([amortization_table], ignore_index=True)
        final_table = final_table.sort_values(by=["Fecha de Pago"])
        
        # Filtrar para mostrar solo registros mayores a la primera fecha de pago
        final_table = final_table[final_table['Fecha de Pago'] >= first_interest_payment_date]
        
        # Modificar la primera cuota con los valores de la base de datos
        if len(final_table) > 0:
            # Actualizar la primera fila con los valores de la base de datos
            final_table.iloc[0, final_table.columns.get_loc('Capital Devuelto')] = interes_acumulado_previo
            final_table.iloc[0, final_table.columns.get_loc('Interés Parcial')] = primer_mes_interes
            final_table.iloc[0, final_table.columns.get_loc('Interes Total')] = primer_mes_interes
            final_table.iloc[0, final_table.columns.get_loc('Flujo')] = primer_mes_interes + interes_acumulado_previo
        
        file_path_excel = filedialog.asksaveasfilename(defaultextension=".xlsx", filetypes=[("Excel files", "*.xlsx")], initialfile="TablaAmortizacion.xlsx")
        if file_path_excel:
            final_table.to_excel(file_path_excel, index=False, float_format="%.2f")
            messagebox.showinfo("Éxito", f"Archivo Excel guardado en: {file_path_excel}")
        
        sql="SELECT * FROM amortizacion WHERE inv_id = %s"
        valores=(investment_id)
        cursor.execute(sql, valores)
        values = cursor.fetchall()
        
        # if(len(values)>0):
        #     raise Exception(f"Ya existe una tabla de amortización para la inversión {investment_id} en la base de datos.") 
        # else:
        #     for _, row in final_table.iterrows():
        #         if row['Fecha de Pago'] >= first_interest_payment_date.date():
        #             sql="INSERT INTO amortizacion (inv_id, am_fecha_pago, am_interes, am_capital, am_descuento, am_retencion, am_pagada, is_active, is_deleted) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"
        #             valores=(row['ID'], row['Fecha de Pago'], row['Interés Mensual'], row['Capital Devuelto'], row['Premio'], 0, 0, 1, 0)
        #             cursor.execute(sql, valores)
        #             conn.commit()
                    
        #     messagebox.showinfo("Éxito", "Tabla generada en la base de datos.")
        
        
        # —– Generar archivo SQL en lugar de ejecutar los INSERT —–
        sql_path = filedialog.asksaveasfilename(
            defaultextension=".sql",
            filetypes=[("SQL files", "*.sql")],
            title="Guardar sentencias INSERT como...",
            initialfile="TablaAmortizacion.sql"
        )
        if sql_path:
            with open(sql_path, 'w', encoding='utf-8') as f_sql:
                for idx, row in final_table.iterrows():
                    # Si es la primera cuota, usar los valores de la base de datos
                    if idx == 0:
                        capital_valor = interes_acumulado_previo
                        interes_parcial_valor = primer_mes_interes
                        interes_total_valor = primer_mes_interes
                    else:
                        capital_valor = row['Capital Devuelto']
                        interes_parcial_valor = row['Interés Parcial']
                        interes_total_valor = row['Premio'] + row['Interés Parcial']
                    
                    stmt = (
                        f"INSERT INTO amortizacion "
                        f"(inv_id, am_fecha_pago, am_capital, am_int_parcial, am_descuento, am_interes, am_pagada) "
                        f"VALUES ({investment_id}, "
                        f"'{row['Fecha de Pago']}', "
                        f"{capital_valor:.2f}, "
                        f"{interes_parcial_valor:.2f}, "
                        f"{row['Premio']:.2f}, "
                        f"{interes_total_valor:.2f}, "                        
                        f" 0);"
                    )
                    f_sql.write(stmt + "\n")
                f_sql.write(f"UPDATE amortizacion SET is_active=0 where inv_id = {investment_id};\n")
                f_sql.write(f"UPDATE amortizacion set is_active = 1 where am_fecha_pago between curdate() and LAST_DAY(DATE_ADD(NOW(), INTERVAL 11 MONTH)) and inv_id = {investment_id};\n")
                f_sql.write(f"SELECT * from amortizacion where inv_id = {investment_id};\n")
            messagebox.showinfo("Archivo SQL generado",
                                f"Se ha creado el archivo de sentencias en:\n{sql_path}")
        else:
            messagebox.showwarning("Operación cancelada",
                                   "No se guardó ningún archivo SQL.")
        # —– Fin generación de archivo SQL —–
        
        
        
        
    except Exception as e:
        messagebox.showerror("Error", f"Ocurrió un error: {e}")

root = tk.Tk()
root.title("Generador de Tabla de Amortización")

labels = ["ID:",
          "Frecuencia de pago:",
          "Cantidad de cuotas a diferir:",
          "Tipo de amortizacion:",
         ]
entries = []

for i, label in enumerate(labels):
    tk.Label(root, text=label).grid(row=i, column=0, sticky='w', padx=10, pady=5)
    
    # Crear diferentes tipos de controles según el campo
    if label == "Frecuencia de pago:":
        # Dropdown para frecuencia de pago (1-12, por defecto 1)
        entry = ttk.Combobox(root, values=list(range(1, 13)), width=37)
        entry.set(1)
    elif label == "Cantidad de cuotas a diferir:":
        # Dropdown para cuotas a diferir (0-12, por defecto 0)
        entry = ttk.Combobox(root, values=list(range(0, 13)), width=37)
        entry.set(0)
    elif label == "Tipo de amortizacion:":
        # Dropdown para tipo de amortización (Alemana/Francesa, por defecto Alemana)
        entry = ttk.Combobox(root, values=['Alemana', 'Francesa'], width=37, state='readonly')
        entry.set('Alemana')
    else:
        # Entry normal para el ID
        entry = tk.Entry(root, width=40)
    
    entry.grid(row=i, column=1, padx=10, pady=5)
    entries.append(entry)

entry_investment_id, entry_payment_frequency, entry_deferral_installments, entry_amortization_type = entries

tk.Button(root, text="Generar Amortización y SQL", command=generate_files).grid(row=len(labels), columnspan=2, pady=10)

root.mainloop()
