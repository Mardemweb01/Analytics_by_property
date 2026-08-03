# ============================================================================
# MODULO: modelo/generar_bronze.py
# OBJETIVO: generar modelo/bronze/01_tablas.sql y modelo/carga/01_bronze.sql
# a partir del esquema real de Sage (los *_schema.json que deja
# extraer_y_guardar.py), en vez de mantenerlos a mano.
#
# POR QUE: desde que los extractores traen TODAS las columnas de cada tabla
# (185 en Chart, 168 en JrnlHdr, etc.), escribir el DDL a mano es inviable y
# ademas se desactualiza solo apenas cambia de version Sage o de PH. Este
# script lee el esquema real y escribe el .sql -- el archivo resultante es
# el mismo tipo de DDL valido que se hubiera escrito a mano, pero nadie lo
# tipeo columna por columna.
#
# LOS ARCHIVOS GENERADOS SE COMMITEAN IGUAL que si fueran escritos a mano --
# lo que cambia es quien los escribe, no que dejen de versionarse. Volver a
# correr este script sobreescribe ambos archivos por completo.
#
# Uso:
#   python modelo/generar_bronze.py [--data DIR]
#
# Requiere que ya haya corrido extraer_y_guardar.py contra el DSN real, para
# que existan los *_schema.json en el directorio de datos.
# ============================================================================

import argparse
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).parent.parent
MODELO_DIR = Path(__file__).parent

# Nombre de tabla bronze (minuscula, como ya las venia llamando el proyecto)
# para cada extractor.
TABLAS = ["chart", "customers", "vendors", "jrnlrow", "jrnlhdr"]

# Las cinco columnas de metadata que lleva toda tabla de bronze -- estas SI
# siguen siendo fijas, no salen del esquema de Sage. Ver la nota extensa en
# el 01_tablas.sql generado.
METADATA = [
    ("_lote_id", "VARCHAR(40)"),
    ("_propiedad_origen", "VARCHAR(30)"),
    ("_dsn_origen", "VARCHAR(50)"),
    ("_archivo_origen", "VARCHAR(400)"),
    ("_cargado_en", "DATETIME2(3)"),
]


class ErrorGeneracion(Exception):
    """Falla que corta la generacion, con mensaje util en vez de traceback."""


# Traduce un tipo ODBC (el que devuelve cursor.columns()) al tipo T-SQL que
# va a tener la columna en bronze. No es una traduccion ODBC->SQL generica:
# refleja lo que REALMENTE termina en el Parquet, que pasa por
# extractores/_comun.py:_valor_json() antes de llegar aca --
#   - DATE/TIMESTAMP se convierten a string (str(fecha)) en la extraccion,
#     asi que en bronze son VARCHAR, no DATE. El parseo real es trabajo de
#     staging (TRY_CAST), igual que ya se hacia con JrnlRow.fecha.
#   - BINARY (GUIDs) se convierten a string hexadecimal, asi que tambien son
#     VARCHAR, con el doble de caracteres que bytes tenga la columna.
#   - IDENTITY es un entero comun en bronze -- no se usa IDENTITY real:
#     los valores se insertan explicitos via COPY INTO, no se autogeneran.
def _tipo_sql(columna: dict) -> str:
    tipo = columna["tipo"]
    tamano = columna["tamano"] or 0

    if tipo in ("VARCHAR", "CHAR"):
        return f"VARCHAR({max(tamano, 1)})"
    if tipo in ("INTEGER", "UINTEGER", "IDENTITY"):
        return "INT"
    if tipo in ("SMALLINT", "USMALLINT"):
        return "SMALLINT"
    # UTINYINT -> SMALLINT, no TINYINT: el Warehouse de Fabric no soporta
    # TINYINT ("The data type 'tinyint' ... is not supported in this edition of
    # SQL Server", Msg 24574 al crear la tabla). SMALLINT es el entero mas
    # chico que si soporta y cubre el rango 0-255 sin perder nada.
    #
    # Tampoco BIT, aunque muchas de estas columnas parezcan booleanas
    # (IsProspect, CustomerIsInactive...): BIT solo guarda 0/1 y bronze es
    # copia fiel. Si Sage mete un 2 en alguna, se veria aca y no se perderia.
    if tipo == "UTINYINT":
        return "SMALLINT"
    if tipo == "DECIMAL":
        return "DECIMAL(19,4)"
    if tipo in ("DATE", "TIMESTAMP"):
        return "VARCHAR(30)"
    if tipo == "BINARY":
        return f"VARCHAR({max(tamano * 2, 32)})"

    raise ErrorGeneracion(
        f"Tipo ODBC sin mapeo: {tipo!r} (columna {columna['columna']!r}). "
        "Agregar el caso en _tipo_sql() antes de continuar -- no se puede "
        "adivinar el tipo T-SQL correcto."
    )


