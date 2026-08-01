-- ============================================================================
-- CAPA GOLD -- agregados listos para consumo.
--
-- QUE VA ACA Y QUE NO, dado que el proyecto usa la opcion A (cada consumidor
-- define sus propias metricas, DAX en Power BI y SQL en el API):
--
--   SI  -- agregados estructurales de los que ambos parten: flujo mensual por
--          cuenta, saldo acumulado por cuenta, cartera por cliente.
--   NO  -- metricas de presentacion ("Saldo en Bancos", "% de Cobro"). Esas
--          son un SUM con un WHERE sobre estas vistas, y cada consumidor las
--          escribe en su propio lenguaje.
--
-- La division no es arbitraria: lo que va aca es lo caro de calcular y lo
-- facil de calcular distinto (sobre todo los acumulados). Lo que queda afuera
-- es un filtro trivial que no se puede equivocar.
--
-- EL SIGNO YA VIENE CORREGIDO. monto_natural aplica dim_cuenta.signo_natural,
-- asi que los ingresos salen positivos. Es deliberado: si cada consumidor
-- tuviera que acordarse de multiplicar, tarde o temprano uno se olvida y las
-- dos pantallas muestran el mismo dato con distinto signo.
--
-- SON VISTAS, NO TABLAS. A esta escala alcanza. Si el volumen crece, se
-- materializan sin tocar a quien las consume.
--
-- Orden de despliegue: bronze -> staging -> silver -> GOLD.
-- ============================================================================

CREATE SCHEMA gold;
GO

-- ----------------------------------------------------------------------------
-- vw_movimiento_mensual -- flujo del periodo por cuenta.
--
-- Grano: una fila por (periodo, cuenta) con movimiento. Es la base de todo lo
-- que sea "del mes": ingresos, gastos, el donut por rubro, la serie de
-- ingresos vs gastos.
--
-- OJO -- es FLUJO, no saldo. Para "cuanto hay en el banco" usar
-- vw_saldo_mensual: sumar el flujo de un mes da lo que se movio ese mes, no lo
-- que quedo.
-- ----------------------------------------------------------------------------
CREATE VIEW gold.vw_movimiento_mensual AS
SELECT
    f.periodo_id,
    f.periodo_label,
    f.anio,
    f.mes,
    c.gl_acct_number,
    c.account_id,
    c.descripcion       AS cuenta_descripcion,
    c.tipo_cuenta,
    c.categoria,
    c.rubro,
    c.es_banco,
    c.es_fondo_reserva,
    c.es_por_cobrar,
    SUM(m.monto)                     AS monto_contable,  -- signo crudo de Sage
    SUM(m.monto * c.signo_natural)   AS monto_natural,   -- positivo = magnitud
    COUNT(*)                         AS cantidad_movimientos
FROM silver.fact_movimiento m
JOIN silver.dim_fecha  f ON f.fecha_key      = m.fecha_key
JOIN silver.dim_cuenta c ON c.gl_acct_number = m.gl_acct_number
GROUP BY
    f.periodo_id, f.periodo_label, f.anio, f.mes,
    c.gl_acct_number, c.account_id, c.descripcion,
    c.tipo_cuenta, c.categoria, c.rubro,
    c.es_banco, c.es_fondo_reserva, c.es_por_cobrar;
GO

-- ----------------------------------------------------------------------------
-- vw_saldo_mensual -- saldo acumulado por cuenta al cierre de cada periodo.
--
-- Grano: una fila por (periodo, cuenta), INCLUSO SI ESE MES NO HUBO
-- MOVIMIENTO. Eso es lo que la hace util para series de tiempo: el grafico de
-- evolucion del saldo necesita un punto por mes, y una cuenta sin actividad
-- igual tiene saldo.
--
-- Por eso el CROSS JOIN entre periodos y cuentas: sin el, los meses sin
-- movimiento faltarian y la linea del grafico saltearia puntos.
--
-- De aca salen "Saldo en Bancos" (WHERE es_banco) y "Fondo de Reserva"
-- (WHERE es_fondo_reserva), filtrando por el periodo de corte.
-- ----------------------------------------------------------------------------
CREATE VIEW gold.vw_saldo_mensual AS
WITH periodos AS (
    SELECT DISTINCT periodo_id, periodo_label, anio, mes
    FROM silver.dim_fecha
),
cuentas AS (
    SELECT gl_acct_number, account_id, descripcion, tipo_cuenta, categoria,
           rubro, signo_natural, es_banco, es_fondo_reserva, es_por_cobrar
    FROM silver.dim_cuenta
),
grilla AS (
    SELECT p.periodo_id, p.periodo_label, p.anio, p.mes, c.*
    FROM periodos p
    CROSS JOIN cuentas c
),
flujo AS (
    SELECT
        f.periodo_id,
        m.gl_acct_number,
        SUM(m.monto) AS monto_contable
    FROM silver.fact_movimiento m
    JOIN silver.dim_fecha f ON f.fecha_key = m.fecha_key
    GROUP BY f.periodo_id, m.gl_acct_number
)
SELECT
    g.periodo_id,
    g.periodo_label,
    g.anio,
    g.mes,
    g.gl_acct_number,
    g.account_id,
    g.descripcion       AS cuenta_descripcion,
    g.tipo_cuenta,
    g.categoria,
    g.rubro,
    g.es_banco,
    g.es_fondo_reserva,
    g.es_por_cobrar,
    COALESCE(fl.monto_contable, 0)                  AS movimiento_periodo,
    SUM(COALESCE(fl.monto_contable, 0)) OVER (
        PARTITION BY g.gl_acct_number
        ORDER BY g.periodo_id
        ROWS UNBOUNDED PRECEDING
    )                                               AS saldo_contable,
    SUM(COALESCE(fl.monto_contable, 0) * g.signo_natural) OVER (
        PARTITION BY g.gl_acct_number
        ORDER BY g.periodo_id
        ROWS UNBOUNDED PRECEDING
    )                                               AS saldo_natural
