# ============================================================================
# MODULO: extractores/chart.py
# OBJETIVO: leer la tabla "Chart" (plan de cuentas) de Sage 50 via la conexion
# ya abierta (conexion.py) y devolverla como una lista de dicts.
# ============================================================================


# Lee el plan de cuentas completo de una sola pasada -- no filtra ni pagina,
# se asume que Chart tiene pocas filas (decenas/cientos), a diferencia de
# JrnlRow en movimientos.py.
def extraer_chart(conn):
    """Devuelve todas las filas de Chart como lista de dicts:
    account_id, account_type, account_description, gl_acct_number."""
    cursor = conn.cursor()
    cursor.execute(
        'SELECT "AccountID", "AccountType", "AccountDescription", "GLAcntNumber" '
        'FROM "Chart"'
    )
    filas = []
    for account_id, account_type, description, gl_acct_number in cursor.fetchall():
        filas.append({
            "account_id": str(account_id).strip(),
            "account_type": int(account_type),
            "account_description": str(description).strip() if description else None,
            "gl_acct_number": int(gl_acct_number),
        })
    return filas
