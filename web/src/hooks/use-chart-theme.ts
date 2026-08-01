import { useMemo } from 'react'

import { useTheme } from '@/hooks/use-theme'

export interface TemaGrafico {
  series: string[]
  ingresos: string
  gastos: string
  grilla: string
  eje: string
  texto: string
  textoTenue: string
  superficie: string
  borde: string
  tooltipFondo: string
  tooltipTexto: string
  fuente: string
}

/** Lee una custom property del `<html>` ya resuelta por el navegador. */
function leerVariable(nombre: string, respaldo: string): string {
  if (typeof window === 'undefined') return respaldo
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim()
  return valor || respaldo
}

/**
 * Traduce los design tokens a valores concretos para ECharts.
 *
 * ECharts pinta sobre canvas y no entiende CSS: no se le puede pasar
 * `var(--chart-1)`, necesita `#1570ef`. Este hook hace de puente, de modo que
 * los gráficos sigan obedeciendo al mismo sistema de color que el resto de la
 * UI en vez de tener su propia paleta hardcodeada.
 *
 * Depende de `tema` para recalcular: al alternar claro/oscuro las variables
 * cambian, y sin esta dependencia los gráficos se quedarían con los colores
 * del tema anterior hasta el siguiente render.
 */
export function useChartTheme(): TemaGrafico {
  const { tema } = useTheme()

  return useMemo<TemaGrafico>(
    () => ({
      series: [
        leerVariable('--chart-1', '#175cd3'),
        leerVariable('--chart-2', '#17b26a'),
        leerVariable('--chart-3', '#fdb022'),
        leerVariable('--chart-4', '#7a5af8'),
        leerVariable('--chart-5', '#53b1fd'),
        leerVariable('--chart-6', '#f97066'),
        leerVariable('--chart-7', '#15b79e'),
        leerVariable('--chart-8', '#98a2b3'),
      ],
      ingresos: leerVariable('--chart-income', '#17b26a'),
      gastos: leerVariable('--chart-expense', '#f04438'),
      grilla: leerVariable('--chart-grid', '#e4e7ec'),
      eje: leerVariable('--chart-axis', '#98a2b3'),
      texto: leerVariable('--foreground', '#101828'),
      textoTenue: leerVariable('--foreground-muted', '#667085'),
      superficie: leerVariable('--surface', '#ffffff'),
      borde: leerVariable('--border', '#e4e7ec'),
      tooltipFondo: leerVariable('--chart-tooltip-bg', '#101828'),
      tooltipTexto: leerVariable('--chart-tooltip-fg', '#f9fafb'),
      fuente: "'Inter Variable', 'Inter', system-ui, sans-serif",
    }),
    // `tema` no se usa en el cuerpo pero es la señal de invalidación: cuando
    // cambia, las variables CSS ya tienen valores nuevos y hay que releerlas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tema],
  )
}
