# Plan de investigación — errores de la extracción

Guía para la PC donde corre la extracción (32 bits, con el ODBC de Sage). Cada
caso trae la consulta a correr, qué mirar y qué decide. Anotá los hallazgos en
la tabla del final.

Contexto del modelo en [`ARQUITECTURA.md`](ARQUITECTURA.md); los controles que
disparan están en [`modelo/99_control_calidad.sql`](modelo/99_control_calidad.sql).

---

## Situación

La extracción del 2026-08-01 (Bellwether, `DSN_SageOficinaPrueba`) está completa
y alineada con la arquitectura: 5 tablas, `JrnlRow` y `JrnlHdr` separadas, bronze
fiel al origen. `cargar_a_fabric.py demo --solo-preparar` corre sin errores.

Pero **tres controles `ERROR` de `vw_control_calidad` disparan**, y
`verificar_calidad()` aborta la carga ante cualquiera de ellos:

| Control | Filas | Monto |
|---|---:|---:|
| `jrnlrow sin encabezado` | 2 | 0.00 |
| `cuenta huerfana` (`gl_acct_number = 0`) | 532 | 1,503.18 |
| `libro no balancea` (journal 8) | 49 | 2,355.90 |

Ninguno es un bug del extractor: bronze copia fiel a propósito. Lo que falta es
decidir qué hace `staging.stg_movimientos` con cada caso — y para eso hay que
mirar el origen.

> **Nota:** `cuenta huerfana` son en realidad **dos problemas distintos** bajo un
> mismo control (casos 2a y 2b). Se descubrió al ver que los montos se repetían.

### Dos cosas que conviene saber antes de buscar

**`post_order` no identifica una línea, solo el asiento.** 596 asientos para
6,523 líneas. Dentro de un asiento puede haber líneas idénticas en todas las
columnas — el asiento 159 tiene tres iguales. Ya está anotado en
`ARQUITECTURA.md`, y es lo que sostiene la decisión de full refresh.

**`fecha + referencia` no siempre identifica un asiento.** 11 pares apuntan a
más de uno (160 asientos, 27%) y 30 encabezados no tienen referencia. El caso
extremo es `BegBal` del 2017-01-01: 123 asientos con el mismo par. Para los
asientos de este plan sí alcanza, salvo donde se indique.

**No está verificado si `post_order` se ve en la interfaz de Sage.** Es la clave
interna que vincula `JrnlHdr` con `JrnlRow` ("post" = asentar en el mayor). Si
al abrir un asiento encontrás el número en pantalla, anotalo: simplifica todo lo
que sigue.

---

## Caso 3 — Journal 8, descuadre de 2,355.90

**Empezar por acá.** Es el único hallazgo sin explicación, y el único que puede
obligar a cambiar el extractor.

```sql
SELECT * FROM "JrnlRow" WHERE "Journal" = 8
```

Son 49 líneas en 9 asientos:

| post_order | fecha | referencia | descuadre |
|---:|---|---|---:|
| 159 | 2018-03-03 | 101 | 93.00 |
| 160 | 2018-03-05 | 101 | 335.40 |
| 161 | 2018-03-05 | 103 | 50.80 |
| 340 | 2022-03-03 | 101 | 93.00 |
| 341 | 2022-03-05 | 101 | 335.40 |
| 342 | 2022-03-05 | 103 | 50.80 |
| 776 | 2022-03-07 | 102 | 279.50 |
| 777 | 2022-03-10 | 103 | 559.00 |
| 778 | 2022-03-10 | 104 | 559.00 |

Los 9 pares fecha+referencia son únicos, así que se ubican sin ambigüedad. En
Sage: `Tasks > Inventory Adjustments`, o `Reports & Forms > Inventory`.

**Qué mirar:** en los 9 asientos la línea de `12000-00 Inventory` se lleva todo
el monto y la contrapartida (`50000-AV` / `50000-HT`, Product Cost) viene en
0.00. Por las cuentas que toca, journal 8 son ajustes de inventario.

**Hipótesis a verificar:** que Sage guarde el costo de estos ajustes en otra
columna de `JrnlRow` que no estamos trayendo. Hoy el extractor solo lee
`Amount` (ver `extractores/movimientos.py:31`). Por eso la consulta es
`SELECT *` y no la lista de columnas: hay que ver **todas**.

**Qué decide:**
- Si aparece una columna con el costo → agregarla al extractor, a
  `bronze.jrnlrow`, a `COLUMNAS` en `cargar_a_fabric.py` y a `stg_jrnlrow`.
