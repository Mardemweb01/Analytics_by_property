# ============================================================================
# MODULO: extractores/movimientos.py
# OBJETIVO: leer "JrnlRow" y "JrnlHdr" de Sage 50 via la conexion ya abierta
# (conexion.py) como dos extracciones separadas, espejo fiel de cada tabla --
# sin cruzarlas, sin descartar filas, sin elegir columnas.
#
# Trae TODAS las columnas de cada tabla (47 en JrnlRow, 168 en JrnlHdr en la
# version revisada), incluidos los flags (IncludeInGL, RowType, etc.) que
# antes quedaban afuera. Ver COLUMNAS_SAGE.md para el detalle de por que
# IncludeInGL es critico para cualquier consumidor de este dato.
# ============================================================================

from extractores._comun import extraer_tabla


def extraer_jrnlrow(conn):
    """Devuelve todas las filas de JrnlRow como lista de dicts, con todas sus
    columnas tal cual las nombra Sage (PostOrder, GLAcntNumber, Amount,
    Journal, IncludeInGL, RowType, ...)."""
    return extraer_tabla(conn, "JrnlRow")


def extraer_jrnlhdr(conn):
    """Devuelve todas las filas de JrnlHdr como lista de dicts, con todas sus
    columnas tal cual las nombra Sage (PostOrder, TransactionDate,
    Reference, ...)."""
    return extraer_tabla(conn, "JrnlHdr")
