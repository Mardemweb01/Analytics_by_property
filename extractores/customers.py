# ============================================================================
# MODULO: extractores/customers.py
# OBJETIVO: leer la tabla "Customers" de Sage 50 via la conexion ya abierta
# (conexion.py) y devolverla como una lista de dicts -- sin tocar Excel,
# sin tocar SQLite. Solo la extraccion.
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


# Lee todos los clientes de una sola pasada -- no filtra por PH, activo/
# inactivo ni nada; ese filtrado queda para quien consuma esta lista.
def extraer_customers(conn):
    """Devuelve todas las filas de Customers como lista de dicts:
    customer_id, nombre, saldo, customer_record_number."""
    cursor = conn.cursor()
    cursor.execute(
        'SELECT "CustomerID", "Customer_Bill_Name", "Balance", "CustomerRecordNumber" '
        'FROM "Customers"'
    )
    filas = []
    for customer_id, nombre, saldo, record_number in cursor.fetchall():
        filas.append({
            "customer_id": str(customer_id).strip() if customer_id else None,
            "nombre": str(nombre).strip() if nombre else None,
            "saldo": _num(saldo),
            "customer_record_number": int(record_number) if record_number else None,
        })
    return filas
