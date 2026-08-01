# Mardem Analytics — Dashboard Financiero de PH

Panel ejecutivo para administración de propiedades horizontales (condominios / PH).
Muestra el resumen financiero de un edificio: saldos, flujo del mes, cobranza,
morosidad, presupuesto y fondo de reserva.

```bash
npm install
npm run dev       # http://localhost:5173
npm run verify    # typecheck + lint + tests + build
```

---

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Build | Vite 8 | Bundler actual del template oficial de React |
| UI | React 19 + TypeScript 6 | `strict` con `noUncheckedIndexedAccess` |
| Estilos | Tailwind CSS v4 (CSS-first) | Tokens en `@theme`, sin `tailwind.config.js` |
| Primitivos | Radix UI + patrón shadcn | Accesibilidad resuelta; el código es nuestro |
| Gráficos | Apache ECharts 6 (`echarts/core`) | Registro modular explícito |
| Datos | TanStack Query 5 | Cache, cancelación, estados de carga |
| Animación | Motion 12 | Entradas, contadores, transiciones |
| Rutas | React Router 8 | Rutas con `lazy()` |
| Tests | Vitest | Co-locados junto al código |
| Lint | oxlint | Es el linter del template de Vite 8 |

> **Desvíos respecto del brief original, y su motivo**
>
> - **oxlint en vez de ESLint.** Es lo que trae hoy el template oficial de Vite;
>   cumple el mismo rol y corre en una fracción del tiempo.
> - **`exactOptionalPropertyTypes` desactivado.** Distingue "prop ausente" de
>   "prop con valor `undefined`", distinción que React no hace. Activarlo obliga
>   a anotar `| undefined` en decenas de props sin atrapar bugs reales. El resto
>   de las reglas estrictas sí están activas.

---

## Arquitectura

```
src/
├── app/              Composición raíz: providers y router
├── api/              Contratos (interfaces). Sin implementación
├── services/         Implementaciones de los contratos + mocks
├── features/         Módulos por dominio (hooks + componentes propios)
│   └── dashboard/
├── components/       Componentes compartidos entre features
│   ├── ui/           Primitivos (Button, Card, Select, Tooltip…)
│   ├── layout/       DashboardLayout, Sidebar, Topbar
│   ├── cards/        MetricCard, StatusCard, LoadingCard
│   ├── charts/       EChart, ChartCard, Sparkline
│   ├── tables/       DataTable genérica
│   ├── filters/      FilterBar
│   ├── dashboard/    SectionHeader, ComparisonBadge, TrendIndicator
│   └── feedback/     EstadoVacio, ErrorCard, PantallaCargando
├── hooks/            Hooks transversales (tema, media query, contador)
├── lib/              Lógica pura: format, sparkline, chart-options, utils
├── store/            Estado con contexto compartido real
├── types/            Modelo de dominio
├── constants/        Navegación, iconos de KPI, config
└── styles/           tokens.css, theme.css, base.css
```

### La regla que ordena todo

**Una página solo compone.** No calcula, no formatea, no consulta.
`resumen-page.tsx` decide *qué* bloques se muestran y en qué orden; el *cómo*
vive en los componentes y el *dato* en los hooks de la feature. Por eso la
pantalla más densa del producto se lee de un vistazo.

### Flujo de datos

```
componente → hook de feature → TanStack Query → financeApi (contrato)
                                                      ↓
                                            MockFinanceApi  ← hoy
                                            HttpFinanceApi  ← mañana
```

`src/api/finance-api.ts` define la interfaz; `src/services/finance-service.ts`
elige la implementación **en una sola línea**. Cambiar el mock por el pipeline
real de Sage 50 no toca ningún componente ni hook.

Un **único hook** (`useResumenFinanciero`) sirve toda la pantalla, en vez de
nueve queries independientes. Eso garantiza que KPIs, gráficos y tablas
provengan del mismo corte: es imposible que las tarjetas muestren mayo mientras
un gráfico todavía pinta abril.

