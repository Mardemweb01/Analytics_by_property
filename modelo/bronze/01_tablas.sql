-- ============================================================================
-- CAPA BRONZE -- copia fiel de lo que devuelve Sage 50.
--
-- REGLA DE ESTA CAPA: no se transforma nada. Una tabla por extractor, con
-- exactamente los campos que ese extractor devuelve, mas metadata de carga.
-- Sin decodes, sin joins entre entidades, sin reglas de negocio, sin filtros.
--
-- POR QUE EXISTE: para poder reconstruir todo lo de arriba sin volver a tocar
-- Sage. Si manana se descubre que un account_type estaba mal interpretado, se
-- rehace silver desde bronze en minutos. Sin esta capa habria que volver a la
-- PC de 32 bits, abrir el ODBC y rezar que la base todavia tenga lo mismo.
--
-- APPEND-ONLY Y NUNCA SE CORRIGE. Si Sage mando basura, la basura queda
-- registrada y se arregla en staging. Corregir bronze destruye la unica
-- respuesta confiable a "que decia Sage el 31 de mayo".
--
-- AISLAMIENTO: igual que el resto del modelo, esto se despliega una vez por
-- propiedad en su propio workspace. Ver ARQUITECTURA.md.
-- ============================================================================

CREATE SCHEMA bronze;
GO

-- ============================================================================
-- METADATA DE CARGA -- las cinco columnas con prefijo _ que llevan todas las
-- tablas de esta capa:
--
--   _lote_id           identifica la corrida de carga (una por extraccion)
--   _propiedad_origen  ver nota de abajo -- es una ASERCION, no una dimension
--   _dsn_origen        DSN de Sage del que salio
--   _archivo_origen    ruta del archivo cargado, para rastrear una fila
--   _cargado_en        timestamp de la carga
--
-- ----------------------------------------------------------------------------
-- NOTA SOBRE _propiedad_origen -- LEER, PARECE CONTRADECIR EL DISENO
-- ----------------------------------------------------------------------------
-- El modelo dimensional NO tiene columna de propiedad, a proposito: el
-- aislamiento es fisico (un workspace por PH) y una columna discriminadora
-- reintroduciria el modo de falla que se busca eliminar.
--
-- Esta columna es otra cosa. Existe con un solo uso: antes de cargar de
-- bronze a staging, el proceso verifica que TODAS las filas del lote declaren
-- la propiedad que corresponde a este workspace, y ABORTA si alguna no
-- coincide. Despues se descarta y no llega a silver.
--
-- Es una asercion para detectar una mezcla, no una dimension para filtrar. Una
-- ruta de archivo se puede equivocar; un sello adentro del dato viaja con el.
-- Nunca usarla en un WHERE de negocio.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- bronze.chart <- extractores/chart.py <- tabla "Chart" de Sage
-- ----------------------------------------------------------------------------
CREATE TABLE bronze.chart (
    account_id           VARCHAR(50)  NULL,
    account_type         INT          NULL,
    account_description  VARCHAR(255) NULL,
    gl_acct_number       INT          NULL,

    _lote_id             VARCHAR(40)  NOT NULL,
    _propiedad_origen    VARCHAR(30)  NOT NULL,
    _dsn_origen          VARCHAR(50)  NOT NULL,
    _archivo_origen      VARCHAR(400) NOT NULL,
    _cargado_en          DATETIME2(3) NOT NULL
);
GO

-- ----------------------------------------------------------------------------
-- bronze.customers <- extractores/customers.py <- tabla "Customers"
-- ----------------------------------------------------------------------------
CREATE TABLE bronze.customers (
    customer_id             VARCHAR(50)   NULL,
    nombre                  VARCHAR(255)  NULL,
    saldo                   DECIMAL(19,4) NULL,
    customer_record_number  INT           NULL,

    _lote_id             VARCHAR(40)  NOT NULL,
    _propiedad_origen    VARCHAR(30)  NOT NULL,
    _dsn_origen          VARCHAR(50)  NOT NULL,
    _archivo_origen      VARCHAR(400) NOT NULL,
    _cargado_en          DATETIME2(3) NOT NULL
);
GO

-- ----------------------------------------------------------------------------
-- bronze.vendors <- extractores/vendors.py <- tabla "Vendors"
-- ----------------------------------------------------------------------------
CREATE TABLE bronze.vendors (
    vendor_id             VARCHAR(50)   NULL,
    nombre                VARCHAR(255)  NULL,
    saldo                 DECIMAL(19,4) NULL,
    vendor_record_number  INT           NULL,

    _lote_id             VARCHAR(40)  NOT NULL,
    _propiedad_origen    VARCHAR(30)  NOT NULL,
    _dsn_origen          VARCHAR(50)  NOT NULL,
    _archivo_origen      VARCHAR(400) NOT NULL,
    _cargado_en          DATETIME2(3) NOT NULL
);
GO

