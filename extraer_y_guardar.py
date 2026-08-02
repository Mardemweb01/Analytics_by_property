# ============================================================================
# MODULO: extraer_y_guardar.py
# OBJETIVO: correr los 5 extractores de Sage 50 (Chart, Customers, Vendors,
# JrnlRow, JrnlHdr) contra un DSN real y guardar el resultado como JSON en
# data/. JrnlRow y JrnlHdr se extraen por separado, sin cruzarlas -- el join
# por PostOrder es trabajo de staging, no de la extraccion.
#
# Por que JSON y no Parquet directo: esta maquina solo puede tener Python de
# 32 bits (lo exige el driver ODBC de Sage), y pandas/pyarrow no publican
# wheels para Windows 32-bit -- no se pueden instalar aca. JSON es stdlib,
# sin dependencias nuevas. La conversion a Parquet se hace aparte, con
# convertir_parquet.py, corrido en la otra PC (64-bit, sin esa restriccion).
#
# Uso:
#   python extraer_y_guardar.py DSN_NOMBRE
# ============================================================================

import argparse
import json
import sys
from pathlib import Path

from conexion import conectar
from extractores._comun import obtener_esquema
from extractores.chart import extraer_chart
from extractores.customers import extraer_customers
from extractores.vendors import extraer_vendors
from extractores.movimientos import extraer_jrnlrow, extraer_jrnlhdr

DATA_DIR = Path(__file__).parent / "data"

EXTRACTORES = {
    "chart": extraer_chart,
    "customers": extraer_customers,
    "vendors": extraer_vendors,
    "jrnlrow": extraer_jrnlrow,
    "jrnlhdr": extraer_jrnlhdr,
}

# Nombre de tabla real en Sage para cada extractor -- hace falta para pedir
# el esquema (obtener_esquema no puede inferirlo del nombre corto del
# extractor, ej. "jrnlrow" -> "JrnlRow").
TABLA_SAGE = {
    "chart": "Chart",
    "customers": "Customers",
    "vendors": "Vendors",
    "jrnlrow": "JrnlRow",
    "jrnlhdr": "JrnlHdr",
}


def main():
    parser = argparse.ArgumentParser(
        description="Extrae Chart/Customers/Vendors/JrnlRow/JrnlHdr de Sage 50 y los guarda como JSON"
    )
    parser.add_argument("dsn", help="Nombre del DSN ODBC del PH")
    args = parser.parse_args()

    print(f"Conectando a {args.dsn}...")
    conn = conectar(args.dsn)

    DATA_DIR.mkdir(exist_ok=True)

    for nombre, extraer in EXTRACTORES.items():
        print(f"Extrayendo {nombre}...")
        filas = extraer(conn)
        destino = DATA_DIR / f"{nombre}.json"
        destino.write_text(json.dumps(filas, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  {len(filas)} filas -> {destino}")

        esquema = obtener_esquema(conn, TABLA_SAGE[nombre])
        destino_esquema = DATA_DIR / f"{nombre}_schema.json"
        destino_esquema.write_text(json.dumps(esquema, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  {len(esquema)} columnas -> {destino_esquema}")

    conn.close()
    print("\nListo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
