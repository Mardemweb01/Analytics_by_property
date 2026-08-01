/* ============================================================================
 * FORMATO DE VALORES FINANCIEROS
 * ----------------------------------------------------------------------------
 * Toda cifra que se muestra en pantalla pasa por acá. Es lógica pura y sin
 * dependencias de React a propósito: se testea sin montar nada, y garantiza
 * que el mismo importe se vea igual en una KPI, en un eje de gráfico, en un
 * tooltip y en una celda de tabla.
 *
 * Los `Intl.NumberFormat` se memoizan porque construirlos es caro (~0.1ms) y
 * una tabla de 200 filas x 4 columnas los instanciaría 800 veces por render.
 * ========================================================================== */

import { format as formatDateFns, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

/** Locale y moneda del producto: Panamá, balboa. `Intl` con es-PA + PAB ya
 *  produce el formato "B/. 142,580.50" nativamente, sin concatenar símbolos
 *  a mano (que rompería en cifras negativas). */
export const LOCALE = 'es-PA'
export const CURRENCY = 'PAB'

/**
 * Espacio duro (U+00A0). Es el que `Intl` inserta entre el símbolo y el
 * importe, y lo replicamos en el formato compacto para que ambos caminos
 * produzcan exactamente el mismo separador.
 *
 * No es un detalle cosmético: con un espacio normal, "B/." puede quedar
 * colgado al final de una línea y el número saltar a la siguiente.
 */
const ESPACIO_DURO = ' '

/** Cache de formateadores, indexada por su configuración serializada. */
const cacheNumero = new Map<string, Intl.NumberFormat>()

function obtenerFormateador(opciones: Intl.NumberFormatOptions): Intl.NumberFormat {
  const clave = JSON.stringify(opciones)
  let formateador = cacheNumero.get(clave)
  if (!formateador) {
    formateador = new Intl.NumberFormat(LOCALE, opciones)
    cacheNumero.set(clave, formateador)
  }
  return formateador
}

export interface OpcionesMoneda {
  /** Decimales a mostrar. Por defecto 0: en una vista ejecutiva los centavos
   *  son ruido — el lector compara magnitudes, no concilia. */
  decimales?: number
  /** Abrevia a K/M. Para ejes de gráficos, donde el espacio manda. */
  compacto?: boolean
  /** Fuerza el signo `+` en positivos. Para variaciones, no para saldos. */
  signoExplicito?: boolean
}

/**
 * Formatea un importe como moneda.
 * @example formatearMoneda(142580)             // "B/. 142,580"
 * @example formatearMoneda(142580, { compacto: true })  // "B/. 142.6K"
 * @example formatearMoneda(-58320)             // "-B/. 58,320"
 */
export function formatearMoneda(valor: number, opciones: OpcionesMoneda = {}): string {
  const { decimales = 0, compacto = false, signoExplicito = false } = opciones

  if (!Number.isFinite(valor)) return '—'

  if (compacto) {
    return formatearMonedaCompacta(valor, signoExplicito)
  }

  const texto = obtenerFormateador({
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    signDisplay: signoExplicito ? 'always' : 'auto',
  }).format(valor)

  return texto
}

/**
 * Versión abreviada para ejes y espacios estrechos. La armamos a mano en vez
 * de usar `notation: 'compact'` porque el compacto nativo de es-PA devuelve
 * "142.6 k" (minúscula y con espacio), que se lee peor en un eje.
 */
function formatearMonedaCompacta(valor: number, signoExplicito: boolean): string {
  const absoluto = Math.abs(valor)
  const signo = valor < 0 ? '-' : signoExplicito ? '+' : ''

  let numero: string
  if (absoluto >= 1_000_000) {
    numero = `${recortarCeros(absoluto / 1_000_000)}M`
  } else if (absoluto >= 1_000) {
    numero = `${recortarCeros(absoluto / 1_000)}K`
  } else {
    numero = obtenerFormateador({ maximumFractionDigits: 0 }).format(absoluto)
  }

  return `${signo}B/.${ESPACIO_DURO}${numero}`
}

/** 142.0 -> "142" pero 142.6 -> "142.6": evita el decimal cuando no aporta. */
function recortarCeros(valor: number): string {
  const redondeado = Math.round(valor * 10) / 10
  return Number.isInteger(redondeado) ? String(redondeado) : redondeado.toFixed(1)
}

/**
 * Formatea un número sin símbolo de moneda (conteos, unidades, cantidad de
 * apartamentos).
 */
export function formatearNumero(valor: number, decimales = 0): string {
  if (!Number.isFinite(valor)) return '—'
  return obtenerFormateador({
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)
}

/**
 * Formatea un porcentaje. Recibe el número tal cual se muestra (92 => "92%"),
 * NO una fracción — es el error más fácil de cometer al consumir esta capa,
 * así que la firma es explícita en vez de usar `style: 'percent'`.
 *
 * @example formatearPorcentaje(92)        // "92%"
 * @example formatearPorcentaje(8.7, 1)    // "8.7%"
 */
export function formatearPorcentaje(valor: number, decimales = 0): string {
  if (!Number.isFinite(valor)) return '—'
  const numero = obtenerFormateador({
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)
  return `${numero}%`
}

/**
 * Formatea una variación porcentual con su signo, para los badges de
 * comparación ("↑ 8.7% vs. Abr 2026").
 *
 * @example formatearVariacion(8.7)   // "+8.7%"
 * @example formatearVariacion(-2.1)  // "-2.1%"
 * @example formatearVariacion(0)     // "0%"
 */
export function formatearVariacion(valor: number, decimales = 1): string {
  if (!Number.isFinite(valor)) return '—'
  if (valor === 0) return '0%'
  const numero = obtenerFormateador({
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    signDisplay: 'always',
  }).format(valor)
  return `${numero}%`
}

/* --------------------------------------------------------------------------
 * Fechas
 * ------------------------------------------------------------------------ */

/** Acepta `Date` o ISO string y normaliza a `Date`. Las APIs devuelven
 *  strings; los mocks y los cálculos internos usan `Date`. */
function aFecha(valor: Date | string): Date {
  return typeof valor === 'string' ? parseISO(valor) : valor
}

/** "mayo 2026" -> capitalizado "Mayo 2026", como en la referencia. */
export function formatearMesAno(valor: Date | string): string {
  const texto = formatDateFns(aFecha(valor), 'MMMM yyyy', { locale: es })
  return capitalizar(texto)
}

/** Forma corta para ejes y comparaciones: "Abr 2026". */
export function formatearMesCorto(valor: Date | string): string {
  const texto = formatDateFns(aFecha(valor), 'MMM yyyy', { locale: es })
  return capitalizar(texto.replace('.', ''))
}

/** Solo el mes, para ejes de series de 6-12 meses: "Abr". */
export function formatearMesEtiqueta(valor: Date | string): string {
  const texto = formatDateFns(aFecha(valor), 'MMM', { locale: es })
  return capitalizar(texto.replace('.', ''))
}

/** Fecha completa para tablas de transacciones: "12 may 2026". */
export function formatearFecha(valor: Date | string): string {
  return formatDateFns(aFecha(valor), "d MMM yyyy", { locale: es }).replace('.', '')
}

/** Fecha corta para columnas angostas: "12/05/26". */
export function formatearFechaCorta(valor: Date | string): string {
  return formatDateFns(aFecha(valor), 'dd/MM/yy', { locale: es })
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
