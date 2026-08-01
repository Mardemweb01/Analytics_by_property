/* ============================================================================
 * OPCIONES COMPARTIDAS DE ECHARTS
 * ----------------------------------------------------------------------------
 * Fragmentos de configuración reutilizables. Son funciones puras que reciben
 * el tema y devuelven objetos de opciones: sin ellas, los seis gráficos
 * terminarían con seis tooltips ligeramente distintos y seis interpretaciones
 * del estilo de eje.
 * ========================================================================== */

import type { TemaGrafico } from '@/hooks/use-chart-theme'
import { formatearMoneda } from '@/lib/format'

/** Tooltip del sistema: fondo oscuro, sin borde, tipografía de la app. */
export function tooltipBase(tema: TemaGrafico) {
  return {
    backgroundColor: tema.tooltipFondo,
    borderWidth: 0,
    padding: [8, 12] as [number, number],
    textStyle: {
      color: tema.tooltipTexto,
      fontFamily: tema.fuente,
      fontSize: 12,
    },
    extraCssText: 'border-radius: 10px; box-shadow: 0 12px 16px -4px rgb(16 24 40 / 0.14);',
  }
}

/** Eje X de categorías (meses). Sin línea de eje ni ticks: la grilla
 *  horizontal ya da la referencia y el marco extra solo agrega tinta. */
export function ejeCategoria(tema: TemaGrafico, categorias: string[]) {
  return {
    type: 'category' as const,
    data: categorias,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: tema.textoTenue,
      fontFamily: tema.fuente,
      fontSize: 12,
      margin: 12,
    },
    // La banda de resalte al pasar el mouse ayuda a leer la columna completa
    // sin necesidad de una línea guía.
    axisPointer: { type: 'shadow' as const },
  }
}

/** Eje Y de valores monetarios, con etiquetas compactas (B/. 60K). */
export function ejeMoneda(tema: TemaGrafico, opciones: { compacto?: boolean } = {}) {
  const { compacto = true } = opciones
  return {
    type: 'value' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: tema.textoTenue,
      fontFamily: tema.fuente,
      fontSize: 12,
      formatter: (valor: number) => formatearMoneda(valor, { compacto }),
    },
    splitLine: {
      lineStyle: {
        color: tema.grilla,
        // Punteada: la grilla debe orientar la lectura sin competir con las
        // series por atención.
        type: 'dashed' as const,
      },
    },
  }
}

/** Márgenes internos. `containLabel` evita que las etiquetas del eje queden
 *  cortadas cuando los importes son largos. */
export function grillaBase(overrides: Record<string, unknown> = {}) {
  return {
    top: 16,
    right: 16,
    bottom: 8,
    left: 8,
    containLabel: true,
    ...overrides,
  }
}

/** Formatea el contenido del tooltip para series temporales. ECharts lo
 *  recibe como HTML string, así que el marcado va en línea. */
export function tooltipSeriesHtml(
  params: readonly { marker?: string; seriesName?: string; value?: unknown; name?: string }[],
): string {
  const titulo = params[0]?.name ?? ''
  const filas = params
    .map((punto) => {
      const valor = typeof punto.value === 'number' ? formatearMoneda(punto.value) : '—'
      return `<div style="display:flex;align-items:center;gap:8px;margin-top:4px">
        ${punto.marker ?? ''}
        <span style="flex:1">${punto.seriesName ?? ''}</span>
        <strong style="font-variant-numeric:tabular-nums">${valor}</strong>
      </div>`
    })
    .join('')

  return `<div style="font-weight:600">${titulo}</div>${filas}`
}
