# ============================================================================
# MODULO: extractores/movimientos.py
# OBJETIVO: leer los movimientos contables crudos de Sage 50 (join de
# "JrnlRow" + "JrnlHdr" por PostOrder) via la conexion ya abierta
# (conexion.py) y devolverlos como lista de dicts, sin agrupar ni calcular
# saldos -- eso queda para quien consuma esta extraccion.
# ============================================================================


# Sage devuelve Amount como texto con separador de miles (ej. "1,234.56")
# o None si el campo esta vacio -- normaliza a float para poder sumarlo.
def _num(v):
    if v is None:
        return 0.0
    return float(str(v).replace(",", "").strip())


# Trae los movimientos crudos via INNER JOIN JrnlRow+JrnlHdr, sin agrupar
# por cuenta ni por fecha -- descarta filas sin cuenta o sin fecha porque
# no se pueden ubicar en ningun estado de cuenta.
def extraer_movimientos(conn):
    """Devuelve todas las filas de JrnlRow+JrnlHdr como lista de dicts:
    gl_acct_number, fecha, monto, journal, referencia, descripcion,
    customer_record_number, vendor_record_number, date_cleared.
    Descarta filas sin cuenta contable o sin fecha."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT "JrnlRow"."GLAcntNumber", "JrnlHdr"."TransactionDate", "JrnlRow"."Amount",
               "JrnlRow"."Journal", "JrnlHdr"."Reference", "JrnlRow"."RowDescription",
               "JrnlRow"."CustomerRecordNumber", "JrnlRow"."VendorRecordNumber", "JrnlRow"."DateCleared"
        FROM "JrnlRow"
        INNER JOIN "JrnlHdr" ON "JrnlRow"."PostOrder" = "JrnlHdr"."PostOrder"
    """)
    filas = []
    for gl, fecha, monto, journal, ref, desc, cust, vend, cleared in cursor.fetchall():
        if gl is None or fecha is None:
            continue
        filas.append({
            "gl_acct_number": int(gl),
            "fecha": str(fecha),
            "monto": _num(monto),
            "journal": int(journal) if journal is not None else None,
            "referencia": str(ref).strip() if ref else None,
            "descripcion": str(desc).strip() if desc else None,
            "customer_record_number": int(cust) if cust else None,
            "vendor_record_number": int(vend) if vend else None,
            "date_cleared": str(cleared) if cleared else None,
        })
    return filas
