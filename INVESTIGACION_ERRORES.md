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
| 3 — journal 8 | | | |
| 2a — gl 0 journal 5 | | | |
| 2b — gl 0 BegBal | | | |
| 1 — post_order -2 | | | |
| ¿`post_order` visible en la UI? | | | |

Con los cuatro resueltos, los cambios caen en `modelo/staging/01_vistas.sql` y
`modelo/99_control_calidad.sql` — salvo que el caso 3 obligue a tocar el
extractor.

---

## Cómo se llegó a esto

Los números salen de `data/*.json` (descifrados con `descifrar.py`) del commit
`2912ba6`. Hay un Excel con las 583 filas marcadas una por una y comentarios por
celda, pero **no está en el repo**: contiene datos financieros en claro y
`.gitignore` excluye `*.xlsx`. Este documento es autosuficiente sin él.

**Bloqueante aparte:** `propiedades.json` todavía tiene
`warehouse_endpoint: "REEMPLAZAR..."`, así que la carga real a Fabric no puede
correr igual.
