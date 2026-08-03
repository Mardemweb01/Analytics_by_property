# ============================================================================
# MODULO: cargar_a_fabric.py
# OBJETIVO: llevar una extraccion de Sage 50 desde los .json de data/ hasta el
# Warehouse de Fabric de ESA propiedad, y abortar si algo no cuadra.
#
# Uso:
#   python cargar_a_fabric.py demo
#   python cargar_a_fabric.py demo --corrida 2026-07-28T1430
#   python cargar_a_fabric.py demo --solo-preparar    (no sube ni carga)
#
# LA PROPIEDAD ES LA UNICA ENTRADA. De ella se derivan el DSN declarado, la
# carpeta de origen, el workspace, el lakehouse y el warehouse -- todo sale de
# propiedades.json. No hay forma de pasar un origen de un PH y un destino de
# otro, porque el destino no se pasa: se deriva. Ver ARQUITECTURA.md.
#
# Corre en la PC de 64 bits (la misma que convertir_parquet.py), no en la que
# tiene Sage: necesita pandas/pyarrow, que no tienen wheels para Windows 32-bit.
#
# Dependencias:  pip install -r requirements-fabric.txt
# ============================================================================

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

# Los paquetes de Azure se importan dentro de subir(), no aca: asi
# --solo-preparar funciona en una maquina que solo tenga pandas/pyarrow, sin
# obligar a instalar el SDK de Azure para generar los Parquet.

RAIZ = Path(__file__).parent
DATA_DIR = RAIZ / "data"
MODELO_DIR = RAIZ / "modelo"
CONFIG = RAIZ / "propiedades.json"

ONELAKE = "https://onelake.dfs.fabric.microsoft.com"

# Las 5 tablas que trae extraer_y_guardar.py. Reemplaza al viejo diccionario
# COLUMNAS hardcodeado: desde que los extractores traen TODAS las columnas de
# cada tabla (185 en Chart, 168 en JrnlHdr...), mantener esa lista a mano dejo
# de ser viable. Las columnas se derivan en tiempo de carga desde
# <tabla>_schema.json (el sidecar que deja extraer_y_guardar.py junto a cada
# <tabla>.json) -- ver columnas_de() mas abajo.
TABLAS = ["chart", "customers", "vendors", "jrnlrow", "jrnlhdr"]

# Las cinco columnas de metadata que lleva toda tabla de bronze, en el orden en
# que van despues de las de negocio.
METADATA = ["_lote_id", "_propiedad_origen", "_dsn_origen", "_archivo_origen", "_cargado_en"]

# Tipos ODBC que en bronze terminan siendo un entero (INT/SMALLINT/TINYINT) y
# por lo tanto hay que forzar a entero nullable ("Int64" de pandas, con I
# mayuscula) antes de escribir el Parquet. Mismo mapeo que
# modelo/generar_bronze.py:_tipo_sql() -- tiene que coincidir, porque es lo
# que decide si la columna en bronze es un tipo numerico o no.
#
# Sin este cast pandas infiere float64 en cuanto la columna tiene un solo nulo
# -- el caso de casi cualquier *RecordNumber, nulos en la mayoria de las
# lineas-- y el Parquet sale con tipo double. COPY INTO contra una columna
# INT del Warehouse entonces falla o trunca. Se detecto probando la
# preparacion contra los datos reales.
TIPOS_ENTEROS = {"INTEGER", "UINTEGER", "SMALLINT", "USMALLINT", "UTINYINT", "IDENTITY"}


def columnas_de(tabla, origen):
    """Lee <tabla>_schema.json y devuelve (columnas, enteros): la lista de
    columnas de negocio de esa tabla, y cuales de ellas son de tipo entero.

    El sidecar de esquema se genera junto con los datos (ver
    extraer_y_guardar.py) -- viene de la misma corrida, asi que columnas y
    datos siempre coinciden en version."""
    archivo = origen / f"{tabla}_schema.json"
    if not archivo.exists():
        raise ErrorCarga(
            f"Falta {archivo}. extraer_y_guardar.py tiene que generar el "
            "sidecar de esquema junto con los datos -- correr la extraccion "
            "de nuevo si este archivo es de una version vieja del extractor."
        )
    esquema = json.loads(archivo.read_text(encoding="utf-8"))
    columnas = [c["columna"] for c in esquema]
    enteros = [c["columna"] for c in esquema if c["tipo"] in TIPOS_ENTEROS]
    return columnas, enteros


