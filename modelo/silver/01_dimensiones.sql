-- ============================================================================
-- MODULO: 01_dimensiones.sql
-- OBJETIVO: crear las dimensiones del esquema estrella (capa silver).
--
-- ----------------------------------------------------------------------------
-- AISLAMIENTO -- LO MAS IMPORTANTE DE ESTE MODELO, LEER ANTES DE TOCAR NADA
-- ----------------------------------------------------------------------------
-- Este esquema se despliega UNA VEZ POR PROPIEDAD, en un Warehouse propio,
-- dentro de un workspace propio. No hay ninguna columna que identifique al PH:
-- la identidad de la propiedad ES el workspace donde vive la tabla.
--
-- El motivo es que los miembros de la junta directiva de cada PH acceden a sus
-- datos. Con una columna discriminadora, un WHERE olvidado expone las finanzas
-- de otro edificio. Con separacion fisica, ese mismo bug es un error de
-- conexion: falla cerrado en vez de abierto. La barrera no depende de que
-- nadie se equivoque nunca al escribir una consulta.
--
-- COROLARIO -- no agregar jamas una columna propiedad_id "por si acaso". Si
-- algun dia hiciera falta consolidar entre PHs, se hace en un workspace
-- aparte leyendo agregados, nunca metiendo un discriminador aca.
--
-- ----------------------------------------------------------------------------
-- DIALECTO: T-SQL para Fabric Warehouse. Tres restricciones del motor que
-- explican decisiones que de otro modo parecen raras:
--   1. No hay IDENTITY -- las claves se generan en la transformacion.
--   2. No existe NVARCHAR ni MONEY -- se usa VARCHAR (que ya es UTF-8 con la
--      collation por defecto) y DECIMAL.
--   3. PK/UNIQUE/FK solo se aceptan como NOT ENFORCED: son metadata para que
--      Power BI infiera relaciones, NO las valida el motor. La integridad la
--      garantiza la transformacion.
-- ============================================================================

CREATE SCHEMA silver;
GO

-- ----------------------------------------------------------------------------
-- dim_fecha -- calendario generado, no extraido.
--
-- periodo_id ('YYYY-MM') existe para que el filtro de periodo del dashboard
-- sea un WHERE directo sobre la dimension. Es el mismo formato de id que ya
-- usa la UI (web/src/services/mock/datos-mock.ts), asi que el contrato no
-- cambia cuando se reemplace el mock.
-- ----------------------------------------------------------------------------
CREATE TABLE silver.dim_fecha (
    fecha_key       INT          NOT NULL,  -- 20260531, entero YYYYMMDD
    fecha           DATE         NOT NULL,
    anio            SMALLINT     NOT NULL,
    trimestre       SMALLINT     NOT NULL,
    mes             SMALLINT     NOT NULL,
    nombre_mes      VARCHAR(12)  NOT NULL,  -- 'Mayo'
    periodo_id      VARCHAR(7)   NOT NULL,  -- '2026-05'
    periodo_label   VARCHAR(20)  NOT NULL,  -- 'Mayo 2026'
    es_fin_de_mes   BIT          NOT NULL,
    CONSTRAINT pk_dim_fecha PRIMARY KEY NONCLUSTERED (fecha_key) NOT ENFORCED
);
GO

