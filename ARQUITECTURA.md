# Arquitectura — Mardem Analytics

Documento de referencia del proyecto. Cubre el recorrido completo del dato,
desde Sage 50 hasta los dashboards, y las decisiones de aislamiento entre
propiedades.

Para el detalle del modelo dimensional ver [`modelo/README.md`](modelo/README.md).
Para la app web, [`web/README.md`](web/README.md).

---

## Recorrido del dato

```
Sage 50 (Pervasive)          una compañía por PH, DSN propio
   │  extractores/*.py       PC de 32 bits (lo exige el driver ODBC)
   ▼
data/<propiedad>/<corrida>/  JSON crudo
   │  convertir_parquet.py   otra PC, 64 bits
   ▼
OneLake — Lakehouse          bronze: copia fiel
   │
   ▼
Warehouse                    staging → silver (estrella) → gold
   │
   ├──────────────► Semantic model → Power BI  (junta directiva)
   └──────────────► API → dashboard React      (personal de Mardem)
```

Un despliegue completo de esta cadena **por cada propiedad**.

---

## Aislamiento entre propiedades

**Requisito:** la data de un PH no debe estar disponible para otro. Los
miembros de junta directiva de cada PH acceden a sus propios datos, así que
la separación no es una preferencia organizativa: es control de acceso entre
partes distintas.

### Separación física, no columna discriminadora

El modelo **no tiene ninguna columna que identifique a la propiedad**. La
identidad del PH es el workspace donde vive la tabla.

El motivo es el modo de falla. Con una columna discriminadora, un
`WHERE propiedad_id = ?` olvidado expone las finanzas de otro edificio. Con
separación física, ese mismo bug es un error de conexión. Uno falla abierto,
el otro falla cerrado — y la barrera deja de depender de que nadie se
equivoque nunca al escribir una consulta.

> **No agregar jamás una columna `propiedad_id` "por si acaso".** Reintroduce
> exactamente el modo de falla que esta arquitectura elimina.

### Workspace por propiedad

El workspace es la frontera de seguridad real de Fabric: los permisos se
asignan ahí. Varios Warehouses dentro de un mismo workspace separan el
almacenamiento pero **no** el control de acceso — alguien con rol *Viewer*
sobre ese workspace los vería todos.

| Workspace | Contiene | Quién entra |
|---|---|---|
| `PH X — Datos` | Lakehouse (bronze) + Warehouse | Solo personal de Mardem |
| `PH X — Reportes` | Semantic model + informe | Junta directiva (*Viewer*) |

La junta no debería tener acceso al Warehouse: un director necesita ver el
informe, no consultar el libro diario en SQL. El semantic model lee del
Warehouse con identidad fija.

> **Pendiente de verificar:** la mecánica exacta de permisos entre workspaces
> en el tenant, con un caso de prueba, antes de dar acceso a alguien externo.

Varios workspaces comparten una misma capacidad F: separar no multiplica la
factura.

### Dónde está garantizado y dónde no

| Tramo | Qué lo separa | Quién lo garantiza | Estado |
|---|---|---|---|
| Sage 50 | Compañías distintas, DSN propio | Pervasive: archivos separados | ✅ real |
| **Extracción** | — | **Nada** | ❌ **roto** |
| **Archivos en disco** | Carpetas | El script | ❌ **no existe** |
| Subida a OneLake | Ruta del workspace | Fabric | ⚠️ depende del apuntado |
| Lakehouse (bronze) | Workspace | Fabric: permisos | ✅ real |
| Warehouse (silver) | Workspace + item | Fabric: no hay SQL que cruce | ✅ real |
| Consumo | Código | Nosotros | ⚠️ por construir |

En Fabric **no existe ninguna consulta que, parada en el Warehouse de un PH,
pueda leer el de otro**. No es un filtro que se pueda olvidar: es la ausencia
de un camino. Cruzarlos requeriría credenciales de ambos y un shortcut creado
a propósito.

Esa garantía cubre el medio de la cadena. Las puntas son ingeniería nuestra,
y hoy la de entrada no existe: `extraer_y_guardar.py` escribe siempre a
`data/*.json` (`chart.json`, `customers.json`, `vendors.json`, `jrnlrow.json`,
`jrnlhdr.json`), así que un segundo PH pisa al primero.

### El principio: una entrada de la que se deriva todo

La propiedad es un **único parámetro** del que se derivan origen, destino y
credencial — nunca tres cosas configuradas por separado que puedan no
coincidir.

```
propiedad = "clayton-park"
      ├── DSN de Sage        ← derivado
      ├── carpeta de salida  ← derivado
      ├── workspace destino  ← derivado
      └── credencial         ← derivada
```

Si el operador solo puede elegir *qué PH*, no puede armar una combinación
mezclada. El error clásico —correr la carga apuntando al Warehouse
equivocado— deja de ser posible porque no hay dónde escribirlo mal.

### Guardarraíles

**La extracción exige la propiedad y deriva la ruta.**
`data/<propiedad>/<timestamp>/<tabla>.json`. Que la corrida quede fechada
resuelve además que hoy cada extracción borre la anterior.

**El proceso se niega a escribir sobre datos de otra propiedad.** Si la
carpeta destino ya tiene contenido de otro PH, aborta.

**Sello de origen en bronze, para verificar — no para consultar.** Cada
archivo declara `_propiedad_origen` y `_dsn_origen`. Antes de cargar al
Warehouse de un PH, el proceso valida que *todas* las filas del lote declaren
esa propiedad, y aborta si alguna no coincide. Después el campo se descarta y
no llega a silver.