class ErrorCarga(Exception):
    """Falla que corta el proceso. Se distingue de un bug para poder mostrar un
    mensaje util en vez de un traceback."""


# ----------------------------------------------------------------------------
# Configuracion y ubicacion del origen
# ----------------------------------------------------------------------------

def cargar_config(propiedad):
    """Resuelve la propiedad contra propiedades.json. Falla si no existe o si
    esta marcada inactiva -- nunca cae a un default, porque un default acá
    significa cargar el PH equivocado."""
    if not CONFIG.exists():
        raise ErrorCarga(f"No existe {CONFIG.name}")

    propiedades = json.loads(CONFIG.read_text(encoding="utf-8"))["propiedades"]
    if propiedad not in propiedades:
        conocidas = ", ".join(sorted(propiedades))
        raise ErrorCarga(f'Propiedad "{propiedad}" no esta en {CONFIG.name}. Conocidas: {conocidas}')

    cfg = propiedades[propiedad]
    if not cfg.get("activa", False):
        raise ErrorCarga(f'La propiedad "{propiedad}" esta marcada como inactiva')
    return cfg


def ubicar_origen(propiedad, corrida):
    """Devuelve (carpeta, es_carpeta_por_propiedad).

    Camino correcto: data/<propiedad>/<corrida>/. Camino de transicion:
    data/*.json suelto, que es lo que deja hoy extraer_y_guardar.py. El segundo
    se acepta pero se avisa, porque en ese caso la propiedad la DECLARA el
    operador en vez de derivarse del DSN de extraccion -- que es mas debil."""
    por_propiedad = DATA_DIR / propiedad
    if por_propiedad.is_dir():
        corridas = sorted(d for d in por_propiedad.iterdir() if d.is_dir())
        if not corridas:
            raise ErrorCarga(f"No hay corridas en {por_propiedad}")
        if corrida:
            elegida = por_propiedad / corrida
            if not elegida.is_dir():
                raise ErrorCarga(f"No existe la corrida {corrida} en {por_propiedad}")
        else:
            elegida = corridas[-1]
        return elegida, True

    if list(DATA_DIR.glob("*.json")):
        return DATA_DIR, False

    raise ErrorCarga(f"No encontre datos: ni {por_propiedad} ni {DATA_DIR}/*.json")


# ----------------------------------------------------------------------------
# Preparacion: JSON -> Parquet con el sello de propiedad adentro
# ----------------------------------------------------------------------------

def preparar_parquet(origen, destino, propiedad, cfg, lote_id, ahora):
    """Convierte los .json a .parquet agregando las columnas de metadata.

    El sello de propiedad va DENTRO del archivo, no solo en la ruta: una ruta
    se puede equivocar al subir, un sello viaja con el dato. Es lo que permite
    que la verificacion posterior detecte una mezcla."""
    destino.mkdir(parents=True, exist_ok=True)
    resumen = []

    for tabla in TABLAS:
        columnas, enteros = columnas_de(tabla, origen)

        archivo = origen / f"{tabla}.json"
        if not archivo.exists():
            raise ErrorCarga(f"Falta {archivo}")

        filas = json.loads(archivo.read_text(encoding="utf-8"))
        df = pd.DataFrame(filas)

        faltantes = [c for c in columnas if c not in df.columns]
        if faltantes:
            raise ErrorCarga(f"{archivo.name} no trae las columnas: {', '.join(faltantes)}")

        df = df[columnas].copy()
        for columna in enteros:
            df[columna] = df[columna].astype("Int64")

        df["_lote_id"] = lote_id
        df["_propiedad_origen"] = propiedad
        df["_dsn_origen"] = cfg["dsn"]
        df["_archivo_origen"] = str(archivo)
        df["_cargado_en"] = ahora

        df = df[columnas + METADATA]
        df.to_parquet(destino / f"{tabla}.parquet", index=False)

        resumen.append({
            "lote_id": lote_id,
            "propiedad_origen": propiedad,
            "dsn_origen": cfg["dsn"],
            "extraido_en": datetime.fromtimestamp(archivo.stat().st_mtime, timezone.utc),
            "cargado_en": ahora,
            "tabla": tabla,
            "filas_origen": len(df),
        })
        print(f"  {tabla:12} {len(df):6,} filas")

    pd.DataFrame(resumen).to_parquet(destino / "lote.parquet", index=False)
    return {r["tabla"]: r["filas_origen"] for r in resumen}