-- ----------------------------------------------------------------------------
-- dim_cuenta -- el plan de cuentas de ESTE PH, enriquecido.
--
-- Es la pieza central del modelo. Las columnas se dividen en tres bloques y la
-- distincion importa:
--
--   a) CRUDAS -- vienen tal cual de Chart.
--   b) DERIVADAS -- decodifican account_type. El mapeo es mecanico y esta en
--      02_hechos.sql; no requiere criterio de nadie.
--   c) DE NEGOCIO -- rubro, es_banco, es_fondo_reserva, es_por_cobrar. NO
--      salen de Sage. Las define quien administra el PH y entran por
--      03_mapeo_cuentas.sql.
--
-- El bloque (c) es la razon de ser de esta tabla. Como el proyecto va con la
-- opcion A (metricas definidas por separado en DAX y en SQL), este es el unico
-- lugar donde esas reglas quedan escritas una sola vez. Todo lo que se pueda
-- empujar aca es una divergencia menos entre los dos dashboards.
--
-- NOTA SOBRE LA CLAVE -- gl_acct_number es clave natural y primaria a la vez.
-- Puede serlo porque cada PH tiene su propio Warehouse: dentro de este, el
-- numero de cuenta ya es unico. En un modelo con todos los PHs juntos habria
-- que componerla con el id de propiedad. Esa simplificacion es un beneficio
-- directo del aislamiento fisico.
-- ----------------------------------------------------------------------------
CREATE TABLE silver.dim_cuenta (
    -- (a) crudas
    gl_acct_number  INT          NOT NULL,
    account_id      VARCHAR(20)  NULL,      -- '10200-00', el codigo que ve el contador
    descripcion     VARCHAR(100) NULL,
    account_type    INT          NOT NULL,  -- codigo Sage sin tocar, para auditar

    -- (b) derivadas
    tipo_cuenta     VARCHAR(20)  NOT NULL,  -- Activo | Pasivo | Patrimonio | Ingreso | Gasto
    categoria       VARCHAR(40)  NOT NULL,  -- 'Efectivo', 'Cuentas por Cobrar', ...
    signo_natural   SMALLINT     NOT NULL,  -- +1 deudora, -1 acreedora (ver nota abajo)

    -- (c) de negocio
    rubro             VARCHAR(40) NULL,     -- 'Seguridad', 'Limpieza', ... NULL si no aplica
    es_banco          BIT         NOT NULL,
    es_fondo_reserva  BIT         NOT NULL,
    es_por_cobrar     BIT         NOT NULL,

    CONSTRAINT pk_dim_cuenta PRIMARY KEY NONCLUSTERED (gl_acct_number) NOT ENFORCED
);
GO

-- NOTA sobre signo_natural -- Sage guarda los montos con signo contable: las
-- cuentas acreedoras (ingresos, pasivos, patrimonio) acumulan negativo. Si se
-- suma crudo, "Ingresos del Mes" sale -64,780 y la tarjeta muestra un numero
-- negativo. Multiplicar por signo_natural devuelve la magnitud que espera un
-- humano. Se guarda como columna en vez de resolverlo con un CASE en cada
-- consulta, justamente para que los dos consumidores no lo interpreten
-- distinto: es otra regla que se define una sola vez.

-- ----------------------------------------------------------------------------
-- dim_cliente -- propietarios/unidades. En un PH, "cliente" = quien paga cuota.
-- ----------------------------------------------------------------------------
CREATE TABLE silver.dim_cliente (
    customer_record_number  INT          NOT NULL,  -- clave natural y primaria
    customer_id             VARCHAR(30)  NULL,      -- codigo visible en Sage
    nombre                  VARCHAR(100) NULL,
    saldo_sage              DECIMAL(19,4) NOT NULL, -- Balance segun Sage, ver nota
    CONSTRAINT pk_dim_cliente PRIMARY KEY NONCLUSTERED (customer_record_number) NOT ENFORCED
);
GO

-- NOTA sobre saldo_sage -- es un saldo AL MOMENTO DE LA EXTRACCION, no una
-- serie historica: no se puede filtrar por periodo. Sirve para conciliar (si la
-- suma de movimientos no da este numero, algo se perdio en el camino), pero la
-- morosidad por antiguedad se calcula desde fact_movimiento, que si tiene
-- fecha. No usar esta columna para alimentar el grafico de morosidad.

-- ----------------------------------------------------------------------------
-- dim_proveedor -- a quien se le paga (seguridad, limpieza, mantenimiento).
-- ----------------------------------------------------------------------------
CREATE TABLE silver.dim_proveedor (
    vendor_record_number  INT          NOT NULL,
    vendor_id             VARCHAR(30)  NULL,
    nombre                VARCHAR(100) NULL,
    saldo_sage            DECIMAL(19,4) NOT NULL,  -- misma salvedad que dim_cliente
    CONSTRAINT pk_dim_proveedor PRIMARY KEY NONCLUSTERED (vendor_record_number) NOT ENFORCED
);
GO
