# Columnas de Sage — hallazgos de la investigación (2026-08-01/02)

Documento de referencia. Registra las columnas de `JrnlRow`, `JrnlHdr`, `Chart`
y `Customers` que resultaron relevantes durante la investigación de hoy, y la
decisión que sale de ahí.

**Decisión tomada:** los extractores (`extractores/*.py`) hoy solo traen un
subconjunto curado de columnas por tabla. Se **va a cambiar la extracción
para traer todas las columnas** de cada tabla — extraer un subconjunto es en
sí una transformación/filtro, y eso es exactamente lo que la metodología de
bronze (`modelo/bronze/01_tablas.sql`) dice que no debe pasar en la
extracción. Ver `ARQUITECTURA.md` y la sección "DEUDA RESUELTA" de
`modelo/bronze/01_tablas.sql` para el precedente de esta misma discusión
aplicada a `JrnlRow`/`JrnlHdr`.

Este documento no es el plan de implementación — es el inventario de qué se
encontró y por qué importa, para no tener que re-investigar antes de armar
ese plan.

---

## `JrnlRow` — 47 columnas totales, 8 extraídas hoy

Fuente oficial: [Journal Row Fields](https://help-sage50.na.sage.com/en-us/2023/Content/DDFs/Journal_Row_Fields.htm)

| Columna | Ya se extrae | Por qué importa |
|---|:---:|---|
| `PostOrder` | ✅ | Clave del asiento |
| `GLAcntNumber` | ✅ | Cuenta |
| `Amount` | ✅ | Monto |
| `Journal` | ✅ | Origen del asiento (sin tabla de traducción — ver más abajo) |
| `RowDescription` | ✅ | Descripción |
| `CustomerRecordNumber` / `VendorRecordNumber` | ✅ | Vínculo a subledger |
| `DateCleared` | ✅ | Conciliación bancaria |
| **`IncludeInGL`** | ❌ | **Crítico.** "True => only IF this row is to be included in general ledger". Sin este filtro se cuentan órdenes/cotizaciones nunca facturadas. Resolvió los Casos 1, 2a y 2b de `INVESTIGACION_ERRORES.md`. |
| `IncludeInInvLedger` | ❌ | Si la fila afecta el ledger de inventario. No cambia el filtro contable, pero es dato de Sage que hoy se pierde. |
| `RowType` | ❌ | Clasifica la fila (Normal, COGS, InvChg, Discount, Tax, Freight, Retainage). `RowType=5` quedó sin identificar — 325 filas, -$16,577.41 en la demo. |
| `RowNumber` / `DistNumber` | ❌ | Orden de fila dentro del asiento — no es clave única (hay `RowNumber` repetido con distinto `GLAcntNumber`). |
| `RowDate` | ❌ | Fecha a nivel de línea, distinta de `JrnlHdr.TransactionDate` en el esquema (en la práctica, siempre coincidieron en los datos revisados). |
| `ItemRecordNumber` / `CostRecordNumber` | ❌ | Vínculo a `LineItem`/`InventoryCosts`. `CostRecordNumber` no está documentado oficialmente. |
| `StockingUnitCost` / `UnitCost` / `AmountReceived` | ❌ | Columnas de costo — 3 de las 4 columnas de monto de la tabla, aparte de `Amount`. No siempre están pobladas (ver Caso 3: el costo real vivía en `InventoryCosts`, no acá). |
| `LinkToAnotherTrx` / `LinkToOtherTrxIndex` | ❌ | Vincula esta fila con otra transacción — candidato para resolver pagos aplicados a facturas (326 usos reales en Las Hortensias). |
| `POSOIsClosed`, `UsedForReimbExp`, `POCreated`, `HasSerialNumbers` | ❌ | Los otros 4 flags booleanos. Verificado: ninguno cambia qué filas cuentan para el movimiento del mes — son metadata de otros procesos (orden, reembolso, origen PO, número de serie). |

## `JrnlHdr` — columnas usadas: `PostOrder`, `TransactionDate`, `Reference` (ya extraídas). No se revisó si tiene más columnas sin usar.

---

## `Chart` — 185 columnas totales, 4 extraídas hoy

| Columna | Ya se extrae | Por qué importa |
|---|:---:|---|
| `GLAcntNumber`, `AccountID`, `AccountDescription`, `AccountType` | ✅ | Identidad de la cuenta |
| **`Balance0Dr/Cr/Net` … `Balance56Dr/Cr/Net`** (171 columnas) | ❌ | **El hallazgo más grande de la sesión.** `BalanceNNet` = movimiento neto de ESE período específico (no acumulado — verificado con datos reales, coincide centavo a centavo con `SUM(Amount)` mensual de `JrnlRow`). Es la fuente que usan los reportes nativos de Sage. Documentado oficialmente en [Chart of Accounts Fields](https://help-sage50.na.sage.com/en-us/2023/Content/DDFs/Chart_of_Accounts_Fields.htm), aunque la doc solo cubre 42 períodos (0-41) y la base real tiene 57. |

**Ojo:** el índice de período **no es estático** — es relativo ("año pasado", "año actual") y se corre cuando cierra el año fiscal. Hay que re-anclarlo (período N = qué mes calendario) en cada extracción, no una sola vez.

---

## `Customers` — 153 columnas totales, 4 extraídas hoy

| Columna | Ya se extrae | Por qué importa |
|---|:---:|---|
| `CustomerID`, `Customer_Bill_Name`, `Balance`, `CustomerRecordNumber` | ✅ | Identidad y saldo corriente (sin fecha — es una foto, no una serie) |
| **`Sales1` … `Sales42`** | ❌ | Mismo patrón de períodos que `Chart`, pero por cliente: monto facturado por período |
| **`Payments1` … `Payments42`** | ❌ | Monto cobrado por período |

Verificado: `SUM(Sales) - SUM(Payments)` a través de todos los períodos = `Balance` exacto. Sumando solo hasta el período que corresponde al mes actual (empíricamente determinado, mismo problema de anclaje que `Chart`) se reproduce el saldo "a la fecha", sin necesidad de tocar `JrnlRow`/`Chart`/`JrnlHdr` para nada — 454 filas en vez de 68,459.

**Ninguna columna de `Vendors` fue revisada todavía** — por el patrón encontrado en `Customers` y `LineItem` (que también tiene `SalesAmt1-42`/`SalesQty1-42`), es probable que `Vendors` tenga el mismo tipo de columnas por período para Cuentas por Pagar. Sin confirmar.

---

## Tablas relacionadas, no extraídas, mencionadas por si se retoman

- **`InventoryCosts`** — resuelve (parcialmente) el Caso 3. No documentada oficialmente por Sage.
- **`ReceiptTags`** — pendiente de investigar. Candidata para vincular cobro↔factura (antigüedad de cartera).
