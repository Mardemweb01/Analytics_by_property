# ============================================================================
# MODULO: extractores/chart.py
# OBJETIVO: leer la tabla "Chart" (plan de cuentas) de Sage 50 via la conexion
# ya abierta (conexion.py) y devolverla como una lista de dicts.
#
# Trae TODAS las columnas (185 en la version revisada), incluidas las 171
# columnas Balance0Dr/Cr/Net...BalanceNDr/Cr/Net -- el saldo por periodo que
# usan los reportes nativos de Sage. Ver COLUMNAS_SAGE.md para el detalle de
# por que estas columnas importan y las salvedades de uso (el indice de
# periodo no es estatico).
# ============================================================================

from extractores._comun import extraer_tabla


def extraer_chart(conn):
    """Devuelve todas las filas de Chart como lista de dicts, con todas sus
    columnas tal cual las nombra Sage (AccountID, AccountType, GLAcntNumber,
    Balance0Dr, Balance0Cr, Balance0Net, ...)."""
    return extraer_tabla(conn, "Chart")
