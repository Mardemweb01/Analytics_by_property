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
-- bronze.movimientos <- extractores/movimientos.py <- "JrnlRow" ⋈ "JrnlHdr"
--
-- fecha y date_cleared entran como VARCHAR porque asi las devuelve el
-- extractor (str(fecha) en Python). El parseo a DATE es trabajo de staging:
-- si una fecha viene malformada, esta capa la guarda igual y staging la
-- reporta, en vez de que la carga entera falle aca.
--
-- ADVERTENCIA -- este extractor NO cumple del todo la regla de bronze. Ver
-- "Deuda conocida" al pie del archivo.
-- ----------------------------------------------------------------------------
CREATE TABLE bronze.movimientos (
    gl_acct_number          INT           NULL,
    fecha                   VARCHAR(30)   NULL,
    monto                   DECIMAL(19,4) NULL,
    journal                 INT           NULL,
    referencia              VARCHAR(100)  NULL,
    descripcion             VARCHAR(400)  NULL,
    customer_record_number  INT           NULL,
    vendor_record_number    INT           NULL,
    date_cleared            VARCHAR(30)   NULL,

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
-- DEUDA CONOCIDA -- el extractor ya transforma, y eso rompe la regla de bronze
-- ----------------------------------------------------------------------------
-- extractores/movimientos.py hace tres cosas que en un bronze estricto no
-- deberian pasar en la extraccion. Ninguna es grave hoy; se documentan porque
-- cuando un numero no cuadre, hay que saber si el problema esta en Sage, en la
-- extraccion o en el modelo.
--
--   1. DESCARTA FILAS. Lineas 36-37: `if gl is None or fecha is None: continue`.
--      Los asientos sin cuenta o sin fecha se pierden y no queda registro de
--      cuantos fueron. Deberian cargarse y filtrarse en staging, con el conteo
--      a la vista.
--
--   2. CONVIERTE NULL A CERO. La funcion _num() mapea None -> 0.0. Despues de
--      eso no se puede distinguir "no habia monto" de "el monto era cero".
--      Perdida de informacion irreversible.
--
--   3. HACE EL JOIN. JrnlRow ⋈ JrnlHdr ocurre en el SELECT de extraccion, asi
--      que bronze.movimientos no es espejo de una tabla de Sage sino de una
--      vista nuestra. Es razonable por eficiencia, pero conviene tenerlo
--      explicito.
-- ============================================================================
