# ============================================================================
# MODULO: ver_chart.py
# OBJETIVO: correr extractores/chart.py contra un DSN real y mostrar el
# resultado por terminal, sin pasar por Excel. Util para probar el extractor
# a mano mientras no esta conectado a exportar_excel.py.
#
# Uso:
#   python ver_chart.py DSN_NOMBRE [--limite 20]
# ============================================================================

import argparse
import sys

from conexion import conectar
from extractores.chart import extraer_chart


def main():
    parser = argparse.ArgumentParser(
        description="Prueba manual: Sage 50 (Chart) -> terminal"
    )
    parser.add_argument("dsn", help="Nombre del DSN ODBC del PH")
    parser.add_argument(
        "--limite", type=int, default=20,
        help="Cuantas filas imprimir (default: 20, 0 = todas)"
    )
    args = parser.parse_args()

    print(f"Conectando a {args.dsn}...")
    conn = conectar(args.dsn)

    print("Extrayendo Chart...")
    filas = extraer_chart(conn)
    conn.close()
    print(f"  {len(filas)} cuentas\n")

    a_mostrar = filas if args.limite == 0 else filas[:args.limite]

    encabezado = f"{'AccountID':<12} {'Tipo':<6} {'GLAcnt':<8} {'Descripcion'}"
    print(encabezado)
    print("-" * len(encabezado))

    for fila in a_mostrar:
        print(
            f"{fila['account_id']:<12} "
            f"{fila['account_type']:<6} "
            f"{fila['gl_acct_number']:<8} "
            f"{fila['account_description']}"
        )

    if args.limite and len(filas) > args.limite:
        print(f"\n... y {len(filas) - args.limite} mas (usa --limite 0 para verlas todas)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