# ----------------------------------------------------------------------------
# Subida a OneLake
# ----------------------------------------------------------------------------

def subir(local, cfg, propiedad, lote_id):
    """Sube los .parquet al area Files/ del Lakehouse de ESTA propiedad.

    El workspace y el lakehouse salen de la config, no de un argumento: es
    donde se materializa el principio de que el destino se deriva y no se
    elige."""
    try:
        from azure.identity import DefaultAzureCredential
        from azure.storage.filedatalake import DataLakeServiceClient
    except ImportError as e:
        raise ErrorCarga(
            "Faltan los paquetes de Azure para subir a OneLake.\n"
            "  pip install -r requirements-fabric.txt"
        ) from e

    credencial = DefaultAzureCredential(exclude_interactive_browser_credential=False)
    servicio = DataLakeServiceClient(account_url=ONELAKE, credential=credencial)
    sistema = servicio.get_file_system_client(cfg["workspace"])

    ruta_relativa = f'{cfg["lakehouse"]}.Lakehouse/Files/bronze/{propiedad}/{lote_id}'

    for archivo in sorted(local.glob("*.parquet")):
        cliente = sistema.get_file_client(f"{ruta_relativa}/{archivo.name}")
        with archivo.open("rb") as f:
            cliente.upload_data(f, overwrite=True)
        print(f"  subido  {archivo.name}")

    return f'{ONELAKE}/{cfg["workspace"]}/{ruta_relativa}'


# ----------------------------------------------------------------------------
# Ejecucion de SQL contra el Warehouse
# ----------------------------------------------------------------------------

# go-sqlcmd (github.com/microsoft/go-sqlcmd), el reemplazo moderno de la
# herramienta clasica. Se busca por ruta completa y no por PATH a proposito:
# se instala con el MISMO nombre que el sqlcmd viejo de las herramientas ODBC,
# y cual gana depende del orden del PATH. Resolver por ruta hace que no importe.
GO_SQLCMD = Path(r"C:\Program Files\sqlcmd\sqlcmd.exe")


def _comando_base(cfg):
    """Arma el comando y los flags de autenticacion segun que sqlcmd haya.

    El sqlcmd clasico v17 solo sabe autenticar de dos formas: contra el dominio
    de Windows (-G solo, falla con "Default account not found" en una PC que no
    esta unida a un dominio) o con usuario+contraseña. Ninguna sirve para una
    cuenta Entra con MFA. go-sqlcmd agrega ActiveDirectoryInteractive, que abre
    el navegador -- por eso se prefiere cuando esta instalado.

    El UPN sale de la variable de entorno FABRIC_USER y no de propiedades.json
    a proposito: es de quien opera, no de la propiedad. El mismo Warehouse lo
    puede desplegar otra persona desde otra maquina."""
    usuario = os.environ.get("FABRIC_USER")

    if GO_SQLCMD.exists():
        cmd = [str(GO_SQLCMD), "--authentication-method=ActiveDirectoryInteractive"]
        if usuario:
            cmd += ["-U", usuario]
        return cmd

    cmd = ["sqlcmd", "-G"]
    if usuario:
        cmd += ["-U", usuario]
    return cmd


