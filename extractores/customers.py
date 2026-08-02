# ============================================================================
# MODULO: extractores/customers.py
# OBJETIVO: leer la tabla "Customers" de Sage 50 via la conexion ya abierta
# (conexion.py) y devolverla como una lista de dicts -- sin tocar Excel,
# sin tocar SQLite. Solo la extraccion.
#
# Trae TODAS las columnas (153 en la version revisada), incluidas Sales1..42
# y Payments1..42 -- el monto facturado/cobrado por periodo, mismo patron que
# Chart.BalanceNNet pero por cliente. Ver COLUMNAS_SAGE.md.
# ============================================================================

from extractores._comun import extraer_tabla


def extraer_customers(conn):
    """Devuelve todas las filas de Customers como lista de dicts, con todas
    sus columnas tal cual las nombra Sage (CustomerID, Customer_Bill_Name,
    Balance, CustomerRecordNumber, Sales1..42, Payments1..42, ...)."""
    return extraer_tabla(conn, "Customers")
