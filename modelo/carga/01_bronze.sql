-- ============================================================================
-- CARGA A BRONZE -- COPY INTO desde los Parquet que estan en OneLake.
--
-- Se ejecuta con sqlcmd pasando la ruta de la corrida:
--   sqlcmd ... -v ruta_base="https://onelake.dfs.fabric.microsoft.com/..."
--
-- La variable la arma cargar_a_fabric.py a partir de la propiedad. No editarla
-- a mano: el punto del diseno es que la propiedad sea la unica entrada de la
-- que se deriva todo (ver ARQUITECTURA.md).
--
-- BRONZE ES APPEND-ONLY: esto NO trunca. Cada corrida agrega un lote y
-- staging.vw_lote_actual se queda con el mas reciente. Asi queda el historico
-- de que decia Sage en cada extraccion. A 6,521 filas por corrida el
-- crecimiento es irrelevante; si algun dia molesta, se purga por lote_id.
--
-- LAS COLUMNAS _ VIENEN EN EL PARQUET, no se agregan aca. cargar_a_fabric.py
-- las escribe al convertir de JSON, para que el sello de propiedad viaje
-- adentro del archivo y no dependa de la ruta.
--
-- CREDENCIAL: sin clausula CREDENTIAL, COPY INTO usa la identidad de quien
-- ejecuta. Para correrlo desatendido con un service principal hay que agregar
-- WITH (CREDENTIAL = (...)).
-- ============================================================================

COPY INTO bronze.chart
    (account_id, account_type, account_description, gl_acct_number,
     _lote_id, _propiedad_origen, _dsn_origen, _archivo_origen, _cargado_en)
FROM '$(ruta_base)/chart.parquet'
WITH (FILE_TYPE = 'PARQUET');
GO

COPY INTO bronze.customers
    (customer_id, nombre, saldo, customer_record_number,
     _lote_id, _propiedad_origen, _dsn_origen, _archivo_origen, _cargado_en)
FROM '$(ruta_base)/customers.parquet'
WITH (FILE_TYPE = 'PARQUET');
GO

COPY INTO bronze.vendors
    (vendor_id, nombre, saldo, vendor_record_number,
     _lote_id, _propiedad_origen, _dsn_origen, _archivo_origen, _cargado_en)
FROM '$(ruta_base)/vendors.parquet'
WITH (FILE_TYPE = 'PARQUET');
GO

COPY INTO bronze.jrnlrow
    (post_order, gl_acct_number, monto, journal, descripcion,
     customer_record_number, vendor_record_number, date_cleared,
     _lote_id, _propiedad_origen, _dsn_origen, _archivo_origen, _cargado_en)
FROM '$(ruta_base)/jrnlrow.parquet'
WITH (FILE_TYPE = 'PARQUET');
GO

COPY INTO bronze.jrnlhdr
    (post_order, fecha, referencia,
     _lote_id, _propiedad_origen, _dsn_origen, _archivo_origen, _cargado_en)
FROM '$(ruta_base)/jrnlhdr.parquet'
WITH (FILE_TYPE = 'PARQUET');
GO

COPY INTO bronze.lote
    (lote_id, propiedad_origen, dsn_origen, extraido_en, cargado_en, tabla, filas_origen)
FROM '$(ruta_base)/lote.parquet'
WITH (FILE_TYPE = 'PARQUET');
GO

-- ============================================================================
-- La VERIFICACION DE AISLAMIENTO no esta aca: la corre cargar_a_fabric.py
-- inmediatamente despues, y es la que decide abortar.
--
-- Confirma que todas las filas cargadas declaran la propiedad que corresponde
-- a este Warehouse. Se mantiene del lado del orquestador para que haya un solo
-- lugar que corte el proceso, en vez de una comprobacion en SQL que imprime
-- algo y otra en Python que decide.
-- ============================================================================
