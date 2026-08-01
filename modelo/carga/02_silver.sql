-- ============================================================================
-- CARGA A SILVER -- de staging al esquema estrella.
--
-- FULL REFRESH: trunca y recarga. La extraccion ya trae "PostOrder"
-- (extractores/movimientos.py separa JrnlRow y JrnlHdr y expone la clave que
-- los vincula), asi que un upsert por post_order + indice de linea es
-- tecnicamente posible. Full refresh sigue siendo la decision actual porque a
-- 6,521 filas tarda segundos -- no porque el origen lo impida. Ver la nota en
-- silver/02_hechos.sql antes de migrar a incremental.
--
-- IDEMPOTENTE: correrlo dos veces seguidas da el mismo resultado. Si el
-- control de calidad aborta, se corrige el origen y se vuelve a correr sin
-- limpiar nada a mano.
--
-- NO se trunca silver.mapeo_cuenta: es el seed que mantiene una persona, no
-- algo derivado de Sage. Recargarlo aca borraria las reglas de negocio.
-- ============================================================================

TRUNCATE TABLE silver.fact_movimiento;
TRUNCATE TABLE silver.dim_cuenta;
TRUNCATE TABLE silver.dim_cliente;
TRUNCATE TABLE silver.dim_proveedor;
TRUNCATE TABLE silver.dim_fecha;
GO

-- ----------------------------------------------------------------------------
-- dim_fecha -- calendario generado, no extraido.
--
-- El rango sale de los propios movimientos: desde el primer dia del mes mas
-- viejo hasta el ultimo dia del mes mas nuevo. Se completa el mes entero a
-- proposito -- gold arma series cruzando periodos contra cuentas, y un mes
-- truncado dejaria huecos en los graficos.
--
-- Los numeros salen de un cruce de digitos (10^4 = 10,000 dias ~ 27 anios) en
-- vez de un CTE recursivo, que es mas portable entre motores.
-- ----------------------------------------------------------------------------
WITH digitos AS (
    SELECT n FROM (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) AS d(n)
),
numeros AS (
    SELECT d1.n + d2.n * 10 + d3.n * 100 + d4.n * 1000 AS n
    FROM digitos d1
    CROSS JOIN digitos d2
    CROSS JOIN digitos d3
    CROSS JOIN digitos d4
),
rango AS (
    SELECT
        DATEADD(MONTH, DATEDIFF(MONTH, '1900-01-01', MIN(fecha)), '1900-01-01') AS inicio,
        DATEADD(DAY, -1,
            DATEADD(MONTH, DATEDIFF(MONTH, '1900-01-01', MAX(fecha)) + 1, '1900-01-01')
        ) AS fin
    FROM staging.stg_movimientos
),
calendario AS (
    SELECT DATEADD(DAY, n.n, r.inicio) AS fecha, r.fin
    FROM numeros n
    CROSS JOIN rango r
)
INSERT INTO silver.dim_fecha
    (fecha_key, fecha, anio, trimestre, mes, nombre_mes, periodo_id, periodo_label, es_fin_de_mes)
SELECT
    YEAR(c.fecha) * 10000 + MONTH(c.fecha) * 100 + DAY(c.fecha),
    c.fecha,
    YEAR(c.fecha),
    (MONTH(c.fecha) - 1) / 3 + 1,
    MONTH(c.fecha),
    m.nombre,
    CONCAT(YEAR(c.fecha), '-', RIGHT(CONCAT('0', MONTH(c.fecha)), 2)),
    CONCAT(m.nombre, ' ', YEAR(c.fecha)),
    CASE WHEN MONTH(DATEADD(DAY, 1, c.fecha)) <> MONTH(c.fecha) THEN 1 ELSE 0 END
FROM calendario c
JOIN (VALUES
    ( 1, 'Enero'), ( 2, 'Febrero'), ( 3, 'Marzo'),     ( 4, 'Abril'),
    ( 5, 'Mayo'),  ( 6, 'Junio'),   ( 7, 'Julio'),     ( 8, 'Agosto'),
    ( 9, 'Septiembre'), (10, 'Octubre'), (11, 'Noviembre'), (12, 'Diciembre')
) AS m (mes, nombre) ON m.mes = MONTH(c.fecha)
WHERE c.fecha <= c.fin;
GO

