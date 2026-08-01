# Modelo dimensional — Sage 50 → dashboards

Esquema estrella sobre el libro diario de Sage 50. Es la capa **silver**: se
alimenta de los `.json` crudos que deja `extraer_y_guardar.py` (bronze) y la
consumen los dos dashboards.

```
          dim_fecha
              │
dim_cuenta ── fact_movimiento ── dim_cliente
                     │
              dim_proveedor
```

## Capas

Se despliegan en este orden. Cada capa se reconstruye desde la anterior sin
volver a tocar Sage — ese es el principio que las gobierna.

| Orden | Archivo | Regla de la capa | ¿Igual en todos los PH? |
|---|---|---|---|
| 1 | `bronze/01_tablas.sql` | Copia fiel del origen. No se transforma nada. | Sí |
| 2 | `staging/01_vistas.sql` | Tipado y limpieza. Sigue 1:1 con el origen. | Sí |
| 3 | `silver/01_dimensiones.sql` | Las cuatro dimensiones | Sí |
| 4 | `silver/02_hechos.sql` | `fact_movimiento` | Sí |
| 5 | `silver/03_mapeo_cuentas.sql` | Reglas de negocio (seed editable) | **No** — uno por PH |
| 6 | `gold/01_agregados.sql` | Agregados listos para consumo | Sí |
| 7 | `99_control_calidad.sql` | Validación cruzada entre capas | Sí |

**Bronze** existe para poder reconstruir todo lo de arriba sin volver a la PC
de 32 bits a re-extraer de Sage. Es append-only y nunca se corrige: si Sage
mandó basura, la basura queda registrada y se arregla en staging. Es la única
respuesta confiable a "qué decía Sage el 31 de mayo".

**Staging** son vistas, no tablas: a esta escala materializar no aporta y
elimina un paso de carga que podría quedar desincronizado. Incluye
`vw_control_calidad`, que reporta lo que se descartó — la carga debe abortar
si hay filas con severidad `ERROR`.

**Gold** lleva agregados estructurales (flujo mensual, saldo acumulado,
cartera), no métricas de presentación. Ver "Sobre la opción A" más abajo.

Dialecto: **T-SQL para Fabric Warehouse**. El modelo es agnóstico del motor —
si termina en DuckDB o Postgres, cambian tres detalles de sintaxis y nada de
la estructura.

---

## Aislamiento entre propiedades

**Este modelo se despliega una vez por PH, en su propio Warehouse, dentro de su
propio workspace. No existe ninguna columna que identifique a la propiedad.**

```
Workspace "PH Clayton Park"          Workspace "PH Otro"
  ├── Lakehouse  (bronze)              ├── Lakehouse  (bronze)
  └── Warehouse  (silver)              └── Warehouse  (silver)
        dim_cuenta                           dim_cuenta
        fact_movimiento                      fact_movimiento
```

### Por qué separación física y no una columna

Los miembros de la junta directiva de cada PH acceden a sus datos. Con una
columna discriminadora, **un `WHERE propiedad_id = ?` olvidado expone las
finanzas de otro edificio**. Con separación física, ese mismo bug es un error
de conexión.

Uno falla abierto, el otro falla cerrado. La barrera no depende de que nadie se
equivoque nunca al escribir una consulta.

El workspace es la frontera de seguridad real de Fabric: los permisos se
asignan ahí. Poner varios Warehouses en un mismo workspace separa el
almacenamiento pero **no** el control de acceso — alguien con rol *Viewer*
sobre ese workspace los vería todos.

### Modelo de acceso

La junta directiva **no debería tener acceso al Warehouse**. Un miembro de
junta necesita ver el reporte, no consultar el libro diario en SQL.

El patrón robusto son dos workspaces por PH:

| Workspace | Contiene | Quién entra |
|---|---|---|
| `PH X — Datos` | Lakehouse + Warehouse | Solo personal de Mardem |
| `PH X — Reportes` | Semantic model + informe | Junta directiva (*Viewer*) |

El semantic model lee del Warehouse con identidad fija, así el miembro de junta
ve el informe sin tener permiso sobre las tablas de origen. *Verificar la
mecánica exacta de permisos en el tenant antes de dar acceso externo.*

Si la junta consume el dashboard React en vez de Power BI, el principio es el
mismo y el punto de control es el API: autentica al usuario, lo mapea a **una**
propiedad, y abre conexión únicamente contra ese Warehouse. El `propiedad_id`
nunca viaja como parámetro de consulta — es una decisión de routing.

