import openpyxl
import pandas as pd
import json
import sys
import os

filepath = r"C:\Users\super\DATOS\004. DatosBVG\2026_10\2026_10_03\003_VectorDePrecios\valores-permitidos_2026_10_03.xlsx"

if not os.path.exists(filepath):
    print(f"FILE NOT FOUND: {filepath}")
    sys.exit(1)

print(f"File found! Size: {os.path.getsize(filepath)} bytes")

wb = openpyxl.load_workbook(filepath, data_only=True)
sheet_names = wb.sheetnames
print(f"Sheet names ({len(sheet_names)}): {sheet_names}")

excel_file = pd.ExcelFile(filepath)

summary = {}

for sheet in sheet_names:
    df = pd.read_excel(excel_file, sheet_name=sheet)
    print("=" * 60)
    print(f"SHEET: {sheet}")
    print(f"Shape: {df.shape} (Rows: {df.shape[0]}, Cols: {df.shape[1]})")
    print("Columns:", list(df.columns))
    print("\nHead (top 3 rows):")
    print(df.head(3).to_string())
    print("\nData Types & Non-Null Counts:")
    print(df.info())
    print("-" * 60)
