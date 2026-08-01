-- ============================================================================
-- MODULO: 03_mapeo_cuentas.sql
-- OBJETIVO: declarar las reglas de negocio que NO estan en Sage -- que cuentas
-- son banco, cuales son fondo de reserva, cuales son cartera, y a que rubro
-- del dashboard pertenece cada gasto.
--
-- ESTE ARCHIVO ES DISTINTO EN CADA PROPIEDAD. Los otros dos (dimensiones y
-- hechos) son identicos en todos los Warehouses; este no puede serlo, porque
-- cada PH es una compania Sage separada con su propio plan de cuentas. Es el
-- unico archivo del modelo que se edita por PH.
--
-- POR QUE UNA TABLA Y NO UN CASE EN EL CODIGO: estas reglas las define quien
-- administra el PH, no quien programa. Como tabla se revisan, se versionan en
-- git y se corrigen sin tocar una sola linea de SQL ni de TypeScript. Es la
-- entrada humana del pipeline; todo lo demas es mecanico.
--
-- POR QUE NO SE DEDUCEN DE account_type: porque el tipo de Sage no alcanza.
-- Caso real de esta extraccion -- la cuenta 11500-00 "Allowance for Doubtful
-- Account" tiene account_type = 1 (Cuentas por Cobrar) igual que la cartera
-- genuina, pero es una CONTRA-cuenta: representa lo que se estima incobrable.
-- Si se dedujera es_por_cobrar = (account_type = 1), esa cuenta entraria a la
-- cartera y la morosidad quedaria inflada. La distincion es contable, no
-- estructural, y por eso se declara a mano.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- mapeo_cuenta -- seed editable. La transformacion la LEFT JOIN-ea contra
-- Chart para poblar el bloque (c) de dim_cuenta.
--
-- Una cuenta sin fila aca no rompe nada: cae con los flags en 0 y rubro NULL,
-- es decir, no la cuenta ninguna metrica. Eso es deliberado -- se prefiere que
-- una cuenta nueva quede fuera y se note, a que entre silenciosamente a un
-- total por una regla implicita.
-- ----------------------------------------------------------------------------
CREATE TABLE silver.mapeo_cuenta (
    gl_acct_number    INT         NOT NULL,
    rubro             VARCHAR(40) NULL,
    es_banco          BIT         NOT NULL,
    es_fondo_reserva  BIT         NOT NULL,
    es_por_cobrar     BIT         NOT NULL,
    CONSTRAINT pk_mapeo_cuenta PRIMARY KEY NONCLUSTERED (gl_acct_number) NOT ENFORCED
);
GO

-- ============================================================================
-- SEED DE EJEMPLO -- NO ES DATO DE PRODUCCION
-- ----------------------------------------------------------------------------
-- ADVERTENCIA: las cuentas de abajo son las de la COMPANIA DE DEMO de Sage 50
-- (Bellwether Garden Supply), que es lo que hay hoy en data/chart.json: un
-- comercio de jardineria con cuentas en ingles y movimientos de 2017 a 2022.
-- NO es un PH panameno.
--
-- Sirve para dos cosas y solo para dos: probar que la transformacion corre de
-- punta a punta, y mostrar la forma que tiene que tener el seed real. Los
-- rubros ('Seguridad', 'Limpieza', ...) que espera el dashboard NO EXISTEN en
-- este plan de cuentas -- por eso ninguna fila de abajo asigna rubro.
--
-- El seed real se arma contra el plan de cuentas de cada PH, con su
-- administrador, y reemplaza este bloque entero.
-- ============================================================================

INSERT INTO silver.mapeo_cuenta
    (gl_acct_number, rubro, es_banco, es_fondo_reserva, es_por_cobrar)
VALUES
    -- Efectivo y bancos (account_type 0).
    -- Petty Cash y Cash on Hand entran como banco: la tarjeta "Saldo en
    -- Bancos" del dashboard es disponibilidad total, no solo cuentas
    -- corrientes. Si el administrador lo define distinto, se cambian estos dos
    -- flags y ninguna consulta se toca.
    (  1, NULL, 1, 0, 0),  -- 10000-00 Petty Cash
    (  3, NULL, 1, 0, 0),  -- 10200-00 Regular Checking Account
    (  4, NULL, 1, 0, 0),  -- 10300-00 Payroll Checking Account
    (161, NULL, 1, 0, 0),  -- 10100-00 Cash on Hand

    -- Savings Account: banco Y fondo de reserva a la vez. Los flags son
    -- independientes a proposito -- el saldo en bancos la incluye, y el fondo
    -- de reserva tambien. No son categorias mutuamente excluyentes.
    (  5, NULL, 1, 1, 0),  -- 10400-00 Savings Account

    -- Cartera (account_type 1). Las tres primeras son cobrables de verdad.
    (  6, NULL, 0, 0, 1),  -- 11000-00 Accounts Receivable
    (  7, NULL, 0, 0, 1),  -- 11100-00 Contracts Receivable
    (  8, NULL, 0, 0, 1),  -- 11400-00 Other Receivables

    -- 11500-00 Allowance for Doubtful Account: MISMO account_type que las de
    -- arriba, pero es_por_cobrar = 0. Es la contra-cuenta de estimacion de
    -- incobrables; contarla como cartera duplicaria el efecto de la mora.
    -- Esta fila es el ejemplo de por que este archivo existe.
    (  9, NULL, 0, 0, 0);
GO