### Corolarios

**No agregar jamás una columna `propiedad_id` "por si acaso".** Reintroduce
exactamente el modo de falla que esta arquitectura elimina.

**La separación es de punta a punta, no solo del Warehouse.** Si los `.json`
crudos de dos PHs conviven en una carpeta, ya fallaste antes de llegar a
Fabric. La extracción tiene que escribir a rutas separadas desde el origen.

**No hay consolidado entre PHs, por decisión de diseño.** Si algún día hiciera
falta, se hace en un workspace aparte leyendo **agregados** vía shortcuts de
OneLake — nunca metiendo un discriminador en estas tablas.

**Costo:** varios workspaces comparten una misma capacidad F. Separar no
multiplica la factura.

---

## Decisiones

**El grano del hecho es una línea de asiento, sin agregar.** Agregar al cargar
es irreversible: con el grano fino, un pedido nuevo es un `WHERE`; con datos
pre-agregados hay que rehacer el pipeline. Cuesta 6,521 filas.

**Las claves son naturales (`INT`), no compuestas.** `gl_acct_number` puede ser
clave primaria porque dentro de este Warehouse ya es único. En un modelo con
todos los PHs juntos habría que componerla con el id de propiedad. Es un
beneficio directo del aislamiento físico.

**`monto` se guarda con el signo contable de Sage, sin corregir.** Así se
preserva la propiedad que hace auditable a un libro diario: todo asiento
balanceado suma cero. La corrección se aplica al consultar, multiplicando por
`dim_cuenta.signo_natural`.

**Las reglas de negocio son datos, no código.** Qué cuentas son banco, cuáles
son fondo de reserva, a qué rubro pertenece cada gasto: todo vive en
`mapeo_cuenta`, revisable por quien administra el PH sin leer SQL.

**Sin fila en `mapeo_cuenta`, una cuenta no la cuenta ninguna métrica.** Se
prefiere que una cuenta nueva quede fuera y se note, a que entre en silencio a
un total por una regla implícita.

**Un `account_type` desconocido tiene que hacer fallar la carga.** No asignar
`'Desconocido'` por defecto: un tipo nuevo significa cuentas que ninguna
métrica está contando, y un dashboard que calla ese hueco es peor que uno que
no carga.

**La carga es full refresh, no incremental.** La extracción ya trae
`PostOrder` (`extractores/movimientos.py` separa `JrnlRow` y `JrnlHdr` y
expone la clave que los vincula), pero identifica el asiento, no la línea:
sin un índice de fila dentro del asiento, una línea de `JrnlRow` sigue sin
tener identificador único y no se puede hacer *upsert*. Full refresh es hoy
una decisión de costo (6,521 filas, segundos), no una obligación del origen.
Ver la nota en `02_hechos.sql`.

## Sobre la opción A

El proyecto va con métricas **definidas por separado** en cada consumidor —
DAX en Power BI, SQL en el API del dashboard React. El riesgo conocido es que
diverjan.

La mitigación está en el diseño de `dim_cuenta`: cuanto más peso semántico
carga la dimensión, menos queda para que las dos capas interpreten por su
cuenta. Los flags (`es_banco`, `es_fondo_reserva`, `es_por_cobrar`), el `rubro`
y `signo_natural` existen para eso. "Saldo en Bancos" se reduce a
`SUM(monto) WHERE es_banco` en ambos lados — dos implementaciones, una sola
definición de qué es un banco.

Regla práctica: **si una regla se puede empujar a `dim_cuenta`, se empuja.**
Cada una que quede en DAX o en SQL es una divergencia futura.

Gold sigue el mismo criterio. Lleva lo caro de calcular y lo fácil de calcular
distinto —sobre todo los saldos acumulados, y la corrección de signo— pero no
las métricas de presentación. "Saldo en Bancos" no es una vista: es
`SUM(saldo_natural) WHERE es_banco` sobre `gold.vw_saldo_mensual`, y esa línea
la escribe cada consumidor en su propio lenguaje.

## Despliegue

Los `.sql` no se "suben" a Fabric: se **ejecutan** contra cada Warehouse. Los
archivos son el código fuente del modelo; Fabric guarda el resultado.

