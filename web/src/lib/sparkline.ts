/* ============================================================================
 * GEOMETRÍA DEL SPARKLINE
 * ----------------------------------------------------------------------------
 * Lógica pura: entra una serie de números, sale un path SVG. Sin React, sin
 * DOM, sin dependencias — se testea llamándola.
 *
 * Está separada del componente a propósito: el cálculo del trazado tiene
 * `if`s de casos borde (serie vacía, un solo punto, todos los valores
 * iguales) que son exactamente lo que se quiere cubrir con tests, y eso no
 * debería exigir montar un componente.
 * ========================================================================== */

export interface OpcionesSparkline {
  ancho: number
  alto: number
  /** Margen vertical para que el trazo no toque los bordes del viewBox y el
   *  grosor de línea no se recorte. */
  margen?: number
}

export interface TrazadoSparkline {
  /** Path de la línea. */
  linea: string
  /** Path del área bajo la línea (línea + cierre contra la base). */
  area: string
  /** Coordenadas del último punto, para dibujarle el marcador. */
  ultimoPunto: { x: number; y: number } | null
}

/**
 * Genera los paths de un sparkline a partir de una serie.
 *
 * Normaliza contra min/max de la propia serie (no contra cero): un sparkline
 * comunica FORMA, no magnitud. Anclarlo en cero aplanaría cualquier serie que
 * oscile en un rango angosto sobre un valor alto — justo el caso de un saldo
 * bancario, donde la variación relevante es de miles sobre cientos de miles.
 */
export function calcularSparkline(
  valores: readonly number[],
  opciones: OpcionesSparkline,
): TrazadoSparkline {
  const { ancho, alto, margen = 2 } = opciones
  const vacio: TrazadoSparkline = { linea: '', area: '', ultimoPunto: null }

  if (valores.length === 0) return vacio

  // Un único punto no define una línea: lo dibujamos como un segmento
  // horizontal centrado, que se lee como "sin variación" en vez de como un
  // trazo roto.
  if (valores.length === 1) {
    const y = alto / 2
    return {
      linea: `M 0 ${y} L ${ancho} ${y}`,
      area: `M 0 ${y} L ${ancho} ${y} L ${ancho} ${alto} L 0 ${alto} Z`,
      ultimoPunto: { x: ancho, y },
    }
  }

  const minimo = Math.min(...valores)
  const maximo = Math.max(...valores)
  const rango = maximo - minimo

  const alturaUtil = alto - margen * 2
  const pasoX = ancho / (valores.length - 1)

  const puntos = valores.map((valor, indice) => {
    const x = indice * pasoX
    // Serie constante: rango 0 provocaría división por cero. La centramos,
    // que es la lectura correcta de "esto no se movió".
    const proporcion = rango === 0 ? 0.5 : (valor - minimo) / rango
    // El eje Y de SVG crece hacia abajo: invertimos para que un valor alto
    // quede arriba.
    const y = margen + (1 - proporcion) * alturaUtil
    return { x, y }
  })

  const linea = puntos
    .map((punto, indice) => `${indice === 0 ? 'M' : 'L'} ${redondear(punto.x)} ${redondear(punto.y)}`)
    .join(' ')

  const area = `${linea} L ${redondear(ancho)} ${alto} L 0 ${alto} Z`

  return {
    linea,
    area,
    ultimoPunto: puntos[puntos.length - 1] ?? null,
  }
}

/** Recorta a 2 decimales: más precisión solo engorda el HTML sin cambiar un
 *  píxel de lo que se ve. */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * Dirección de la serie, comparando el primer y el último valor.
 * Se usa para teñir el sparkline cuando la KPI no trae una intención propia.
 */
export function direccionSerie(valores: readonly number[]): 'up' | 'down' | 'flat' {
  const primero = valores[0]
  const ultimo = valores[valores.length - 1]
  if (primero === undefined || ultimo === undefined || primero === ultimo) return 'flat'
  return ultimo > primero ? 'up' : 'down'
}
