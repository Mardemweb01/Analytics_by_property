-- ============================================================================
-- MODULO: 02_hechos.sql
-- OBJETIVO: crear la tabla de hechos del esquema estrella y dejar escrito el
-- decode de account_type que usa la transformacion para poblar dim_cuenta.
--
-- Como todo el modelo, se despliega una vez por propiedad en su propio
-- Warehouse. No hay columna de PH -- ver el encabezado de 01_dimensiones.sql.
--
-- GRANO: una fila = una linea de asiento contable (una fila de "JrnlRow" de
-- Sage). Es el grano mas fino disponible y no se agrega nada al cargar.
-- Agregar en la carga es irreversible: si manana piden el detalle de un gasto,
-- con el grano fino se hace un WHERE; con datos pre-agregados hay que rehacer
-- el pipeline. El costo de guardarlo crudo son 6,521 filas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- fact_movimiento -- el libro diario.
--
-- Todas las metricas del dashboard salen de esta tabla filtrada de distinta
-- forma. Esa es la prueba de que el modelo esta bien puesto: si una tarjeta
-- nueva necesita una tabla nueva, el grano estaba mal elegido.
--
-- monto es la unica medida. Se guarda con el signo contable de Sage, SIN
-- corregir -- la correccion se aplica al consultar, multiplicando por
-- dim_cuenta.signo_natural. Guardarlo crudo mantiene la propiedad que hace
-- auditable a un libro diario: la suma de todo asiento balanceado da cero.
-- ----------------------------------------------------------------------------
CREATE TABLE silver.fact_movimiento (
    movimiento_key  BIGINT        NOT NULL,  -- ver NOTA sobre la clave, abajo

    -- claves foraneas a las dimensiones
    fecha_key       INT           NOT NULL,
    gl_acct_number  INT           NOT NULL,
    customer_record_number INT    NULL,      -- NULL: la mayoria de las lineas
    vendor_record_number   INT    NULL,      -- no tocan cliente ni proveedor

    -- atributos degenerados (viven en el hecho porque no tienen dimension
    -- propia: son identificadores de la transaccion, no entidades)
    journal         SMALLINT      NULL,      -- codigo de diario de Sage
    referencia      VARCHAR(50)   NULL,      -- nro de cheque / factura
    descripcion     VARCHAR(200)  NULL,

    -- la medida
    monto           DECIMAL(19,4) NOT NULL,

    -- conciliacion bancaria: NULL = no conciliado todavia
    fecha_conciliacion DATE       NULL,

    CONSTRAINT pk_fact_movimiento PRIMARY KEY NONCLUSTERED (movimiento_key) NOT ENFORCED,
    CONSTRAINT fk_fact_fecha FOREIGN KEY (fecha_key)
        REFERENCES silver.dim_fecha (fecha_key) NOT ENFORCED,
    CONSTRAINT fk_fact_cuenta FOREIGN KEY (gl_acct_number)
        REFERENCES silver.dim_cuenta (gl_acct_number) NOT ENFORCED,
    CONSTRAINT fk_fact_cliente FOREIGN KEY (customer_record_number)
        REFERENCES silver.dim_cliente (customer_record_number) NOT ENFORCED,
    CONSTRAINT fk_fact_proveedor FOREIGN KEY (vendor_record_number)
        REFERENCES silver.dim_proveedor (vendor_record_number) NOT ENFORCED
);
GO

-- ============================================================================
-- NOTA SOBRE movimiento_key -- LEER ANTES DE INTENTAR CARGA INCREMENTAL
-- ----------------------------------------------------------------------------
-- Es un ROW_NUMBER() generado en la carga, y NO ES ESTABLE ENTRE CARGAS: la
-- misma linea contable puede recibir un numero distinto si se recarga.
--
-- Ya no es una limitacion del origen: extractores/movimientos.py separa
-- JrnlRow y JrnlHdr y expone "PostOrder" en ambos (bronze.jrnlrow."PostOrder",
-- bronze.jrnlhdr."PostOrder"). Pero PostOrder identifica el ASIENTO, no la
-- LINEA -- dentro de un mismo post_order, dos lineas con la misma cuenta,
-- fecha, monto y referencia siguen siendo indistinguibles entre si (y son
-- perfectamente legitimas en contabilidad: dos gastos iguales en el mismo
-- asiento). Falta el indice de fila dentro del asiento para que la clave sea
-- estable.
--
-- CONSECUENCIA HOY: la carga sigue siendo FULL REFRESH (truncate + reload).
-- Es una decision, no una obligacion -- con 6,521 filas tarda segundos, asi
-- que no hay urgencia en cambiarla.
--
-- COMO ARREGLARLO cuando duela: JrnlRow no expone un indice de fila propio en
-- esta extraccion; hay que numerar las filas dentro de cada post_order al
-- extraer (ROW_NUMBER() sobre el cursor, o el orden natural si Sage lo
-- garantiza). Con (post_order, indice) como clave natural estable, la carga
-- incremental se vuelve posible.
-- ============================================================================

-- ============================================================================
-- DECODE DE account_type -- vive en staging/01_vistas.sql
-- ----------------------------------------------------------------------------
-- La traduccion de account_type a tipo_cuenta / categoria / signo_natural esta
-- en staging.vw_decode_account_type, no aca. Es una traduccion mecanica de un
-- enumerado del origen, no una decision de modelado, asi que pertenece a la
-- capa de limpieza.
--
-- La transformacion que puebla silver.dim_cuenta la consume desde alli.
-- ============================================================================
