# ============================================================================
# MODULO: extraer_y_guardar.py
# OBJETIVO: correr los 4 extractores de Sage 50 (Chart, Customers, Vendors,
# Movimientos) contra un DSN real y guardar el resultado como JSON en data/.
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
from extractores.chart import extraer_chart
from extractores.customers import extraer_customers
from extractores.vendors import extraer_vendors
from extractores.movimientos import extraer_movimientos

DATA_DIR = Path(__file__).parent / "data"

EXTRACTORES = {
    "chart": extraer_chart,
    "customers": extraer_customers,
    "vendors": extraer_vendors,
    "movimientos": extraer_movimientos,
}


def main():
    parser = argparse.ArgumentParser(
        description="Extrae Chart/Customers/Vendors/Movimientos de Sage 50 y los guarda como Parquet"
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

    conn.close()
    print("\nListo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
