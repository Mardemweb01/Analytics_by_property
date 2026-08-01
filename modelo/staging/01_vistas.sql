-- ============================================================================
-- CAPA STAGING -- tipado y limpieza. Sigue siendo 1:1 con el origen.
--
-- REGLA DE ESTA CAPA: una vista por tabla de bronze, con los mismos registros
-- y el mismo grano. Se convierte texto a fechas, se recortan espacios, se
-- descartan duplicados y se resuelve que hacer con los nulos. Lo que NO se
-- hace todavia: cruzar entidades entre si ni aplicar reglas de negocio. Eso
-- es silver.
--
-- SON VISTAS, NO TABLAS. A esta escala (6,521 movimientos) materializar no
-- aporta: una vista siempre esta fresca y elimina un paso de carga que podria
-- quedar desincronizado. Si algun dia el volumen lo pide, se convierten en
-- tablas sin tocar nada de silver.
--
-- Orden de despliegue: bronze -> STAGING -> silver -> gold.
-- ============================================================================

CREATE SCHEMA staging;
GO

-- ----------------------------------------------------------------------------
-- vw_lote_actual -- que corrida es la vigente.
--
-- bronze es append-only, asi que acumula una corrida por extraccion. Todo lo
-- de arriba tiene que mirar SOLO la ultima; sin este filtro, cada recarga
-- duplicaria los movimientos y los saldos saldrian multiplicados.
-- ----------------------------------------------------------------------------
CREATE VIEW staging.vw_lote_actual AS
SELECT DISTINCT lote_id
FROM bronze.lote
WHERE cargado_en = (SELECT MAX(cargado_en) FROM bronze.lote);
GO

-- ----------------------------------------------------------------------------
-- vw_decode_account_type -- codigos de Sage a categorias contables.
--
-- Vive en staging y no en silver porque es una traduccion mecanica de un
-- enumerado del origen, no una decision de modelado: no requiere criterio de
-- nadie.
--
-- Los codigos NO se adivinaron: se derivaron leyendo las descripciones reales
-- del plan de cuentas extraido (data/chart.json) y agrupando por tipo. Los 16
-- valores son los que aparecen en esa extraccion; la enumeracion de Sage tiene
-- huecos (3, 7, 9, 11, ...) que esa compania no usa.
--
-- OJO AL DESPLEGAR EN OTRO PH: cada propiedad es una compania Sage distinta y
-- puede usar tipos que esta no usa. Revalidar contra su plan de cuentas en vez
-- de asumir que sirve igual en todas -- vw_control_calidad lo detecta.
--
-- signo_natural: +1 deudora (activo, gasto), -1 acreedora (pasivo, patrimonio,
-- ingreso).
-- ----------------------------------------------------------------------------
CREATE VIEW staging.vw_decode_account_type AS
SELECT * FROM (VALUES
    ( 0, 'Activo',     'Efectivo',                  1),
    ( 1, 'Activo',     'Cuentas por Cobrar',        1),
    ( 2, 'Activo',     'Inventario',                1),
    ( 4, 'Activo',     'Otros Activos Corrientes',  1),
    ( 5, 'Activo',     'Activo Fijo',               1),
    ( 6, 'Activo',     'Depreciacion Acumulada',   -1),  -- contra-activo
    ( 8, 'Activo',     'Otros Activos',             1),
    (10, 'Pasivo',     'Cuentas por Pagar',        -1),
    (12, 'Pasivo',     'Otros Pasivos Corrientes', -1),
    (14, 'Pasivo',     'Pasivo a Largo Plazo',     -1),
    (16, 'Patrimonio', 'Capital',                  -1),
    (18, 'Patrimonio', 'Utilidades Retenidas',     -1),
    (19, 'Patrimonio', 'Distribuciones',            1),  -- reduce patrimonio
    (21, 'Ingreso',    'Ingresos',                 -1),
    (23, 'Gasto',      'Costo de Ventas',           1),
    (24, 'Gasto',      'Gastos',                    1)
) AS t (account_type, tipo_cuenta, categoria, signo_natural);
GO

