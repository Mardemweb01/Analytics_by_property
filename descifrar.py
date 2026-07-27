# ============================================================================
# MODULO: descifrar.py
# OBJETIVO: revertir cifrar.py -- pensado para correr en la OTRA PC, despues
# de clonar el repo. Necesita clave.key en la misma carpeta (transferida por
# fuera de git, nunca commiteada).
#
# Uso:
#   python descifrar.py
# ============================================================================

import sys
from pathlib import Path

from cryptography.fernet import Fernet

DATA_DIR = Path(__file__).parent / "data"
CLAVE_PATH = Path(__file__).parent / "clave.key"


def main():
    if not CLAVE_PATH.exists():
        print(f"Falta {CLAVE_PATH} -- copiala desde la maquina que cifro los datos (no viaja por git).")
        return 1

    fernet = Fernet(CLAVE_PATH.read_bytes())

    archivos = sorted(DATA_DIR.glob("*.json.enc"))
    if not archivos:
        print(f"No hay .json.enc en {DATA_DIR}")
        return 1

    for origen in archivos:
        descifrado = fernet.decrypt(origen.read_bytes())
        destino = origen.with_suffix("")  # quita el ".enc"
        destino.write_bytes(descifrado)
        print(f"{origen.name} -> {destino.name}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
