# ============================================================================
# MODULO: extractores/movimientos.py
# OBJETIVO: leer "JrnlRow" y "JrnlHdr" de Sage 50 via la conexion ya abierta
# (conexion.py) como dos extracciones separadas, espejo fiel de cada tabla --
# sin cruzarlas, sin descartar filas, sin decidir que hacer con los nulos.
# Eso queda para quien consuma esta extraccion (staging.stg_movimientos hace
# el join por PostOrder).
# ============================================================================


# Sage devuelve Amount como texto con separador de miles (ej. "1,234.56")
# o None si el campo esta vacio -- normaliza a float, pero preserva None: no
# es lo mismo "no habia monto" que "el monto era cero", y esa distincion se
# pierde si se mapea a 0.0 aca. Resolverla es trabajo de staging (COALESCE).
def _num(v):
    if v is None:
        return None
    return float(str(v).replace(",", "").strip())


# Trae JrnlRow crudo, una fila por linea de asiento. No descarta lineas sin
# cuenta ni las numera de ninguna forma especial -- si PostOrder o
# GLAcntNumber vienen nulos, la fila se emite igual y queda para que
# vw_control_calidad la reporte despues del join.
def extraer_jrnlrow(conn):
    """Devuelve todas las filas de JrnlRow como lista de dicts:
    post_order, gl_acct_number, monto, journal, descripcion,
    customer_record_number, vendor_record_number, date_cleared."""
    cursor = conn.cursor()
    cursor.execute(
        'SELECT "PostOrder", "GLAcntNumber", "Amount", "Journal", "RowDescription", '
        '"CustomerRecordNumber", "VendorRecordNumber", "DateCleared" '
        'FROM "JrnlRow"'
    )
    filas = []
    for post_order, gl, monto, journal, desc, cust, vend, cleared in cursor.fetchall():
        filas.append({
            "post_order": int(post_order) if post_order is not None else None,
            "gl_acct_number": int(gl) if gl is not None else None,
            "monto": _num(monto),
            "journal": int(journal) if journal is not None else None,
            "descripcion": str(desc).strip() if desc else None,
            "customer_record_number": int(cust) if cust else None,
            "vendor_record_number": int(vend) if vend else None,
            "date_cleared": str(cleared) if cleared else None,
        })
    return filas


# Trae JrnlHdr crudo, un encabezado por asiento. Es lo que le da fecha y
# referencia a cada linea de JrnlRow via PostOrder.
def extraer_jrnlhdr(conn):
    """Devuelve todas las filas de JrnlHdr como lista de dicts:
    post_order, fecha, referencia."""
    cursor = conn.cursor()
    cursor.execute('SELECT "PostOrder", "TransactionDate", "Reference" FROM "JrnlHdr"')
    filas = []
    for post_order, fecha, ref in cursor.fetchall():
        filas.append({
            "post_order": int(post_order) if post_order is not None else None,
            "fecha": str(fecha) if fecha is not None else None,
            "referencia": str(ref).strip() if ref else None,
        })
    return filas
