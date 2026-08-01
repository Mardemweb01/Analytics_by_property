# ============================================================================
# MODULO: extractores/vendors.py
# OBJETIVO: leer la tabla "Vendors" (proveedores) de Sage 50 via la conexion
# ya abierta (conexion.py) y devolverla como una lista de dicts.
# ============================================================================


# Sage devuelve Balance como texto con separador de miles (ej. "1,234.56")
# o None si el campo esta vacio -- normaliza a float, pero preserva None: no
# es lo mismo "no habia balance" que "el balance era cero", y mapear a 0.0 aca
# borraria esa distincion antes de que nadie pueda verla. Resolverla es
# trabajo de staging (COALESCE).
def _num(v):
    if v is None:
        return None
    return float(str(v).replace(",", "").strip())


# Lee todos los proveedores de una sola pasada -- no filtra por PH ni por
# estado; ese filtrado queda para quien consuma esta lista.
def extraer_vendors(conn):
    """Devuelve todas las filas de Vendors como lista de dicts:
    vendor_id, nombre, saldo, vendor_record_number."""
    cursor = conn.cursor()
    cursor.execute(
        'SELECT "VendorID", "Name", "Balance", "VendorRecordNumber" '
        'FROM "Vendors"'
    )
    filas = []
    for vendor_id, nombre, saldo, record_number in cursor.fetchall():
        filas.append({
            "vendor_id": str(vendor_id).strip() if vendor_id else None,
            "nombre": str(nombre).strip() if nombre else None,
            "saldo": _num(saldo),
            "vendor_record_number": int(record_number) if record_number else None,
        })
    return filas