FROM grilla g
LEFT JOIN flujo fl
       ON fl.periodo_id     = g.periodo_id
      AND fl.gl_acct_number = g.gl_acct_number;
GO

-- ----------------------------------------------------------------------------
-- vw_cartera_cliente -- saldo por cliente al cierre de cada periodo.
--
-- Solo cuentas marcadas es_por_cobrar en mapeo_cuenta. Es la base de la
-- tarjeta de morosidad y de la tabla de deudores.
--
-- LIMITACION CONOCIDA -- ESTO NO ES ANTIGUEDAD DE SALDOS REAL.
-- El grafico "Antiguedad de la Morosidad" (tramos 0-30 / 31-60 / 61-90 / 90+)
-- necesita saber que factura quedo impaga y desde cuando. Eso requiere aplicar
-- cada pago contra las facturas que cancela, y la extraccion actual no lo
-- permite: JrnlRow trae lineas sueltas, sin vinculo entre el cobro y el cargo
-- que salda.
--
-- Esta vista da el SALDO NETO por cliente y periodo, que es correcto. Repartir
-- ese saldo en tramos exigiria asumir un criterio de aplicacion (FIFO, por
-- ejemplo) y el resultado seria una estimacion presentada como dato.
--
-- Antes de alimentar ese grafico hay que decidir una de dos:
--   a) extraer la aplicacion de pagos de Sage (tablas de invoice/receipt), o
--   b) definir explicitamente el criterio de aproximacion y etiquetarlo como
--      tal en la UI.
-- ----------------------------------------------------------------------------
CREATE VIEW gold.vw_cartera_cliente AS
WITH periodos AS (
    SELECT DISTINCT periodo_id, periodo_label FROM silver.dim_fecha
),
flujo AS (
    SELECT
        f.periodo_id,
        m.customer_record_number,
        SUM(m.monto * c.signo_natural) AS monto_natural
    FROM silver.fact_movimiento m
    JOIN silver.dim_fecha  f ON f.fecha_key      = m.fecha_key
    JOIN silver.dim_cuenta c ON c.gl_acct_number = m.gl_acct_number
    WHERE m.customer_record_number IS NOT NULL
      AND c.es_por_cobrar = 1
    GROUP BY f.periodo_id, m.customer_record_number
),
grilla AS (
    SELECT p.periodo_id, p.periodo_label, cl.customer_record_number, cl.nombre
    FROM periodos p
    CROSS JOIN silver.dim_cliente cl
)
SELECT
    g.periodo_id,
    g.periodo_label,
    g.customer_record_number,
    g.nombre,
    COALESCE(fl.monto_natural, 0) AS movimiento_periodo,
    SUM(COALESCE(fl.monto_natural, 0)) OVER (
        PARTITION BY g.customer_record_number
        ORDER BY g.periodo_id
        ROWS UNBOUNDED PRECEDING
    )                             AS saldo_pendiente
FROM grilla g
LEFT JOIN flujo fl
       ON fl.periodo_id             = g.periodo_id
      AND fl.customer_record_number = g.customer_record_number;
GO

-- ============================================================================
-- EJEMPLOS DE CONSUMO -- para referencia, no se despliegan.
-- ----------------------------------------------------------------------------
-- Muestran que las metricas del dashboard son un filtro sobre estas vistas.
-- Si una tarjeta nueva necesita algo que no sale de aca con un WHERE, revisar
-- si falta un agregado o si el grano de silver quedo mal elegido.
--
--   -- Saldo en Bancos
--   SELECT SUM(saldo_natural) FROM gold.vw_saldo_mensual
--   WHERE periodo_id = '2026-05' AND es_banco = 1;
--
--   -- Ingresos del Mes
--   SELECT SUM(monto_natural) FROM gold.vw_movimiento_mensual
--   WHERE periodo_id = '2026-05' AND tipo_cuenta = 'Ingreso';
--
--   -- Distribucion de gastos por rubro (el donut)
--   SELECT rubro, SUM(monto_natural) FROM gold.vw_movimiento_mensual
--   WHERE periodo_id = '2026-05' AND tipo_cuenta = 'Gasto'
--   GROUP BY rubro;
--
--   -- Morosidad total
--   SELECT SUM(saldo_pendiente) FROM gold.vw_cartera_cliente
--   WHERE periodo_id = '2026-05' AND saldo_pendiente > 0;
-- ============================================================================