def _cargar_esquema(data_dir: Path, tabla: str) -> list[dict]:
    archivo = data_dir / f"{tabla}_schema.json"
    if not archivo.exists():
        raise ErrorGeneracion(
            f"No existe {archivo}. Correr extraer_y_guardar.py primero -- "
            "este script no se conecta a Sage, lee el esquema que ya se extrajo."
        )
    return json.loads(archivo.read_text(encoding="utf-8"))


def _generar_create_table(tabla: str, esquema: list[dict]) -> str:
    lineas = [f'    "{c["columna"]}" {_tipo_sql(c)} NULL,' for c in esquema]
    lineas += [f'    "{nombre}" {tipo} NOT NULL,' for nombre, tipo in METADATA[:-1]]
    nombre_meta, tipo_meta = METADATA[-1]
    lineas.append(f'    "{nombre_meta}" {tipo_meta} NOT NULL')

    return (
        f"-- bronze.{tabla} -- {len(esquema)} columnas de Sage + metadata.\n"
        f"-- Generado por modelo/generar_bronze.py, no editar a mano.\n"
        f"CREATE TABLE bronze.{tabla} (\n" + "\n".join(lineas) + "\n);\nGO\n"
    )


def _generar_copy_into(tabla: str, esquema: list[dict]) -> str:
    columnas = [c["columna"] for c in esquema] + [n for n, _ in METADATA]
    lista = ",\n     ".join(f'"{c}"' for c in columnas)
    return (
        f"COPY INTO bronze.{tabla}\n"
        f"    ({lista})\n"
        f"FROM '$(ruta_base)/{tabla}.parquet'\n"
        f"WITH (FILE_TYPE = 'PARQUET');\nGO\n"
    )


ENCABEZADO_TABLAS = '''-- ============================================================================
-- CAPA BRONZE -- copia fiel de lo que devuelve Sage 50.
--
-- GENERADO por modelo/generar_bronze.py a partir de los *_schema.json que
-- deja extraer_y_guardar.py. NO EDITAR A MANO -- correr el generador de
-- nuevo si el esquema de Sage cambia (otra version, otro PH con columnas
-- custom). El archivo resultante es DDL valido, igual que si se hubiera
-- escrito a mano; lo unico que cambia es quien lo escribio.
--
-- REGLA DE ESTA CAPA (sigue vigente, el generador no la rompe): no se
-- transforma nada. Todas las columnas de cada tabla, mas metadata de carga.
--
-- Las columnas de fecha (DATE/TIMESTAMP en Sage) y las binarias (BINARY,
-- ej. GUIDs) llegan como VARCHAR -- la extraccion las convierte a texto
-- antes de escribir el JSON (ver extractores/_comun.py:_valor_json). El
-- parseo real es trabajo de staging, no de bronze.
--
-- AISLAMIENTO: se despliega una vez por propiedad en su propio workspace.
-- Ver ARQUITECTURA.md.
-- ============================================================================

CREATE SCHEMA bronze;
GO

-- ============================================================================
-- METADATA DE CARGA -- las cinco columnas con prefijo _ que llevan todas las
-- tablas de esta capa. Ver la nota completa sobre _propiedad_origen en
-- ARQUITECTURA.md -- es una ASERCION para detectar mezcla entre PH, nunca
-- una dimension para filtrar.
-- ============================================================================

'''

