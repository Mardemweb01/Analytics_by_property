-- ============================================================================
-- CAPA STAGING -- tipado y limpieza. Sigue siendo 1:1 con el origen.
--
-- REGLA DE ESTA CAPA: una vista por tabla de bronze, con los mismos registros
-- y el mismo grano. Se convierte texto a fechas, se recortan espacios, se
-- descartan duplicados y se resuelve que hacer con los nulos. Lo que NO se
-- hace todavia: cruzar ENTIDADES entre si (cliente, proveedor, cuenta) ni
-- aplicar reglas de negocio. Eso es silver.
--
-- EXCEPCION -- stg_movimientos cruza stg_jrnlrow con stg_jrnlhdr. No es una
-- excepcion a la regla de arriba: JrnlRow y JrnlHdr no son dos entidades
-- distintas, son un mismo asiento contable que Sage particiona en dos tablas.
-- Reensamblarlo es tipado y limpieza, no una decision de negocio -- por eso
-- vive aca y no en silver. Ver la nota en stg_movimientos mas abajo.
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
--
-- bronze.chart trae 185 columnas (todas las de Sage, incluidas las 171
-- Balance*Dr/Cr/Net de saldo por periodo) -- esta vista solo proyecta las 4
-- que hoy alimentan el modelo dimensional. Las columnas de periodo quedan en
-- bronze, no se pierden; se van a usar cuando se arme el fact_saldo_periodo
-- (ver COLUMNAS_SAGE.md), no hace falta traerlas aca todavia.
-- ----------------------------------------------------------------------------
CREATE VIEW staging.stg_chart AS
SELECT
    b."GLAcntNumber"                                     AS gl_acct_number,
    NULLIF(LTRIM(RTRIM(b."AccountID")), '')               AS account_id,
    NULLIF(LTRIM(RTRIM(b."AccountDescription")), '')      AS descripcion,
    b."AccountType"                                       AS account_type
FROM (
    SELECT
        c.*,
        ROW_NUMBER() OVER (PARTITION BY c."GLAcntNumber" ORDER BY c._cargado_en DESC) AS _rn
    FROM bronze.chart c
    WHERE c._lote_id IN (SELECT lote_id FROM staging.vw_lote_actual)
      AND c."GLAcntNumber" IS NOT NULL
      AND c."AccountType"  IS NOT NULL
) AS b
WHERE b._rn = 1;
GO

-- ----------------------------------------------------------------------------
-- stg_customers -- propietarios/unidades tipados.
--
-- bronze.customers trae 153 columnas, incluidas Sales1..42/Payments1..42
-- (facturado/cobrado por periodo). Mismo criterio que stg_chart: quedan en
-- bronze, no se proyectan aca hasta que haga falta el fact_saldo_periodo.
-- ----------------------------------------------------------------------------
CREATE VIEW staging.stg_customers AS
SELECT
    b."CustomerRecordNumber"                          AS customer_record_number,
    NULLIF(LTRIM(RTRIM(b."CustomerID")), '')           AS customer_id,
    NULLIF(LTRIM(RTRIM(b."Customer_Bill_Name")), '')   AS nombre,
    COALESCE(b."Balance", 0)                           AS saldo_sage
FROM (
    SELECT
        c.*,
        ROW_NUMBER() OVER (PARTITION BY c."CustomerRecordNumber" ORDER BY c._cargado_en DESC) AS _rn
    FROM bronze.customers c
    WHERE c._lote_id IN (SELECT lote_id FROM staging.vw_lote_actual)
      AND c."CustomerRecordNumber" IS NOT NULL
) AS b
WHERE b._rn = 1;
GO

-- ----------------------------------------------------------------------------
-- stg_vendors -- proveedores tipados.
-- ----------------------------------------------------------------------------
CREATE VIEW staging.stg_vendors AS
SELECT
    b."VendorRecordNumber"                    AS vendor_record_number,
    NULLIF(LTRIM(RTRIM(b."VendorID")), '')     AS vendor_id,
    NULLIF(LTRIM(RTRIM(b."Name")), '')         AS nombre,
    COALESCE(b."Balance", 0)                   AS saldo_sage
FROM (
    SELECT
        v.*,
        ROW_NUMBER() OVER (PARTITION BY v."VendorRecordNumber" ORDER BY v._cargado_en DESC) AS _rn
    FROM bronze.vendors v
    WHERE v._lote_id IN (SELECT lote_id FROM staging.vw_lote_actual)
      AND v."VendorRecordNumber" IS NOT NULL
) AS b
WHERE b._rn = 1;
GO