def sqlcmd(cfg, *, archivo=None, consulta=None, variables=None):
    """Corre sqlcmd contra el Warehouse de la propiedad y devuelve stdout.

    -b hace que sqlcmd devuelva codigo de error si el SQL falla, que es lo que
    permite que este script aborte en vez de seguir con una carga a medias."""
    cmd = _comando_base(cfg) + [
        "-S", cfg["warehouse_endpoint"],
        "-d", cfg["warehouse"],
        "-b",
        "-h", "-1",     # sin encabezados
        "-W",           # sin relleno de espacios
        "-s", "|",      # separador de columnas
    ]
    if archivo:
        cmd += ["-i", str(archivo)]
    if consulta:
        cmd += ["-Q", consulta]
    if variables:
        cmd.append("-v")
        cmd += [f"{k}={v}" for k, v in variables.items()]

    proceso = subprocess.run(cmd, capture_output=True, text=True)
    if proceso.returncode != 0:
        salida = f"{proceso.stdout.strip()}\n{proceso.stderr.strip()}"
        pista = ""
        if "Default account not found" in salida or "ActiveDirectory" in salida:
            pista = (
                f"\n  Autenticacion. go-sqlcmd {'SI' if GO_SQLCMD.exists() else 'NO'} esta en {GO_SQLCMD}.\n"
                "  Si falta:  winget install Microsoft.Sqlcmd\n"
                '  El UPN sale de FABRIC_USER:  $env:FABRIC_USER = "usuario@tudominio.onmicrosoft.com"'
            )
        raise ErrorCarga(f"sqlcmd fallo (codigo {proceso.returncode}):\n{salida}{pista}")
    return proceso.stdout


def filas_de(salida):
    """Convierte la salida de sqlcmd en lista de listas, descartando el ruido
    ('(N rows affected)', lineas en blanco)."""
    filas = []
    for linea in salida.splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("(") or set(linea) <= set("- "):
            continue
        filas.append([c.strip() for c in linea.split("|")])
    return filas


# ----------------------------------------------------------------------------
# Verificaciones que cortan el proceso
# ----------------------------------------------------------------------------

def verificar_aislamiento(cfg, propiedad):
    """LA verificacion critica: que todo lo que quedo en bronze declare esta
    propiedad. Si aparece otra, se cargo el PH equivocado y hay que parar antes
    de que llegue a silver y de ahi a un dashboard."""
    consulta = (
        "SELECT tabla, _propiedad_origen, filas FROM ("
        "SELECT 'chart' AS tabla, _propiedad_origen, COUNT(*) AS filas FROM bronze.chart GROUP BY _propiedad_origen "
        "UNION ALL SELECT 'customers', _propiedad_origen, COUNT(*) FROM bronze.customers GROUP BY _propiedad_origen "
        "UNION ALL SELECT 'vendors', _propiedad_origen, COUNT(*) FROM bronze.vendors GROUP BY _propiedad_origen "
        "UNION ALL SELECT 'jrnlrow', _propiedad_origen, COUNT(*) FROM bronze.jrnlrow GROUP BY _propiedad_origen "
        "UNION ALL SELECT 'jrnlhdr', _propiedad_origen, COUNT(*) FROM bronze.jrnlhdr GROUP BY _propiedad_origen"
        f") AS t WHERE _propiedad_origen <> '{propiedad}'"
    )
    intrusas = filas_de(sqlcmd(cfg, consulta=consulta))
    if intrusas:
        detalle = "\n".join(f"    {f[0]}: {f[1]} ({f[2]} filas)" for f in intrusas)
        raise ErrorCarga(
            "MEZCLA DE PROPIEDADES en bronze. Este Warehouse es de "
            f'"{propiedad}" pero contiene datos de otra:\n{detalle}\n'
            "  El Warehouse quedo contaminado: hay que vaciarlo antes de reintentar."
        )
    print(f'  aislamiento OK -- todo bronze declara "{propiedad}"')