### Store vs. co-locación

- **`store/sidebar-store.tsx`** — es un store porque hay tres consumidores
  separados en el árbol: el Topbar lo alterna, el Sidebar lo consume y el
  Layout calcula su padding con él.
- **`use-filtros-dashboard.ts`** — es un hook co-locado porque los filtros solo
  los usa esta pantalla. Centralizarlo sería centralizar por reflejo.

### Lógica pura extraída

`lib/sparkline.ts` y `lib/format.ts` no importan React. Concentran los `if` de
casos borde (serie vacía, un solo punto, valores idénticos, no finitos) y por
eso se testean llamándolos, sin montar nada. Son los dos archivos con tests.

---

## Sistema de diseño

Dos capas de tokens, y el orden importa:

1. **Primitivas** (`--neutral-500`, `--success-600`) — la paleta cruda. Nunca se
   usan directo en un componente.
2. **Semánticas** (`--surface`, `--border`, `--positive`) — describen intención.
   Son las únicas que consume la UI, y las únicas que `.dark` reasigna.

Por eso el modo oscuro es **un bloque de reasignaciones** en `tokens.css` y no
una cacería de `dark:` por componente. `theme.css` las expone como utilidades
vía `@theme inline`, que emite `var(--surface)` en lugar de copiar el valor.

**Nombres que no colisionan.** Los tokens se llaman `--corner-*`,
`--elevation-*` y `--motion-ease-*` en vez de `--radius-*`, `--shadow-*` y
`--ease-*` porque esos tres son namespaces propios de Tailwind v4: reusarlos
haría que el mapeo se referenciara a sí mismo.

### Trampa de `cn()` — leer antes de agregar clases

`lib/utils.ts` extiende `tailwind-merge` declarando qué clases propias son
tamaños de fuente (`text-display`, `text-h1`, `text-metric-xl`…) y qué radios
son nuestros (`rounded-card`, `rounded-control`).

Sin esa configuración, `cn('text-display', 'text-foreground')` **descarta el
tamaño**: tailwind-merge no puede saber que una es tamaño y otra color —ambas
son clases nuestras—, asume que compiten y conserva la última. El fallo es
silencioso: sin error ni warning, cada título del sistema hereda los 14px del
body.

> **Si agregás un tamaño de texto a `theme.css`, sumalo a `TAMANOS_TEXTO` en
> `lib/utils.ts`.**

### Color

Paleta desaturada (familia Stripe / Untitled UI). En un dashboard financiero el
color es señal, no decoración: si todo grita, nada comunica. El verde de
"Ingresos" y el rojo de "Gastos" son los únicos acentos fuertes de la pantalla.

Las series de gráficos (`--chart-1..8`) son fijas y ordenadas: la categoría N
usa siempre el mismo color en todos los gráficos, o el lector tendría que
releer la leyenda en cada card.

### Tipografía

Inter Variable **self-hosted** (sin CDN: sin request externo, sin FOUT, y
funciona offline). `font-feature-settings: 'cv11'` desambigua `l`/`1`/`I`, que
importa en una pantalla llena de códigos de cuenta.

Todo importe lleva la clase `.tabular` (`font-variant-numeric: tabular-nums`).
Sin ella las cifras de una columna no alinean sus unidades y comparar de un
vistazo se vuelve imposible.

---

## Decisiones de visualización

| Gráfico | Forma | Por qué |
|---|---|---|
| Ingresos vs Gastos | Barras **agrupadas** | La pregunta es "¿cuál fue mayor?"; apilar haría imposible comparar alturas |
| Evolución del saldo | Línea + área, **eje sin cero** | Mide evolución, no magnitud; anclar en cero comprimiría 105K–143K en una franja |
| Distribución de gastos | Donut | Solo 5 categorías y la pregunta es de composición — el único caso donde gana a una barra |
| Presupuesto vs real | Barras **horizontales superpuestas** | Los nombres de rubro no entran rotados; el sobregiro se ve cuando la barra de color desborda |
| Fondo de reserva | Área + `markLine` | Es un acumulado; la línea de "mínimo recomendado" lo vuelve un indicador de cumplimiento |
| Antigüedad de morosidad | Barras con **color por severidad** | El tramo importa tanto como el monto |