- Si el descuadre existe igual en Sage → es dato del origen; documentarlo y
  bajar el control a `AVISO` con el motivo escrito.

> **No taparlo con un filtro en staging sin resolver esto antes.** Serían
> 2,355.90 desapareciendo sin explicación.

### Hallazgo (2026-08-01) — el monto SÍ existe en Sage, en otra tabla

`JrnlRow` tiene muchas más columnas de las que extraemos hoy (`RowNumber`,
`StockingUnitCost`, `UnitCost`, `CostRecordNumber`, etc.) pero todas las de
costo dan 0.00 en las 49 filas de journal 8 — no es ahí donde está el dato.

Hay una tabla aparte, `InventoryCosts`, vinculada por
`PostOrderNumber = JrnlRow.PostOrder`, que sí lo tiene:

```sql
SELECT * FROM "InventoryCosts"
WHERE "PostOrderNumber" IN (159,160,161,340,341,342,776,777,778)
ORDER BY "PostOrderNumber", "RowNumber"
```

Para cada uno de los 9 asientos aparecen tres tipos de fila (`RecordType`):

| RecordType | Qué es | Ejemplo (post_order 159) |
|---:|---|---|
| 10 | La venta — coincide exacto con la línea de Inventory en `JrnlRow` | 93.00 |
| 40 | Consumo de capas de costo (FIFO), negativo | -40.50, -31.20, -21.30 (suman -93.00) |
| 50 | Corrección posterior, `JournalType = 15` (no 8), `CostAcctRecNumber` = 83/89 | 93.00 |

El `RecordType = 50` apunta exactamente a la cuenta de costo correcta (83 o 89,
según el ítem — confirmado contra `Chart`) y trae el monto que le falta a la
línea de Product Cost en `JrnlRow` (que se queda en 0.00). No es un dato
perdido: Sage lo calculó y lo guardó, pero nunca lo escribió de vuelta en
`JrnlRow.Amount` para journal 8.

**Lo que todavía no se sabe:** si esos `RecordType=50` / `JournalType=15` son
postings reales al mayor (y por lo tanto deberían sumarse a
`fact_movimiento`) o son un ajuste interno de valuación de inventario que
Sage nunca postea al GL por diseño — el `JournalType` (15) es distinto del
`Journal` que ve `JrnlRow` (8), así que podrían ser dos conceptos distintos
en el modelo interno de Sage. Confirmarlo abriendo el asiento en la interfaz
(`Tasks > Inventory Adjustments`) y viendo si el Diario General de Sage
muestra un tercer renglón con el costo, o si ya sale descuadrado ahí mismo.

**Decisión pendiente entre dos caminos:**
- **(a) Agregar un extractor para `InventoryCosts`** y sumar `RecordType=50`
  a `stg_movimientos` como una línea más — resuelve el descuadre con datos
  reales de Sage, pero agrega una sexta tabla al pipeline y exige entender
  bien la semántica de `RecordType`/`JournalType` antes de mezclarla con el
  libro diario (no vaya a ser que se cuente el costo dos veces si en algún
  otro caso sí llega a `JrnlRow`).
- **(b) Documentar como limitación conocida de `JrnlRow`** y bajar el
  control a `AVISO` — más simple, pero deja $2,355.90 de costo de ventas sin
  reflejar en ningún reporte mientras tanto, sabiendo que el dato existe.

---

## Caso 2a — `gl_acct_number = 0` en journal 5 (528 filas, 757.68)

```sql
SELECT * FROM "JrnlRow" WHERE "GLAcntNumber" = 0 AND "Journal" = 5
```

`Chart` tiene cuentas del 1 al 162; el 0 no existe. Estas líneas pasan el filtro
de `stg_movimientos` (que solo descarta `IS NULL`) y después no encuentran su
dimensión.

**Lo llamativo son los montos:** solo hay tres valores.

| Monto | Filas | Total |
|---|---:|---:|
| 0.00 | 264 | 0.00 |
| 3.08 | 228 | 702.24 |
| 1.54 | 36 | 55.44 |

Montos fijos, repetidos, y `3.08 = 2 × 1.54`. Casi todas las filas tienen
cliente o proveedor asignado. Tiene forma de cargo por línea de factura
(impuesto o flete), no de movimiento contable normal.

