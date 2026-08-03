# ============================================================================
# MODULO: desplegar_modelo.py
# OBJETIVO: correr el DDL de modelo/ contra el Warehouse de UNA propiedad.
# Reemplaza la linea de sqlcmd escrita a mano que documenta modelo/README.md:
# con seis PH son seis despliegues por cada cambio de esquema, y a mano se
# presta a pegar el endpoint de un PH con el warehouse de otro.
#
# Uso:
#   python desplegar_modelo.py hortensias                # las 7 capas, en orden
#   python desplegar_modelo.py hortensias --solo bronze  # solo una
#   python desplegar_modelo.py hortensias --mostrar      # imprime, no ejecuta
#
# LA PROPIEDAD ES LA UNICA ENTRADA, igual que en cargar_a_fabric.py: endpoint
# y warehouse salen de propiedades.json, no de la linea de comandos. Por eso
# no existe un flag --endpoint: si el destino se pudiera pasar suelto, se
# podria desplegar el modelo de un PH sobre el Warehouse de otro.
#
# ESTO CORRE UNA VEZ POR PROPIEDAD, no en cada extraccion. La carga de datos
# es cargar_a_fabric.py y esa si corre siempre.
#
# Dependencias: sqlcmd (viene con las herramientas ODBC de SQL Server).
# ============================================================================

import argparse
import sys
from pathlib import Path

# Se reusan de cargar_a_fabric.py en vez de duplicarlas: cargar_config es la
# que garantiza que la propiedad exista y este activa, y sqlcmd ya trae el -b
# que hace abortar cuando el SQL falla. Efecto colateral: importar ese modulo
# arrastra pandas, que este script no necesita -- es el precio de no tener dos
# copias de la misma logica de ruteo.
from cargar_a_fabric import ErrorCarga, cargar_config, sqlcmd

MODELO_DIR = Path(__file__).parent / "modelo"

# El orden NO es cosmetico: las vistas de staging referencian bronze.* y
# silver.mapeo_cuenta, y las de gold referencian silver.*. Corriendo un archivo
# antes que sus dependencias, el CREATE falla porque el objeto todavia no
# existe. Ver modelo/README.md.
CAPAS = [
    ("bronze", "bronze/01_tablas.sql"),
    ("staging", "staging/01_vistas.sql"),
    ("silver-dimensiones", "silver/01_dimensiones.sql"),
    ("silver-hechos", "silver/02_hechos.sql"),
    ("silver-mapeo", "silver/03_mapeo_cuentas.sql"),
    ("gold", "gold/01_agregados.sql"),
    ("calidad", "99_control_calidad.sql"),
]


def elegir_capas(solo):
    """Devuelve las capas a desplegar, siempre en el orden de CAPAS.

    `solo` puede nombrar varias capas; el orden en que se pasen no importa,
    porque se reordena -- pedir "gold,bronze" despliega bronze primero."""
    if not solo:
        return CAPAS

    pedidas = {nombre.strip() for nombre in solo.split(",")}
    conocidas = {nombre for nombre, _ in CAPAS}
    if desconocidas := pedidas - conocidas:
        raise ErrorCarga(
            f"Capa(s) desconocida(s): {', '.join(sorted(desconocidas))}. "
            f"Conocidas: {', '.join(conocidas)}"
        )
    return [(nombre, ruta) for nombre, ruta in CAPAS if nombre in pedidas]


def main():
    parser = argparse.ArgumentParser(
        description="Despliega el DDL de modelo/ en el Warehouse de una propiedad"
    )
    parser.add_argument("propiedad", help="Id de propiedad, tal como figura en propiedades.json")
    parser.add_argument(
        "--solo",
        help="Capas a desplegar, separadas por coma (por defecto, las 7 en orden). "
             f"Opciones: {', '.join(nombre for nombre, _ in CAPAS)}",
    )
    parser.add_argument(
        "--mostrar", action="store_true",
        help="Imprime lo que correria y termina, sin tocar el Warehouse",
    )
    args = parser.parse_args()

    cfg = cargar_config(args.propiedad)
    capas = elegir_capas(args.solo)

    print(f'Propiedad : {args.propiedad} ({cfg["nombre"]})')
    print(f'Destino   : {cfg["warehouse"]} @ {cfg["warehouse_endpoint"]}')
    print(f'Capas     : {", ".join(nombre for nombre, _ in capas)}\n')

    for nombre, ruta in capas:
        archivo = MODELO_DIR / ruta
        if not archivo.exists():
            raise ErrorCarga(f"Falta {archivo}")

        if args.mostrar:
            print(f"  {nombre:20} {archivo}")
            continue

        print(f"  {nombre:20} desplegando {ruta}...")
        sqlcmd(cfg, archivo=archivo)

    if args.mostrar:
        print("\n(solo mostrar -- no se ejecuto nada)")
        return 0

    print(f"\nListo. Modelo desplegado en {cfg['warehouse']}.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ErrorCarga as e:
        print(f"\nABORTADO: {e}", file=sys.stderr)
        sys.exit(1)