Es una aserción, no una dimensión: existe para detectar una mezcla antes de
que ocurra, no para filtrar. Una ruta de archivo se puede equivocar; un sello
adentro del dato viaja con él.

**Credencial por propiedad, con permiso sobre un solo Warehouse.** Si la carga
apunta mal, la credencial no tiene permiso sobre el destino y la operación
falla en vez de escribir donde no va. Y ante una inyección SQL o un query mal
armado, el radio de explosión queda contenido en un PH.

Los secretos van en Key Vault, referenciados desde el control plane. Nunca en
el código, nunca en una respuesta.

### Verificación

Diseñarlo no alcanza; hay que poder demostrarlo.

- **Prueba negativa deliberada** — intentar cargar el PH A apuntando al
  Warehouse del PH B y confirmar que aborta. Como test automatizado, no como
  prueba manual de una vez: es la única forma de saber que el guardarraíl
  sigue vivo después de un refactor.
- **Conciliación post-carga** — contar filas y sumar montos del archivo origen
  contra lo que quedó en el Warehouse.
- **Huella por propiedad** — un hash de `dim_cuenta` identifica al PH sin
  guardar su nombre en ninguna parte. Si la huella de un Warehouse cambia,
  alguien cargó lo que no era.

---

## Ruteo

La lógica que resuelve *a qué Warehouse apuntar* vive en dos lugares.

### Al cargar (Python)

Recibe `propiedad` y deriva DSN de origen, carpeta, Warehouse destino y
credencial.

### Al leer (API)

Recibe la identidad del usuario, resuelve a qué PH tiene derecho, y de ahí
saca el Warehouse y la credencial.

> **`propiedadId` nunca se acepta del cliente como fuente de verdad.** Si el
> browser lo manda y el API le cree, alguien lo cambia en devtools y toda la
> separación física deja de servir. Para un miembro de junta el request no
> lleva propiedad: tiene una sola y el servidor la deduce. Para personal de
> Mardem con varias, el request la indica pero el servidor la **valida** contra
> sus entitlements. Validar, nunca confiar.

### Control plane

Los Warehouses por PH son *data planes*: cada uno sabe de su propio PH y nada
más. Falta una base chica, propiedad del API, que sepa quién puede llegar a
dónde:

```
propiedad    (id, nombre, warehouse_endpoint, secret_ref, activa)
entitlement  (usuario_id, propiedad_id, rol)
```

Es el único lugar donde coexiste información de todos los PHs, y por eso el
que más hay que cuidar. No contiene ni un dato financiero: solo ruteo y
permisos.

**Fallar cerrado:** si la resolución de entitlements no devuelve nada → 403,
nunca "usar la primera propiedad". El patrón ya existe en el mock
(`use-filtros-dashboard.ts:16` arranca con `PROPIEDADES[0]`); ahí es
inofensivo, en el servidor convertiría un fallo de autorización en acceso a la
propiedad equivocada.

### Vectores de fuga en el consumo

Con la base separada, estos son los puntos donde la data se vuelve a mezclar:

- **Caché del API** — la clave siempre incluye la propiedad.
- **Caché HTTP** — respuestas `Cache-Control: private, no-store`.
- **Pooling de conexiones** — con credencial por propiedad se separa solo.
- **Logs** — registrar `propiedad_id` y usuario, nunca las filas.
- **Errores** — que un error de SQL no llegue crudo al cliente.
- **Exportar** — el archivo se genera en el servidor, bajo la misma
  verificación de entitlement.
- **Residuo en el browser** — `queryClient.clear()` al cerrar sesión; nada de
  datos financieros en `localStorage`.
- **Auditoría** — log de accesos (usuario, propiedad, endpoint, timestamp).

---

## Decisiones tomadas

**Métricas definidas por separado en cada consumidor** (DAX en Power BI, SQL
en el API). El riesgo de divergencia se mitiga cargando el máximo peso
semántico en `dim_cuenta`: si una regla se puede empujar a la dimensión, se
empuja.

**Sin consolidado entre PHs.** Por diseño. Si algún día hiciera falta, se hace
en un workspace aparte leyendo agregados vía shortcuts de OneLake — nunca
metiendo un discriminador en las tablas.

**Carga full refresh, no incremental.** La extracción ya trae `PostOrder`
(`extractores/movimientos.py` separa `JrnlRow` y `JrnlHdr` y expone la clave
que los vincula), pero `PostOrder` identifica el asiento, no la línea — sin un
índice de fila dentro del asiento, una línea de `JrnlRow` sigue sin tener
identificador único. Full refresh sigue siendo la decisión actual porque con
6,521 filas el costo es irrelevante, no porque el origen lo obligue. Ver la
nota en `modelo/silver/02_hechos.sql`.

---

## Pendientes

1. **Extracción sin separación por propiedad** — bloqueante para multi-PH.
2. **Extracción sin archivado** — cada corrida sobrescribe la anterior.
3. **Sin autenticación en la app** — el usuario del topbar es texto fijo.
4. **Sin control plane** — no existe la base de entitlements.
5. **Sin `fact_presupuesto`** — no se extrae la tabla de presupuestos de Sage;
   las tarjetas de presupuesto del dashboard no tienen origen.
6. **Datos de demo** — la extracción actual es de Bellwether Garden Supply
   (compañía de ejemplo de Sage), cuentas en inglés, 2017–2022.