**Qué mirar:** abrir en Sage una factura con línea de 3.08 (hay 228 para
elegir) y ver cómo aparece ese monto: ¿impuesto? ¿flete? ¿cargo de línea?
Después, lo importante: **¿Sage lo postea al mayor por otra vía?**

**Qué decide:**
- Si ya está posteado en otra línea → descartarlo en `stg_movimientos`;
  incluirlo sería contarlo dos veces.
- Si no está posteado en ningún lado → mapearlo a una cuenta real, o el
  dashboard va a mostrar de menos.

---

## Caso 2b — `gl_acct_number = 0` en journal 2, `BegBal` (4 filas, 745.50)

```sql
SELECT * FROM "JrnlRow" WHERE "GLAcntNumber" = 0 AND "Journal" = 2
```

Son otra cosa, aunque caigan bajo el mismo control:

| post_order | fecha | referencia | monto |
|---:|---|---|---:|
| 711 | 2018-02-28 | BegBal | 75.00 |
| 713 | 2018-02-28 | BegBal | 175.50 |
| 714 | 2018-03-01 | BegBal | 150.00 |
| 714 | 2018-03-01 | BegBal | 345.00 |

`BegBal` = saldos iniciales. En estos asientos la línea con `gl = 0` es **la
única línea del asiento** — no hay contrapartida que mirar.

Ojo: `fecha + referencia` **no** desambigua acá (711 y 713 comparten
2018-02-28 + `BegBal`). Filtrar por `PostOrder` directamente.

**Qué mirar:** si esos saldos iniciales existen en Sage contra una cuenta real,
o si quedaron sin asignar.

**Qué decide:** la sospecha es una carga inicial incompleta de la compañía demo.
Si se confirma, es un problema del dato de demo y no del pipeline — pero hay que
dejarlo escrito, porque en un PH real el mismo patrón sería un saldo perdido.

---

## Caso 1 — `post_order = -2` (2 filas, 0.00)

```sql
SELECT * FROM "JrnlRow" WHERE "Journal" = 9
```

Prioridad baja: monto 0.00, no mueve ningún número.

Las dos filas son las únicas con `post_order` negativo, no tienen encabezado en
`JrnlHdr`, y son las **únicas dos de journal 9** en toda la tabla (los demás
journals tienen entre 18 y 3,270 filas). Ambas sin descripción, sin cliente ni
proveedor, `DateCleared` 2022-03-14.

**Qué mirar:** si journal 9 no tiene nada más, es un registro de control interno
y no un asiento.

**Qué decide:** confirmarlo y excluirlo explícitamente en `stg_movimientos`,
para que deje de contarse como `ERROR`.

---

## Dónde anotar

| Caso | Hallazgo | Decisión | Quién / cuándo |
|---|---|---|---|
| 3 — journal 8 | El monto vive en `InventoryCosts` (`RecordType=50`, `JournalType=15`), no en `JrnlRow`. Falta confirmar si es posting real al GL. | Pendiente: (a) extractor nuevo, o (b) `AVISO` documentado | Claude, 2026-08-01 |
| 2a — gl 0 journal 5 | Las 268 filas con monto ≠ 0 y `gl_acct_number=0` tienen **todas** `IncludeInGL=0`. No es un problema de mapeo de cuenta, es que Sage mismo las marca como no-contables. | **Resuelto**: filtrar `stg_movimientos` con `WHERE IncludeInGL=1` las excluye correctamente, sin reglas inventadas | Claude, 2026-08-01/02 |
| 2b — gl 0 BegBal | Mismo mecanismo que 2a — las 4 filas de `BegBal` con `gl=0` también tienen `IncludeInGL=0` | **Resuelto** — mismo filtro que 2a lo cubre | Claude, 2026-08-01/02 |
| 1 — post_order -2 | Las 2 filas de journal 9 no tienen encabezado en `JrnlHdr` — el `INNER JOIN` de `stg_movimientos` ya las descarta solo | **Resuelto** — no requiere regla adicional, el join existente basta; `vw_control_calidad` ya las reporta como `jrnlrow sin encabezado` | Claude, 2026-08-01/02 |
| ¿`post_order` visible en la UI? | No investigado — pendiente de confirmar en la interfaz de Sage | Pendiente | — |

**Conclusión de la fila de arriba:** con el único cambio `WHERE IncludeInGL=1` en `stg_movimientos` (además del join ya existente), quedan resueltos los Casos 1, 2a y 2b. El Caso 3 (`InventoryCosts`) sigue abierto — es el único que no se explica por este flag.

