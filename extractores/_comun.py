# ============================================================================
# MODULO: extractores/_comun.py
# OBJETIVO: helper compartido para traer TODAS las columnas de una tabla de
# Sage, tal cual, sin elegir un subconjunto. Elegir columnas en la extraccion
# es en si una transformacion -- va contra la regla de bronze ("copia fiel,
# no se transforma nada", ver modelo/bronze/01_tablas.sql). Los nombres de
# columna quedan exactamente como los devuelve Sage (PascalCase), no se
# renombran a snake_case -- ese renombre tambien era una transformacion
# silenciosa que hacia cada extractor por separado.
# ============================================================================

import datetime
import decimal


# Convierte un valor ODBC a algo serializable en JSON sin perder informacion:
#   Decimal -> float (los montos vienen como Decimal via pyodbc)
#   date/datetime -> str (ISO)
#   bytes/bytearray -> hex string (columnas BINARY/GUID de Sage)
#   el resto (int, str, None) ya es serializable tal cual
def _valor_json(v):
    if v is None:
        return None
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, (datetime.date, datetime.datetime)):
        return str(v)
    if isinstance(v, (bytes, bytearray)):
        return v.hex()
    return v


# Trae todas las filas y todas las columnas de una tabla de Sage. No filtra,
# no renombra, no descarta nada -- eso es trabajo de staging, no de bronze.
def extraer_tabla(conn, tabla: str) -> list[dict]:
    """Devuelve todas las filas de `tabla` como lista de dicts, con TODAS
    sus columnas, usando los nombres de columna exactos de Sage."""
    cursor = conn.cursor()
    columnas = [c.column_name for c in cursor.columns(table=tabla)]
    if not columnas:
        raise RuntimeError(f'No se encontraron columnas para la tabla "{tabla}"')

    seleccion = ", ".join(f'"{c}"' for c in columnas)
    cursor.execute(f'SELECT {seleccion} FROM "{tabla}"')

    filas = []
    for fila in cursor.fetchall():
        filas.append({col: _valor_json(val) for col, val in zip(columnas, fila)})
    return filas


# Devuelve nombre, tipo ODBC y tamano de cada columna de `tabla`, sin traer
# datos -- es lo que necesita modelo/generar_bronze.py para armar el DDL sin
# tener que volver a conectarse a Sage. Se guarda junto a la extraccion
# (<tabla>_schema.json) porque el esquema puede variar entre PH (distinta
# version de Sage, distinto plan de cuentas con columnas custom).
def obtener_esquema(conn, tabla: str) -> list[dict]:
    """Lista de {columna, tipo, tamano} para cada columna de `tabla`, en el
    mismo orden que devuelve extraer_tabla()."""
    # pyodbc no expone un atributo "column_size" en las filas de
    # cursor.columns() pese a lo que sugiere la doc de ODBC -- el nombre real
    # es "precision" (confirmado contra datos reales: en VARCHAR coincide
    # con el largo declarado, en DECIMAL es la cantidad total de digitos).
    cursor = conn.cursor()
    return [
        {"columna": c.column_name, "tipo": c.type_name, "tamano": c.precision}
        for c in cursor.columns(table=tabla)
    ]