-- ----------------------------------------------------------------------------
-- dim_cuenta -- plan de cuentas + decode + reglas de negocio.
--
-- El JOIN con el decode es INNER a proposito: una cuenta con account_type
-- desconocido NO entra al modelo. Queda reportada como ERROR en
-- vw_control_calidad y el orquestador aborta antes de que nadie vea un total
-- al que le faltan cuentas.
--
-- El JOIN con mapeo_cuenta es LEFT: una cuenta sin regla entra igual, con
-- todos los flags en 0 y rubro NULL. O sea que existe en el modelo pero no la
-- cuenta ninguna metrica -- se prefiere que quede afuera y se note (aparece
-- como AVISO) a que entre en silencio a un total.
-- ----------------------------------------------------------------------------
INSERT INTO silver.dim_cuenta
    (gl_acct_number, account_id, descripcion, account_type,
     tipo_cuenta, categoria, signo_natural,
     rubro, es_banco, es_fondo_reserva, es_por_cobrar)
SELECT
    c.gl_acct_number,
    c.account_id,
    c.descripcion,
    c.account_type,
    d.tipo_cuenta,
    d.categoria,
    d.signo_natural,
    m.rubro,
    COALESCE(m.es_banco, 0),
    COALESCE(m.es_fondo_reserva, 0),
    COALESCE(m.es_por_cobrar, 0)
FROM staging.stg_chart c
JOIN staging.vw_decode_account_type d ON d.account_type = c.account_type
LEFT JOIN silver.mapeo_cuenta m ON m.gl_acct_number = c.gl_acct_number;
GO

-- ----------------------------------------------------------------------------
-- dim_cliente / dim_proveedor
-- ----------------------------------------------------------------------------
INSERT INTO silver.dim_cliente
    (customer_record_number, customer_id, nombre, saldo_sage)
SELECT customer_record_number, customer_id, nombre, saldo_sage
FROM staging.stg_customers;
GO

INSERT INTO silver.dim_proveedor
    (vendor_record_number, vendor_id, nombre, saldo_sage)
SELECT vendor_record_number, vendor_id, nombre, saldo_sage
FROM staging.stg_vendors;
GO

-- ----------------------------------------------------------------------------
-- fact_movimiento -- el libro diario.
--
-- movimiento_key es un ROW_NUMBER(): NO es estable entre cargas. Ver la nota
-- en silver/02_hechos.sql -- el origen no da con que hacerla estable.
--
-- Las referencias a cliente y proveedor se anulan si el registro no existe en
-- su dimension. Dejar un id colgado que no resuelve produce joins que
-- descartan filas en gold sin que nada lo indique; en NULL, al menos el
-- movimiento sigue contando en los totales de la cuenta.
--
-- El JOIN con dim_cuenta es INNER: un movimiento contra una cuenta que no
-- existe en el plan no puede entrar a la estrella. vw_control_calidad lo
-- reporta como 'cuenta huerfana'.
-- ----------------------------------------------------------------------------
INSERT INTO silver.fact_movimiento
    (movimiento_key, fecha_key, gl_acct_number,
     customer_record_number, vendor_record_number,
     journal, referencia, descripcion, monto, fecha_conciliacion)
SELECT
    ROW_NUMBER() OVER (ORDER BY m.fecha, m.gl_acct_number, m.referencia),
    f.fecha_key,
    m.gl_acct_number,
    cl.customer_record_number,
    pr.vendor_record_number,
    m.journal,
    m.referencia,
    m.descripcion,
    m.monto,
    m.fecha_conciliacion
FROM staging.stg_movimientos m
JOIN silver.dim_fecha  f  ON f.fecha          = m.fecha
JOIN silver.dim_cuenta c  ON c.gl_acct_number = m.gl_acct_number
LEFT JOIN silver.dim_cliente   cl ON cl.customer_record_number = m.customer_record_number
LEFT JOIN silver.dim_proveedor pr ON pr.vendor_record_number   = m.vendor_record_number;
GO
