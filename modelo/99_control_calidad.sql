-- ============================================================================
-- CONTROL DE CALIDAD -- lo que el pipeline descarto o no supo interpretar.
--
-- Se despliega AL FINAL, despues de bronze, staging, silver y gold: cruza
-- varias capas, asi que no puede crearse antes de que todas existan.
--
-- COMO SE USA: el proceso de carga consulta esta vista DESPUES de cargar y
-- ABORTA si hay filas con severidad 'ERROR'. Un dashboard que muestra numeros
-- calculados sobre datos que se descartaron en silencio es peor que un
-- dashboard que no carga.
--
-- 'AVISO' no aborta, pero deberia quedar en el log de la corrida.
-- ============================================================================

CREATE VIEW dbo.vw_control_calidad AS

-- Un account_type que el decode no conoce significa cuentas que ninguna
-- metrica esta contando. Es el caso mas grave: el total no cierra y nada lo
-- indica en pantalla. Pasa cuando se despliega en un PH cuyo plan de cuentas
-- usa tipos que la compania de referencia no usaba.
SELECT
    'ERROR'                             AS severidad,
    'account_type desconocido'          AS control,
    CAST(c.account_type AS VARCHAR(30)) AS detalle,
    COUNT(*)                            AS filas
FROM staging.stg_chart c
LEFT JOIN staging.vw_decode_account_type d ON d.account_type = c.account_type
WHERE d.account_type IS NULL
GROUP BY c.account_type

UNION ALL

-- Movimientos con fecha que no parsea: quedaron fuera de stg_movimientos y por
-- lo tanto fuera de todos los totales.
SELECT 'ERROR', 'fecha no parseable', NULL, COUNT(*)
FROM bronze.movimientos
WHERE _lote_id IN (SELECT lote_id FROM staging.vw_lote_actual)
  AND fecha IS NOT NULL
  AND TRY_CAST(fecha AS DATE) IS NULL

UNION ALL

-- Movimientos que apuntan a una cuenta inexistente en el plan: romperian la
-- estrella (un hecho sin su dimension).
SELECT 'ERROR', 'cuenta huerfana', CAST(m.gl_acct_number AS VARCHAR(30)), COUNT(*)
FROM staging.stg_movimientos m
LEFT JOIN staging.stg_chart c ON c.gl_acct_number = m.gl_acct_number
WHERE c.gl_acct_number IS NULL
GROUP BY m.gl_acct_number

UNION ALL

-- El libro diario tiene que balancear. Si la suma de todos los movimientos no
-- da cero, se perdieron filas en algun punto de la cadena.
SELECT 'ERROR', 'libro no balancea', CAST(SUM(monto) AS VARCHAR(30)), COUNT(*)
FROM staging.stg_movimientos
HAVING ABS(SUM(monto)) > 0.01

UNION ALL

-- Cuentas sin fila en mapeo_cuenta: caen con todos los flags en 0, o sea que
-- ninguna metrica las cuenta. Puede ser correcto -- las cuentas de patrimonio
-- no van a ninguna tarjeta -- por eso es aviso y no error. Pero hay que
-- mirarlo cada vez que cambie el plan de cuentas.
SELECT 'AVISO', 'cuenta sin mapeo', CAST(c.gl_acct_number AS VARCHAR(30)), COUNT(*)
FROM staging.stg_chart c
LEFT JOIN silver.mapeo_cuenta m ON m.gl_acct_number = c.gl_acct_number
WHERE m.gl_acct_number IS NULL
GROUP BY c.gl_acct_number

UNION ALL

-- Conciliacion contra el propio Sage: la suma de movimientos por cliente tiene
-- que dar el Balance que reporta Customers. Si no cuadra, se perdieron filas
-- entre la extraccion y silver.
SELECT 'AVISO', 'saldo cliente no concilia',
       CAST(cl.customer_record_number AS VARCHAR(30)), COUNT(*)
FROM silver.dim_cliente cl
LEFT JOIN silver.fact_movimiento f
       ON f.customer_record_number = cl.customer_record_number
GROUP BY cl.customer_record_number, cl.saldo_sage
HAVING ABS(cl.saldo_sage - COALESCE(SUM(f.monto), 0)) > 0.01;
GO