-- ----------------------------------------------------------------------------
-- stg_jrnlrow -- lineas de asiento tipadas. Sigue 1:1 con bronze.jrnlrow: no
-- filtra post_order ni gl_acct_number nulos todavia -- eso pasa en
-- stg_movimientos, despues del join, para que vw_control_calidad pueda
-- distinguir "sin cuenta" de "sin encabezado".
--
-- bronze.jrnlrow trae 47 columnas -- se proyecta "IncludeInGL" ademas de las
-- de siempre: es el flag que decide si la fila cuenta como movimiento
-- contable real, o si es una orden/cotizacion que Sage nunca postea al mayor.
-- El filtro en si se aplica en stg_movimientos (ver mas abajo), no aca --
-- mismo criterio que gl_acct_number/fecha: se filtra despues del join, para
-- que vw_control_calidad pueda contar cuantas filas excluyo cada motivo por
-- separado.
-- ----------------------------------------------------------------------------
CREATE VIEW staging.stg_jrnlrow AS
SELECT
    b."PostOrder"                                     AS post_order,
    b."GLAcntNumber"                                   AS gl_acct_number,
    COALESCE(b."Amount", 0)                            AS monto,
    b."Journal"                                        AS journal,
    NULLIF(LTRIM(RTRIM(b."RowDescription")), '')       AS descripcion,
    b."CustomerRecordNumber"                           AS customer_record_number,
    b."VendorRecordNumber"                             AS vendor_record_number,
    TRY_CAST(b."DateCleared" AS DATE)                  AS fecha_conciliacion,
    b."IncludeInGL"                                    AS include_in_gl
FROM bronze.jrnlrow b
WHERE b._lote_id IN (SELECT lote_id FROM staging.vw_lote_actual);
GO

-- ----------------------------------------------------------------------------
-- stg_jrnlhdr -- encabezados de asiento tipados. Sigue 1:1 con bronze.jrnlhdr.
--
-- TRY_CAST y no CAST: una fecha malformada se vuelve NULL en vez de hacer
-- explotar la carga entera; queda reportada en vw_control_calidad.
-- ----------------------------------------------------------------------------
CREATE VIEW staging.stg_jrnlhdr AS
SELECT
    b."PostOrder"                              AS post_order,
    TRY_CAST(b."TransactionDate" AS DATE)       AS fecha,
    NULLIF(LTRIM(RTRIM(b."Reference")), '')     AS referencia
FROM bronze.jrnlhdr b
WHERE b._lote_id IN (SELECT lote_id FROM staging.vw_lote_actual);
GO

-- ----------------------------------------------------------------------------
-- stg_movimientos -- libro diario reconstruido: stg_jrnlrow ⋈ stg_jrnlhdr por
-- post_order.
--
-- Este es el unico lugar del modelo donde JrnlRow y JrnlHdr se cruzan. No es
-- una regla de negocio -- es reensamblar un mismo asiento que Sage guarda en
-- dos tablas, asi que corresponde a esta capa y no a silver (que es donde se
-- cruzan ENTIDADES: cliente, proveedor, cuenta).
--
-- El INNER JOIN descarta lineas sin encabezado; vw_control_calidad las cuenta
-- aparte ('jrnlrow sin encabezado') para que no desaparezcan en silencio.
--
-- FILTRO CRITICO -- include_in_gl = 1. Sin este filtro se cuentan ordenes y
-- cotizaciones que Sage nunca postea al mayor (confirmado contra datos
-- reales: journals enteros con include_in_gl = 0 en el 100% de sus filas).
-- Antes de tener esta columna extraida, el filtro no existia y el libro
-- podia no balancear -- ver INVESTIGACION_ERRORES.md, Casos 1/2a/2b.
--
-- Los filtros de gl_acct_number y fecha nulos tambien quedan aca -- antes
-- vivian en el extractor, que los descartaba sin dejar rastro.
--
-- NO se deduplica. Dos lineas identicas (misma cuenta, fecha, monto y
-- referencia) son legitimas en contabilidad -- dos gastos iguales en el mismo
-- asiento. Deduplicar aca borraria plata real.
-- ----------------------------------------------------------------------------
CREATE VIEW staging.stg_movimientos AS
SELECT
    h.fecha,
    r.gl_acct_number,
    r.customer_record_number,
    r.vendor_record_number,
    CAST(r.journal AS SMALLINT) AS journal,
    h.referencia,
    r.descripcion,
    r.monto,
    r.fecha_conciliacion
FROM staging.stg_jrnlrow r
JOIN staging.stg_jrnlhdr h ON h.post_order = r.post_order
WHERE r.gl_acct_number IS NOT NULL
  AND h.fecha IS NOT NULL
  AND r.include_in_gl = 1;
GO

-- ============================================================================
-- El control de calidad NO vive aca: esta en modelo/99_control_calidad.sql.
--
-- Cruza staging con silver.mapeo_cuenta, asi que no puede crearse antes de que
-- silver exista. Por eso se despliega al final, despues de todas las capas.
-- ============================================================================
