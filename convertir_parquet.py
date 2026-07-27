# ============================================================================
# MODULO: convertir_parquet.py
# OBJETIVO: leer los .json que dejo extraer_y_guardar.py en data/ (generados
# en la maquina con Sage, Python 32-bit) y convertirlos a Parquet -- pensado
# para correr en la OTRA PC, sin el ODBC de Sage y con Python de 64 bits, que
# es donde si hay wheels de pandas/pyarrow.
#
# Uso:
#   python convertir_parquet.py
# ============================================================================

import sys
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).parent / "data"


def main():
    archivos_json = sorted(DATA_DIR.glob("*.json"))
    if not archivos_json:
        print(f"No hay .json en {DATA_DIR}")
        return 1

    for origen in archivos_json:
        df = pd.read_json(origen)
        destino = origen.with_suffix(".parquet")
        df.to_parquet(destino, index=False)
        print(f"{origen.name} ({len(df)} filas) -> {destino.name}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