-- ----------------------------------------------------------------------------
-- stg_chart -- plan de cuentas tipado.
--
-- Descarta filas sin gl_acct_number (no se pueden referenciar) y deduplica por
-- numero de cuenta quedandose con la ultima aparicion. Ambos casos los cuenta
-- vw_control_calidad: si aparecen, hay algo raro en el origen.
-- ----------------------------------------------------------------------------
CREATE VIEW staging.stg_chart AS
SELECT
    b.gl_acct_number,
    NULLIF(LTRIM(RTRIM(b.account_id)), '')          AS account_id,
    NULLIF(LTRIM(RTRIM(b.account_description)), '') AS descripcion,
    b.account_type
FROM (
    SELECT
        c.*,
        ROW_NUMBER() OVER (PARTITION BY c.gl_acct_number ORDER BY c._cargado_en DESC) AS _rn
    FROM bronze.chart c
    WHERE c._lote_id IN (SELECT lote_id FROM staging.vw_lote_actual)
      AND c.gl_acct_number IS NOT NULL
      AND c.account_type   IS NOT NULL
) AS b
WHERE b._rn = 1;
GO

-- ----------------------------------------------------------------------------
-- stg_customers -- propietarios/unidades tipados.
-- ----------------------------------------------------------------------------
CREATE VIEW staging.stg_customers AS
SELECT
    b.customer_record_number,
    NULLIF(LTRIM(RTRIM(b.customer_id)), '') AS customer_id,
    NULLIF(LTRIM(RTRIM(b.nombre)), '')      AS nombre,
    COALESCE(b.saldo, 0)                    AS saldo_sage
FROM (
    SELECT
        c.*,
        ROW_NUMBER() OVER (PARTITION BY c.customer_record_number ORDER BY c._cargado_en DESC) AS _rn
    FROM bronze.customers c
    WHERE c._lote_id IN (SELECT lote_id FROM staging.vw_lote_actual)
      AND c.customer_record_number IS NOT NULL
) AS b
WHERE b._rn = 1;
GO

-- ----------------------------------------------------------------------------
-- stg_vendors -- proveedores tipados.
-- ----------------------------------------------------------------------------
CREATE VIEW staging.stg_vendors AS
SELECT
    b.vendor_record_number,
    NULLIF(LTRIM(RTRIM(b.vendor_id)), '') AS vendor_id,
    NULLIF(LTRIM(RTRIM(b.nombre)), '')    AS nombre,
    COALESCE(b.saldo, 0)                  AS saldo_sage
FROM (
    SELECT
        v.*,
        ROW_NUMBER() OVER (PARTITION BY v.vendor_record_number ORDER BY v._cargado_en DESC) AS _rn
    FROM bronze.vendors v
    WHERE v._lote_id IN (SELECT lote_id FROM staging.vw_lote_actual)
      AND v.vendor_record_number IS NOT NULL
) AS b
WHERE b._rn = 1;
GO

-- ----------------------------------------------------------------------------
-- stg_movimientos -- libro diario tipado.
--
-- TRY_CAST y no CAST: una fecha malformada se vuelve NULL y la fila queda
-- reportada en vw_control_calidad, en vez de hacer explotar la carga entera.
-- Es la unica forma de que un dato sucio sea visible en lugar de fatal.
--
-- NO se deduplica. Dos lineas identicas (misma cuenta, fecha, monto y
-- referencia) son legitimas en contabilidad -- dos gastos iguales en el mismo
-- asiento. Deduplicar aca borraria plata real.
-- ----------------------------------------------------------------------------
CREATE VIEW staging.stg_movimientos AS
SELECT
    TRY_CAST(m.fecha AS DATE)        AS fecha,
    m.gl_acct_number,
    m.customer_record_number,
    m.vendor_record_number,
    CAST(m.journal AS SMALLINT)      AS journal,
    NULLIF(LTRIM(RTRIM(m.referencia)), '')  AS referencia,
    NULLIF(LTRIM(RTRIM(m.descripcion)), '') AS descripcion,
    COALESCE(m.monto, 0)             AS monto,
    TRY_CAST(m.date_cleared AS DATE) AS fecha_conciliacion
FROM bronze.movimientos m
WHERE m._lote_id IN (SELECT lote_id FROM staging.vw_lote_actual)
  AND m.gl_acct_number IS NOT NULL
  AND TRY_CAST(m.fecha AS DATE) IS NOT NULL;
GO

-- ============================================================================
-- El control de calidad NO vive aca: esta en modelo/99_control_calidad.sql.
--
-- Cruza staging con silver.mapeo_cuenta, asi que no puede crearse antes de que
-- silver exista. Por eso se despliega al final, despues de todas las capas.
-- ============================================================================
