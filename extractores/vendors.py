# ============================================================================
# MODULO: extractores/vendors.py
# OBJETIVO: leer la tabla "Vendors" (proveedores) de Sage 50 via la conexion
# ya abierta (conexion.py) y devolverla como una lista de dicts.
#
# Trae TODAS las columnas (139 en la version revisada). No se confirmo
# todavia si tiene el mismo patron de columnas por periodo que Customers
# (Sales1..42/Payments1..42) -- si lo tiene, ahora viene incluido igual.
# ============================================================================

from extractores._comun import extraer_tabla


def extraer_vendors(conn):
    """Devuelve todas las filas de Vendors como lista de dicts, con todas sus
    columnas tal cual las nombra Sage (VendorID, Name, Balance,
    VendorRecordNumber, ...)."""
    return extraer_tabla(conn, "Vendors")