Con los cuatro resueltos, los cambios caen en `modelo/staging/01_vistas.sql` y
`modelo/99_control_calidad.sql` — salvo que el caso 3 obligue a tocar el
extractor.

---

## Validación contra datos reales (2026-08-02) — PH Las Hortensias

Todo lo de arriba se investigó contra la compañía demo (Bellwether). Para
saber si generaliza, se creó un DSN nuevo apuntando a una compañía real y se
corrieron los mismos chequeos.

**DSN:** `DSN_PH_LAS_HORTENSIAS`, driver Pervasive ODBC Client Interface,
apuntando a `C:\Sage\Peachtree\Company\phlashor` (creado con el ODBC Data
Source Administrator de 32 bits — `C:\Windows\SysWOW64\odbcad32.exe`, pestaña
*DSN de sistema*). El código corto `phlashor` es el que usa Sage internamente
para "PH Las Hortensias"; el servidor tiene decenas de compañías PH más en la
misma carpeta `Company\`, cada una con su propio código corto de 8
caracteres.

**Escala:** ~10x la demo — 195 cuentas, 454 clientes, 203 proveedores, 68,459
filas de `JrnlRow`, 29,461 de `JrnlHdr` (vs. 156/35/29/6,523/596 de
Bellwether).

### Resultado — más limpia que la demo

| Chequeo | Bellwether (demo) | Las Hortensias (real) |
|---|---|---|
| `jrnlrow` sin `post_order` | 0 | 0 |
| `jrnlrow` sin cuenta | 268 (antes del fix de extracción) | 0 |
| `jrnlhdr` con fecha inválida | 0 | 0 |
| `jrnlrow` sin encabezado (Caso 1) | 2 | 0 |
| Libro balancea (`IncludeInGL=1`) | Descuadraba $2,355.90 (Caso 3) | Cierra exacto en $0.00 |
| Desbalance por journal | Journal 8 (Caso 3) | Ninguno — todos cierran en $0 |
| Cuenta huérfana (`IncludeInGL=1`) | Varios (Casos 2a/2b) | 1 fila, monto $0 — sin impacto |

**Único hallazgo:** 556 filas con `IncludeInGL=0` sumando -$19,046.82 — mismo
patrón que la demo (probablemente órdenes/cotizaciones sin facturar),
correctamente excluidas por el filtro.

### Por qué importa

Es la primera vez que la regla `WHERE IncludeInGL=1` se prueba contra datos
reales, con un volumen 10 veces mayor — y se sostiene sin ajustes. El
descuadre de journal 8 (Caso 3) **no apareció acá**: no es una característica
estructural de `JrnlRow` en general, fue específico del dato de demo de
Bellwether (que ya sabíamos que es una compañía de jardinería con datos de
prueba de 2017-2022, no un PH real). Eso no cierra el Caso 3 — sigue siendo
un problema real cuando aparece — pero sí dice que **no hay que asumir que va
a aparecer en todos los PH**.

---

## Pendiente — `ReceiptTags` (no investigado todavía)

Candidata fuerte para resolver la limitación de morosidad documentada en
`modelo/gold/01_agregados.sql` (no se puede calcular antigüedad de saldos
porque `JrnlRow` no vincula un cobro con la factura que salda).

`ReceiptTags` trae `PostOrderSale` + `PostOrderRecpt` en la misma fila —
parece ser exactamente ese vínculo. Columnas completas: sin explorar aún.

**Siguiente paso cuando se retome:** columnas completas, `COUNT(*)`, y una
muestra cruzando `PostOrderSale`/`PostOrderRecpt` contra `JrnlHdr` para
confirmar que efectivamente conecta una venta con su cobro.

`CashFlow` / `CashFlowAccount` / `CashFlowTransaction` — exploradas
(2026-08-01), las tres con 0 filas. El módulo de Cash Flow Manager no se usó
en esta compañía demo. Fact-shaped por esquema, sin datos que verificar.

---

## Cómo se llegó a esto

Los números salen de `data/*.json` (descifrados con `descifrar.py`) del commit
`2912ba6`. Hay un Excel con las 583 filas marcadas una por una y comentarios por
celda, pero **no está en el repo**: contiene datos financieros en claro y
`.gitignore` excluye `*.xlsx`. Este documento es autosuficiente sin él.

**Bloqueante aparte:** `propiedades.json` todavía tiene
`warehouse_endpoint: "REEMPLAZAR..."`, así que la carga real a Fabric no puede
correr igual.
