# ============================================================================
# MODULO: cifrar.py
# OBJETIVO: cifrar los .json que dejo extraer_y_guardar.py en data/ antes de
# commitear -- el repo es publico, pero los datos (clientes, proveedores,
# movimientos contables) son reales y no deben quedar legibles en GitHub.
#
# Usa Fernet (cifrado simetrico, cryptography) con una clave local en
# clave.key -- ese archivo NUNCA se commitea (esta en .gitignore). Hay que
# pasarlo a la otra PC por un canal aparte de git (USB, gestor de
# contrasenas, etc.), nunca subirlo al repo.
#
# Uso:
#   python cifrar.py            # cifra todos los .json de data/
# ============================================================================

import sys
from pathlib import Path

from cryptography.fernet import Fernet

DATA_DIR = Path(__file__).parent / "data"
CLAVE_PATH = Path(__file__).parent / "clave.key"


def obtener_clave():
    if CLAVE_PATH.exists():
        return CLAVE_PATH.read_bytes()
    clave = Fernet.generate_key()
    CLAVE_PATH.write_bytes(clave)
    print(f"Clave nueva generada en {CLAVE_PATH} -- copiala a la otra PC por fuera de git.")
    return clave


def main():
    fernet = Fernet(obtener_clave())

    archivos = sorted(DATA_DIR.glob("*.json"))
    if not archivos:
        print(f"No hay .json en {DATA_DIR}")
        return 1

    for origen in archivos:
        cifrado = fernet.encrypt(origen.read_bytes())
        destino = origen.with_suffix(origen.suffix + ".enc")
        destino.write_bytes(cifrado)
        print(f"{origen.name} -> {destino.name}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