-- ----------------------------------------------------------------------------
-- bronze.jrnlrow <- extractores/movimientos.py:extraer_jrnlrow <- "JrnlRow"
--
-- Una fila por linea de asiento, sin cruzar con JrnlHdr y sin descartar nada:
-- post_order y gl_acct_number pueden venir NULL (una linea sin cuenta o sin
-- vinculo a ningun encabezado igual se guarda aca). El join con JrnlHdr y el
-- filtro de esos nulos son trabajo de staging.stg_movimientos.
--
-- date_cleared entra como VARCHAR porque asi la devuelve el extractor
-- (str(...) en Python). El parseo a DATE es trabajo de staging.
-- ----------------------------------------------------------------------------
CREATE TABLE bronze.jrnlrow (
    post_order               INT           NULL,
    gl_acct_number           INT           NULL,
    monto                    DECIMAL(19,4) NULL,
    journal                  INT           NULL,
    descripcion              VARCHAR(400)  NULL,
    customer_record_number   INT           NULL,
    vendor_record_number     INT           NULL,
    date_cleared             VARCHAR(30)   NULL,

    _lote_id             VARCHAR(40)  NOT NULL,
    _propiedad_origen    VARCHAR(30)  NOT NULL,
    _dsn_origen          VARCHAR(50)  NOT NULL,
    _archivo_origen      VARCHAR(400) NOT NULL,
    _cargado_en          DATETIME2(3) NOT NULL
);
GO

-- ----------------------------------------------------------------------------
-- bronze.jrnlhdr <- extractores/movimientos.py:extraer_jrnlhdr <- "JrnlHdr"
--
-- Un encabezado por asiento: fecha y referencia, vinculado a las lineas por
-- post_order. fecha entra como VARCHAR por el mismo motivo que en jrnlrow --
-- el parseo a DATE es trabajo de staging.
-- ----------------------------------------------------------------------------
CREATE TABLE bronze.jrnlhdr (
    post_order    INT          NULL,
    fecha         VARCHAR(30)  NULL,
    referencia    VARCHAR(100) NULL,

    _lote_id             VARCHAR(40)  NOT NULL,
    _propiedad_origen    VARCHAR(30)  NOT NULL,
    _dsn_origen          VARCHAR(50)  NOT NULL,
    _archivo_origen      VARCHAR(400) NOT NULL,
    _cargado_en          DATETIME2(3) NOT NULL
);
GO

-- ----------------------------------------------------------------------------
-- bronze.lote -- registro de cada corrida de carga.
--
-- Es lo que permite responder "cuando se cargo esto y cuantas filas trajo", y
-- lo que hace auditable la conciliacion: filas_origen es lo que decia el
-- archivo, y se compara contra el COUNT(*) real de cada tabla.
-- ----------------------------------------------------------------------------
CREATE TABLE bronze.lote (
    lote_id           VARCHAR(40)  NOT NULL,
    propiedad_origen  VARCHAR(30)  NOT NULL,
    dsn_origen        VARCHAR(50)  NOT NULL,
    extraido_en       DATETIME2(3) NULL,      -- timestamp de la corrida de Sage
    cargado_en        DATETIME2(3) NOT NULL,  -- timestamp de la carga a Fabric
    tabla             VARCHAR(30)  NOT NULL,
    filas_origen      INT          NOT NULL,  -- lo que declaraba el archivo
    CONSTRAINT pk_bronze_lote PRIMARY KEY NONCLUSTERED (lote_id, tabla) NOT ENFORCED
);
GO

-- ============================================================================
-- DEUDA RESUELTA -- extractores/movimientos.py ya no transforma
-- ----------------------------------------------------------------------------
-- Hasta la version anterior, el extractor hacia tres cosas que en un bronze
-- estricto no deberian pasar en la extraccion: descartaba filas sin cuenta o
-- fecha, convertia None a 0.0 (perdiendo la distincion "no habia monto" vs.
-- "el monto era cero") y hacia el join JrnlRow ⋈ JrnlHdr en Python, asi que
-- bronze.movimientos no era espejo de ninguna tabla real de Sage.
--
-- Las tres se resolvieron juntas: extraer_jrnlrow y extraer_jrnlhdr copian
-- cada tabla tal cual (nulos incluidos, sin cruzar nada), y bronze.jrnlrow /
-- bronze.jrnlhdr son ahora mirror fiel del origen. El filtro de nulos y el
-- join quedaron en staging.stg_movimientos, que es donde correspondian segun
-- la regla de esta capa. vw_control_calidad reporta lo que ese filtro
-- descarta, para que no desaparezca en silencio como antes.
-- ============================================================================
