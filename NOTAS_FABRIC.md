# Notas de Fabric — entorno, límites y decisiones

Lo que hubo que descubrir para poner en pie el entorno de **PH Las Hortensias**
en Microsoft Fabric. Está acá y no en `modelo/README.md` porque no describe el
modelo: describe la plataforma y sus restricciones, que son las que obligaron a
cambiar el DDL.

Fecha de la puesta en marcha: **2026-08-02**.

---

## Estado del entorno

| Recurso | Valor |
|---|---|
| Tenant | `marde` (`marde430.onmicrosoft.com`) |
| Suscripción Azure | `Azure subscription 1` — rol Owner |
| Resource group | `rg-mardem` (Central US) |
| Capacidad | `mardemhortensias` — **F2**, Central US |
| Workspace | `Mardem Las Hortensias - Datos` |
| Warehouse | `mardem_hortensias` |
| Lakehouse | `bronze` |

### Cuidado: tres cosas se llaman `bronze`

| Nombre | Tipo | Rol |
|---|---|---|
| `bronze` | Lakehouse | Guarda los `.parquet` crudos en OneLake, bajo `Files/` |
| `bronze` | SQL analytics endpoint | Lo crea Fabric solo junto al Lakehouse. Solo lectura, no se toca |
| `bronze` | Schema del Warehouse | Las tablas SQL donde el `COPY INTO` mete esos Parquet |

El Lakehouse y el schema son cosas distintas que comparten nombre porque las
dos representan la capa bronze. El flujo es:

```
data/*.json  →  .carga/<lote>/*.parquet  →  Lakehouse bronze/Files/  →  COPY INTO  →  mardem_hortensias.bronze.*
```

Endpoint SQL del Warehouse: está en `propiedades.json`, entrada `hortensias`.

### Qué está desplegado

Solo la capa **bronze** (`modelo/bronze/01_tablas.sql`): 6 tablas vacías —
`chart` (190 col), `customers` (158), `vendors` (144), `jrnlrow` (52),
`jrnlhdr` (173) y `lote` (7). Las cinco primeras son las columnas de Sage más
las 5 de metadata.

Las otras 6 capas (staging, silver ×3, gold, control de calidad) **no** se
desplegaron.

---

## La trial de Fabric no está disponible para esta cuenta

Antes de comprar la F2 se intentó la prueba gratuita de 60 días. Falla con:

> A Fabric trial isn't available for your account.

**No es un problema de configuración.** Se verificaron los dos tenant settings
que exige la documentación y ambos estaban habilitados:

- *Users can create Fabric items* — Enabled
- *Users can try Microsoft Fabric paid features* — Enabled

La causa es elegibilidad de la cuenta: figura como **Free account** en un tenant
`.onmicrosoft.com`. Tiene trial de Power BI (distinta cosa), no de Fabric.

Conclusión: en este tenant **la única vía es capacidad paga**. No perder tiempo
reintentando la trial.

### La región por defecto de la trial miente

El diálogo de la trial ofrecía `Default - East US`, pero la home region del
tenant es **Central US**. La propia doc de Microsoft advierte que las trials a
veces se crean en una región parecida pero distinta, y usa justamente ese par
como ejemplo.

**La capacidad va en Central US**, que es donde vive OneLake para este
workspace. En otra región se pagan transferencias entre regiones, se suma
latencia y se activa multi-geo (con implicaciones de cumplimiento).

---

## Costos

Precios reales de la API de Azure Retail Prices, Central US:

- Capacidad: **USD 0.18 por CU-hora**. F2 = 2 CU → **0.36 USD/hora**
- OneLake: **USD 0.026 por GB/mes**

| Escenario | Costo mensual |
|---|---|
| Prendida 24/7 | $262.80 |
| 2 h por día | $21.60 |
| Solo cargas y pruebas (~10 h) | $3.60 |
| Pausada | $0 |

El almacenamiento es despreciable: 8.2 MB de Parquet ≈ 0.05 GB, menos de un
centavo al mes. **El costo es 100% la capacidad prendida.**