**Sparklines en SVG propio, no en ECharts.** Nueve instancias de ECharts para
dibujar nueve polilíneas de seis puntos costarían megabytes de runtime y un
observer de resize por tarjeta. `components/charts/sparkline.tsx` son ~40 líneas
sin dependencias.

**Dirección ≠ intención.** En "Gastos del Mes" una flecha hacia abajo es *buena*
noticia; en "Ingresos", la misma flecha es mala. Por eso `Comparacion` lleva
`direccion` e `intencion` como campos separados: la segunda no se puede derivar
de la primera.

---

## Accesibilidad

- Enlace "Saltar al contenido" como primer elemento tabulable (WCAG 2.4.1).
- Foco visible y consistente vía `:focus-visible`, nunca `:focus` (2.4.7).
- El color nunca es el único canal: el ítem activo del menú suma una barra
  lateral; el semáforo suma etiqueta textual y puntaje (1.4.1).
- Cada `<canvas>` de ECharts va envuelto con `role="img"` y una
  `descripcionAccesible` obligatoria por tipo — el canvas es opaco para un
  lector de pantalla.
- Leyendas y el total del donut son HTML, no `graphic` de ECharts: se
  seleccionan y se leen.
- `prefers-reduced-motion` reduce las animaciones y desactiva los contadores
  animados.

---

## Rendimiento

- **Code splitting** por ruta (`lazy()`) y chunks manuales para `echarts`,
  `react` y `query`. ECharts (~600 kB) queda aislado: cambia poco, así que su
  cache sobrevive entre despliegues, y solo se descarga al entrar a una vista
  con gráficos.
- **Registro modular de ECharts**: se importan solo los módulos usados desde
  `echarts/core`. Agregar un tipo de gráfico obliga a registrarlo — a propósito,
  para que el costo del bundle sea una decisión consciente.
- `ResizeObserver` sobre el contenedor del gráfico, no `window.resize`: colapsar
  el sidebar cambia el ancho sin que la ventana cambie de tamaño.
- Formateadores `Intl` memoizados: construirlos cuesta ~0.1 ms y una tabla de
  200×4 los instanciaría 800 veces por render.
- `placeholderData` en la query: al cambiar de período el dashboard se atenúa en
  vez de colapsar a skeletons.

Sin virtualización en las tablas: muestran "top N" (5–10 filas). Corresponderá
cuando alguna vista liste cientos de movimientos.

---

## Sobre los datos

El mock (`services/mock/datos-mock.ts`) reproduce la maqueta de referencia, que
**no cerraba consigo misma**. Las tres reconciliaciones están documentadas en la
cabecera de ese archivo:

1. **"Otros 0%"** en el donut — las otras cinco categorías ya sumaban 100%, así
   que era una porción de área cero con entrada en la leyenda. Se eliminó.
2. **Saldo vs superávit** — el salto de abril a mayo es 11,480 pero el superávit
   es 6,460. No es un error: el saldo también se mueve por partidas no
   operativas. Se mantuvieron ambos y se documentó la diferencia.
3. **Meses previos** — derivados hacia atrás desde las variaciones que muestra la
   maqueta (+8.7%, +5.3%, −2.1%…), para que cada porcentaje sea verificable
   contra su serie en vez de ser un número suelto.

---

## Estado actual

Implementado: layout completo, sistema de diseño con modo oscuro, las 9 KPIs,
los 6 gráficos, las 4 tablas, la barra de filtros y los estados de
carga / vacío / error.

Pendiente: las secciones del menú distintas de "Resumen" muestran un estado de
"en construcción"; la exportación usa `window.print()`; el buscador global (⌘K)
está maquetado sin cablear.