PIE_TABLAS = '''
-- ----------------------------------------------------------------------------
-- bronze.lote -- registro de cada corrida de carga. No sale del esquema de
-- Sage, es propia del pipeline -- el generador no la toca.
-- ----------------------------------------------------------------------------
CREATE TABLE bronze.lote (
    lote_id           VARCHAR(40)  NOT NULL,
    propiedad_origen  VARCHAR(30)  NOT NULL,
    dsn_origen        VARCHAR(50)  NOT NULL,
    extraido_en       DATETIME2(3) NULL,
    cargado_en        DATETIME2(3) NOT NULL,
    tabla             VARCHAR(30)  NOT NULL,
    filas_origen      INT          NOT NULL
);
GO

-- La PK va en un ALTER aparte, no dentro del CREATE TABLE: el Warehouse de
-- Fabric rechaza la constraint inline con "The PRIMARY KEY keyword is not
-- supported in the CREATE TABLE statement in this edition of SQL Server"
-- (Msg 24584), aunque la sintaxis NONCLUSTERED/NOT ENFORCED sea la correcta.
--
-- NOT ENFORCED es obligatorio: Fabric no valida unicidad, la PK es solo
-- metadata para que el optimizador y las herramientas de modelado sepan cual
-- es la clave. No sustituye a una verificacion real.
ALTER TABLE bronze.lote
    ADD CONSTRAINT pk_bronze_lote PRIMARY KEY NONCLUSTERED (lote_id, tabla) NOT ENFORCED;
GO
'''

ENCABEZADO_CARGA = '''-- ============================================================================
-- CARGA A BRONZE -- COPY INTO desde los Parquet que estan en OneLake.
--
-- GENERADO por modelo/generar_bronze.py -- NO EDITAR A MANO. La variable
-- ruta_base la arma cargar_a_fabric.py a partir de la propiedad.
--
-- BRONZE ES APPEND-ONLY: esto NO trunca. Ver modelo/bronze/01_tablas.sql.
-- ============================================================================

'''

PIE_CARGA = '''
COPY INTO bronze.lote
    ("lote_id", "propiedad_origen", "dsn_origen", "extraido_en", "cargado_en", "tabla", "filas_origen")
FROM '$(ruta_base)/lote.parquet'
WITH (FILE_TYPE = 'PARQUET');
GO
'''


def generar(data_dir: Path):
    partes_tablas = [ENCABEZADO_TABLAS]
    partes_carga = [ENCABEZADO_CARGA]

    for tabla in TABLAS:
        esquema = _cargar_esquema(data_dir, tabla)
        partes_tablas.append(_generar_create_table(tabla, esquema))
        partes_carga.append(_generar_copy_into(tabla, esquema))
        print(f"  {tabla:12} {len(esquema):3} columnas")

    partes_tablas.append(PIE_TABLAS)
    partes_carga.append(PIE_CARGA)

    destino_tablas = MODELO_DIR / "bronze" / "01_tablas.sql"
    destino_carga = MODELO_DIR / "carga" / "01_bronze.sql"
    destino_tablas.write_text("\n".join(partes_tablas), encoding="utf-8")
    destino_carga.write_text("\n".join(partes_carga), encoding="utf-8")
    print(f"\nEscrito: {destino_tablas}")
    print(f"Escrito: {destino_carga}")


def main():
    parser = argparse.ArgumentParser(
        description="Genera bronze/01_tablas.sql y carga/01_bronze.sql desde los *_schema.json extraidos"
    )
    parser.add_argument("--data", default=str(RAIZ / "data"), help="Directorio con los *_schema.json")
    args = parser.parse_args()

    print("Generando DDL de bronze desde el esquema real...")
    generar(Path(args.data))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ErrorGeneracion as e:
        print(f"\nABORTADO: {e}", file=sys.stderr)
        sys.exit(1)
