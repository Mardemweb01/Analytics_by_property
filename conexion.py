# ============================================================================
# MODULO: conexion.py
# OBJETIVO: abrir la conexion ODBC a Pervasive SQL (Sage 50). Standalone --
# no importa nada del resto del repo, pero reutiliza las credenciales ya
# guardadas en el Credential Manager de Windows (servicio "mardem-sync")
# en vez de pedirlas de nuevo.
# ============================================================================

# os: para leer variables de entorno (DB_UID/DB_PWD), un atajo para no
#     depender de Credential Manager al probar el script a mano.
# re: para la regex que oculta la contraseña si un error de pyodbc la repite.
# pyodbc: el driver que habla ODBC con Pervasive SQL (Sage 50).
import os
import re

import pyodbc

# Nombre del "servicio" (target) bajo el que mardem-sync guardó las
# credenciales en el Credential Manager de Windows. Tiene que ser
# EXACTAMENTE el mismo string que usa mardem-sync/core/odbc.py, porque
# keyring busca por (servicio, usuario) -- si no calza, no encuentra nada.
_KEYRING_SERVICE = "mardem-sync"

# Detecta "UID=...", "PWD=...", "PASSWORD=...", "USER ID=..." dentro de un
# string (case-insensitive) para poder tapar el valor antes de imprimirlo.
# pyodbc a veces incluye el connection string completo en sus excepciones,
# y ese string trae la contraseña en texto plano.
_PATRON_CREDENCIALES = re.compile(r"(?i)\b(UID|PWD|PASSWORD|USER\s*ID)\s*=\s*[^;]*")


def _sanitizar(mensaje: str) -> str:
    """Tapa UID/PWD/PASSWORD/USER ID dentro de un mensaje de error de pyodbc,
    para que la contraseña nunca llegue a un log o a la consola."""
    return _PATRON_CREDENCIALES.sub(lambda m: f"{m.group(1)}=***", mensaje)


# Resuelve usuario/contraseña ODBC en dos pasos, en orden de prioridad:
#   1) variables de entorno DB_UID/DB_PWD (rápido para pruebas manuales)
#   2) Credential Manager de Windows, vía keyring, bajo el servicio
#      "mardem-sync" (lo normal: ya las guardó la app de escritorio)
# Si ninguna de las dos tiene algo, no hay forma de conectar -- se corta
# ahí con un mensaje claro en vez de dejar que pyodbc falle más adelante
# con un error críptico de "login failed".
def _obtener_credenciales():
    uid = os.getenv("DB_UID")
    pwd = os.getenv("DB_PWD")
    if uid and pwd:
        return uid, pwd

    try:
        import keyring
        uid = uid or keyring.get_password(_KEYRING_SERVICE, "db_uid")
        pwd = pwd or keyring.get_password(_KEYRING_SERVICE, "db_pwd")
    except Exception:
        pass

    if not uid or not pwd:
        raise RuntimeError(
            "Faltan credenciales ODBC: definí DB_UID/DB_PWD en el entorno, "
            "o guardalas antes con mardem-sync (comparten el mismo Credential Manager)."
        )
    return uid, pwd


# Punto de entrada del modulo: arma el connection string ODBC, abre la
# conexion contra el DSN indicado, y la configura como la espera Sage:
#   - autocommit=True: cada consulta se confirma sola, no hace falta
#     manejar transacciones (esto es solo lectura).
#   - latin1 en decode/encode: Sage/Pervasive guarda texto en esa
#     codificacion (tildes, ñ) -- sin esto, los nombres salen con caracteres
#     raros (mojibake).
# Si pyodbc falla (DSN mal escrito, credenciales invalidas, Sage cerrado),
# se relanza el error ya sanitizado para que no se filtre la contraseña.
def conectar(dsn: str, timeout: int = 15):
    """Conexion a Pervasive/Sage 50, autocommit + latin1."""
    uid, pwd = _obtener_credenciales()
    try:
        conn_string = f"DSN={dsn};UID={uid};PWD={pwd};"
        conn = pyodbc.connect(conn_string, autocommit=True, timeout=timeout)
        conn.setdecoding(pyodbc.SQL_CHAR, encoding="latin1")
        conn.setdecoding(pyodbc.SQL_WCHAR, encoding="latin1")
        conn.setencoding(encoding="latin1")
        return conn
    except pyodbc.Error as db_error:
        raise RuntimeError(f"No se pudo conectar a {dsn}: {_sanitizar(str(db_error))}")