> **PAUSAR AL TERMINAR.** Azure → `mardemhortensias` → *Pause*. Facturación al
> segundo desde que queda activa.

Con la capacidad pausada el Warehouse **no responde** — no va lento, no está.
Cualquier `sqlcmd` o carga falla. Prenderla antes de trabajar.

Esto va a importar cuando la junta directiva consuma el dashboard: si el
semantic model es **Import**, los datos quedan en caché y se ven con la
capacidad pausada (solo hace falta prenderla para refrescar). Si es **Direct
Lake**, o si el dashboard React consulta el Warehouse en vivo, no.

La reserva a 1 año ($938/CU/año ≈ $156/mes para F2) **no conviene**: no se puede
pausar, y el patrón de uso acá es por ráfagas.

---

## Autenticación con sqlcmd

### El problema

La máquina traía `sqlcmd` **v17.0.1000.7** (aunque instalado bajo la carpeta
`ODBC\180\`). Esa versión solo sabe autenticar de dos formas contra Entra:

- `-G` solo → *ActiveDirectoryIntegrated*, asume máquina unida a un dominio.
  Falla con `Failed to authenticate the user '' ... Default account not found`.
- `-G -U -P` → *ActiveDirectoryPassword*. Con `-P` vacío falla con
  `The passed in credential is invalid`.

Ninguna sirve para una cuenta Entra con MFA. **v17 no soporta
ActiveDirectoryInteractive**, que es la que abre el navegador.

### La solución

```
winget install Microsoft.Sqlcmd
```

Instala **go-sqlcmd** en `C:\Program Files\sqlcmd\sqlcmd.exe`. Sí soporta
`--authentication-method=ActiveDirectoryInteractive`.

`cargar_a_fabric.py:_comando_base()` lo resuelve **por ruta completa, no por
PATH**: conviven dos binarios llamados `sqlcmd` y cuál gana depende del orden
del PATH. Si go-sqlcmd no está, cae al comportamiento anterior.

### El usuario va en una variable de entorno

```powershell
$env:FABRIC_USER = "oartavia@marde430.onmicrosoft.com"
```

**No va en `propiedades.json` a propósito.** Ese archivo es tabla de ruteo de
propiedades y se commitea; el UPN es de quien opera, no de la propiedad — el
mismo Warehouse lo puede desplegar otra persona desde otra máquina.

---

## Límites del Warehouse de Fabric que rompieron el DDL

Los dos se corrigieron en `modelo/generar_bronze.py`, no en el `.sql` —
ese archivo es generado y editarlo a mano se pierde en la próxima corrida.

### 1. `TINYINT` no existe

```
Msg 24574: The data type 'tinyint' in column 'AccountIsInactive'
is not supported in this edition of SQL Server.
```

El generador mapeaba el tipo ODBC `UTINYINT` → `TINYINT` en 41 columnas.

**Ahora mapea a `SMALLINT`**: es el entero más chico que Fabric soporta y cubre
el rango 0-255 sin perder nada.

No se usó `BIT` aunque muchas de esas columnas parezcan booleanas
(`IsProspect`, `CustomerIsInactive`, `Use_Std_Terms`...): `BIT` solo guarda 0/1
y bronze es copia fiel. Si Sage mete un 2 en alguna, tiene que verse.

Tipos que sí funcionan, verificados contra el Warehouse ya desplegado:
`varchar`, `int`, `smallint`, `decimal`, `datetime2`.

### 2. `PRIMARY KEY` no se acepta dentro de `CREATE TABLE`

```
Msg 24584: The PRIMARY KEY keyword is not supported in the
CREATE TABLE statement in this edition of SQL Server.
```

Pasa **aunque la sintaxis sea la correcta** (`PRIMARY KEY NONCLUSTERED (...)
NOT ENFORCED`). Hay que declararla en un statement aparte:

```sql
CREATE TABLE bronze.lote ( ... );
GO

ALTER TABLE bronze.lote
    ADD CONSTRAINT pk_bronze_lote PRIMARY KEY NONCLUSTERED (lote_id, tabla) NOT ENFORCED;
GO
```

`NOT ENFORCED` sigue siendo obligatorio: Fabric no valida unicidad. La PK es
metadata para el optimizador y las herramientas de modelado, **no** una
verificación real.

> ⚠️ **Esto todavía no está arreglado en las otras capas.**
> `modelo/silver/03_mapeo_cuentas.sql:41` tiene `CONSTRAINT pk_mapeo_cuenta
> PRIMARY KEY ... NOT ENFORCED` inline y va a fallar igual. Revisar también
> `silver/01_dimensiones.sql`, `silver/02_hechos.sql` y `gold/01_agregados.sql`
> antes de desplegarlas.

### Un despliegue fallido deja estado a medias

`sqlcmd -b` aborta en el primer error, pero **lo que ya corrió queda**. En el
primer intento el `CREATE SCHEMA bronze` había pasado antes de que fallara la
primera tabla, y el reintento moría con "schema already exists".

Antes de reintentar un despliegue fallido, limpiar:

```sql
DROP TABLE IF EXISTS bronze.chart;   -- ... una por tabla
DROP SCHEMA IF EXISTS bronze;
```

---

## Cómo desplegar

`desplegar_modelo.py` reemplaza la línea de `sqlcmd` a mano que documenta
`modelo/README.md`:

```
python desplegar_modelo.py hortensias                # las 7 capas, en orden
python desplegar_modelo.py hortensias --solo bronze  # solo una
python desplegar_modelo.py hortensias --mostrar      # imprime, no ejecuta
```

La propiedad es el único argumento; endpoint y warehouse salen de
`propiedades.json`. **No hay flag `--endpoint`**: si el destino se pudiera pasar
suelto, se podría desplegar el modelo de un PH sobre el Warehouse de otro.

`--solo` reordena según `CAPAS`: pedir `gold,bronze` despliega bronze primero,
porque staging referencia `bronze.*` y gold referencia `silver.*`.

Corre **una vez por propiedad**, no en cada extracción. La carga de datos es
`cargar_a_fabric.py` y esa sí corre siempre.

---

## Pendientes

1. **Arreglar la PK inline en silver y gold** (ver arriba) y desplegar las 6
   capas restantes.
2. **Correr la carga.** Los Parquet ya están listos y verificados en
   `.carga/hortensias-20260803T051330Z/` — sellados como `hortensias` /
   `DSN_PH_LAS_HORTENSIAS`, con los conteos de columna coincidiendo exactos con
   las tablas desplegadas. Falta `python cargar_a_fabric.py hortensias`, que
   sube a OneLake y hace el `COPY INTO`.

   En `.carga/` quedaron además dos corridas viejas selladas como `demo`
   (`demo-20260728T222238Z` y `demo-20260802T234531Z`). No sirven y conviene
   borrarlas para no confundirlas con la buena.
3. **El seed de mapeo de cuentas es de la demo.**
   `modelo/silver/03_mapeo_cuentas.sql` trae el plan de cuentas de Bellwether
   Garden Supply — cuentas en inglés de un vivero. El propio archivo lo marca
   como *"NO ES DATO DE PRODUCCIÓN"*.

   Es el **único archivo del modelo que cambia por PH**: define qué cuenta es
   banco, cuál fondo de reserva y cuál cartera. Con el seed de demo, Hortensias
   va a cargar pero las tarjetas del dashboard van a dar cero o basura. Lo tiene
   que armar el administrador del PH contra su plan de cuentas real.

   **Este es el bloqueante de negocio, no técnico.** Los otros tres se resuelven
   escribiendo código; este no.
5. **La extracción no separa por propiedad.** `extraer_y_guardar.py` escribe a
   `data/*.json` suelto en vez de `data/<propiedad>/<corrida>/`, así que la
   propiedad la declara el operador en vez de derivarse del DSN.
   `cargar_a_fabric.py` avisa de esto en cada corrida.
6. **La entrada `demo` de `propiedades.json` tiene el endpoint en
   `REEMPLAZAR...`** — inservible hasta que se le ponga uno real o se elimine.