Con `sqlcmd` (ya instalado en la máquina, vino con las herramientas ODBC):

```
sqlcmd -S <endpoint>.datawarehouse.fabric.microsoft.com -d <warehouse> -G ^
       -i bronze/01_tablas.sql,staging/01_vistas.sql,silver/01_dimensiones.sql,silver/02_hechos.sql,silver/03_mapeo_cuentas.sql,gold/01_agregados.sql,99_control_calidad.sql
```

`-G` autentica con Entra ID y abre el browser la primera vez. El endpoint sale
del portal: Warehouse → *Settings* → *SQL connection string*.

**El orden importa.** Las vistas de staging referencian `bronze.*` y
`silver.mapeo_cuenta`; las de gold referencian `silver.*`. Corriendo los
archivos fuera de orden, la creación falla porque el objeto todavía no existe.

**Esto corre una vez por PH.** Con seis propiedades son seis despliegues por
cada cambio de esquema, así que conviene scriptearlo y no hacerlo a mano en el
portal. Todos los archivos son idénticos entre PHs salvo
`silver/03_mapeo_cuentas.sql`, que es propio de cada uno.

## Carga

El DDL de arriba se despliega **una vez**. La carga corre en **cada
extracción**, y la orquesta [`../cargar_a_fabric.py`](../cargar_a_fabric.py):

```
python cargar_a_fabric.py <propiedad>
```

Ese comando hace todo el recorrido: convierte los `.json` a Parquet sellando
la propiedad adentro del archivo, sube a OneLake, corre
`carga/01_bronze.sql` (`COPY INTO`), **verifica que no haya mezcla de
propiedades**, concilia filas contra el origen, corre `carga/02_silver.sql`
(full refresh) y consulta el control de calidad. Aborta en cualquier paso que
falle.

La propiedad es el único argumento. DSN, carpeta, workspace, lakehouse y
warehouse se derivan de `propiedades.json` — no se pasan sueltos, para que no
exista la posibilidad de combinar el origen de un PH con el destino de otro.

`--solo-preparar` genera los Parquet y termina, sin tocar Fabric. Sirve para
revisar la salida antes de subir nada.

## Estado

Lo que hay: las cuatro capas completas en DDL — bronze, staging, silver y
gold — más la carga de punta a punta.

Lo que falta:

1. **La transformación que puebla las tablas.** El DDL define la forma; falta
   el `COPY INTO` a bronze y los `INSERT ... SELECT` de staging a silver.
2. **La extracción no separa por propiedad.** `extraer_y_guardar.py` recibe un
   DSN por PH pero escribe siempre a `data/*.json` — un segundo PH pisa al
   primero. Con el requisito de aislamiento esto pasa de incómodo a
   bloqueante. Ver [`../ARQUITECTURA.md`](../ARQUITECTURA.md).
3. **La extracción no archiva.** Cada corrida sobrescribe la anterior; no hay
   historia de ninguna clase.
4. **No hay `fact_presupuesto`.** No se extrae la tabla de presupuestos de
   Sage, así que las dos tarjetas de presupuesto del dashboard no tienen
   origen. Falta un sexto extractor.
5. **La antigüedad de morosidad no se puede calcular.** El gráfico de tramos
   (0-30 / 31-60 / 61-90 / 90+) necesita saber qué factura quedó impaga y
   desde cuándo, y `JrnlRow` no vincula el cobro con el cargo que salda. Ver la
   nota en `gold/01_agregados.sql`.
6. **El seed de mapeo es de la compañía de demo de Sage** (Bellwether Garden
   Supply, cuentas en inglés, 2017–2022). Prueba el pipeline, no sirve para
   producción.

## Verificación

Dos consultas que tienen que dar exacto antes de confiar en cualquier tarjeta:

```sql
-- 1. Todo asiento balanceado suma cero. Si no da 0, se perdieron filas.
SELECT SUM(monto) FROM silver.fact_movimiento;

-- 2. El saldo calculado tiene que coincidir con el Balance que reporta Sage.
SELECT c.customer_record_number, c.saldo_sage, SUM(f.monto) AS calculado
FROM silver.dim_cliente c
LEFT JOIN silver.fact_movimiento f
       ON f.customer_record_number = c.customer_record_number
GROUP BY c.customer_record_number, c.saldo_sage
HAVING ABS(c.saldo_sage - SUM(f.monto)) > 0.01;
```