def verificar_calidad(cfg):
    """Consulta vw_control_calidad. Los ERROR cortan; los AVISO se listan."""
    filas = filas_de(sqlcmd(
        cfg, consulta="SELECT severidad, control, detalle, filas FROM dbo.vw_control_calidad"
    ))
    errores = [f for f in filas if f and f[0] == "ERROR"]
    avisos = [f for f in filas if f and f[0] == "AVISO"]

    for f in avisos:
        print(f"  AVISO  {f[1]} ({f[2]}) -- {f[3]} filas")

    if errores:
        detalle = "\n".join(f"    {f[1]} ({f[2]}) -- {f[3]} filas" for f in errores)
        raise ErrorCarga(
            f"El control de calidad encontro errores:\n{detalle}\n"
            "  Corregir el origen y volver a correr. La carga es full refresh,\n"
            "  asi que reintentar es seguro y no deja duplicados."
        )
    print(f"  calidad OK ({len(avisos)} avisos)")


def conciliar(cfg, esperado):
    """Compara las filas que traia cada archivo contra las que quedaron en
    bronze para este lote. Si no coincide, se perdio algo en el camino."""
    for tabla, filas_origen in esperado.items():
        salida = filas_de(sqlcmd(
            cfg,
            consulta=(
                f"SELECT COUNT(*) FROM bronze.{tabla} WHERE _lote_id IN "
                "(SELECT lote_id FROM staging.vw_lote_actual)"
            ),
        ))
        cargadas = int(salida[0][0])
        if cargadas != filas_origen:
            raise ErrorCarga(
                f"{tabla}: el archivo traia {filas_origen:,} filas pero en bronze "
                f"quedaron {cargadas:,}"
            )
    print("  conciliacion OK -- las filas del origen coinciden con bronze")


# ----------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Carga una extraccion de Sage 50 al Warehouse de Fabric de esa propiedad"
    )
    parser.add_argument("propiedad", help="Id de propiedad, tal como figura en propiedades.json")
    parser.add_argument("--corrida", help="Corrida a cargar (por defecto, la mas reciente)")
    parser.add_argument(
        "--solo-preparar", action="store_true",
        help="Genera los Parquet y termina, sin subir ni cargar",
    )
    args = parser.parse_args()

    cfg = cargar_config(args.propiedad)
    origen, por_propiedad = ubicar_origen(args.propiedad, args.corrida)

    ahora = datetime.now(timezone.utc)
    lote_id = f'{args.propiedad}-{ahora.strftime("%Y%m%dT%H%M%SZ")}'

    print(f'Propiedad : {args.propiedad} ({cfg["nombre"]})')
    print(f"Origen    : {origen}")
    print(f'Destino   : {cfg["workspace"]} / {cfg["warehouse"]}')
    print(f"Lote      : {lote_id}\n")

    if not por_propiedad:
        print(
            "AVISO -- los datos estan en data/*.json suelto, sin separar por propiedad.\n"
            "  La propiedad la estas DECLARANDO vos, no se deriva del DSN de extraccion.\n"
            "  Si en esa carpeta quedaron datos de otro PH, este proceso no puede saberlo.\n"
            "  Arreglar extraer_y_guardar.py para que escriba a data/<propiedad>/<corrida>/.\n"
        )

    print("Preparando Parquet...")
    temporal = RAIZ / ".carga" / lote_id
    esperado = preparar_parquet(origen, temporal, args.propiedad, cfg, lote_id, ahora)

    if args.solo_preparar:
        print(f"\nListo (solo preparar). Archivos en {temporal}")
        return 0

    print("\nSubiendo a OneLake...")
    ruta_base = subir(temporal, cfg, args.propiedad, lote_id)

    print("\nCargando a bronze...")
    sqlcmd(cfg, archivo=MODELO_DIR / "carga" / "01_bronze.sql",
           variables={"ruta_base": ruta_base})

    print("\nVerificando...")
    verificar_aislamiento(cfg, args.propiedad)
    conciliar(cfg, esperado)

    print("\nCargando a silver...")
    sqlcmd(cfg, archivo=MODELO_DIR / "carga" / "02_silver.sql")

    print("\nControl de calidad...")
    verificar_calidad(cfg)

    print(f"\nListo. Lote {lote_id} cargado en {cfg['warehouse']}.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ErrorCarga as e:
        print(f"\nABORTADO: {e}", file=sys.stderr)
        sys.exit(1)
