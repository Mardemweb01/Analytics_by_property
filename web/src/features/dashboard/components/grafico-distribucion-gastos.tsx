import { useMemo } from 'react'

import { ChartCard } from '@/components/charts/chart-card'
import { EChart, type OpcionesECharts } from '@/components/charts/echart'
import { useChartTheme } from '@/hooks/use-chart-theme'
import { tooltipBase } from '@/lib/chart-options'
import { formatearMoneda, formatearPorcentaje } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CategoriaGasto } from '@/types'

export interface GraficoDistribucionGastosProps {
  datos: CategoriaGasto[]
  total: number
  indice?: number
  className?: string | undefined
}

/**
 * Distribución de gastos del mes (donut).
 *
 * El donut sobrevive acá —y no lo reemplazamos por barras— porque hay solo 5
 * categorías y la pregunta es de composición ("¿en qué se va la plata?"), que
 * es el único caso donde un donut supera a una barra. Con más de ~6 porciones
 * habría que cambiarlo.
 *
 * La leyenda es HTML propio, no la nativa de ECharts: así muestra monto Y
 * porcentaje alineados en columnas, hereda la tipografía del sistema y es
 * legible por lectores de pantalla.
 */
export function GraficoDistribucionGastos({
  datos,
  total,
  indice = 0,
  className,
}: GraficoDistribucionGastosProps) {
  const tema = useChartTheme()

  const opciones = useMemo<OpcionesECharts>(
    () => ({
      tooltip: {
        ...tooltipBase(tema),
        trigger: 'item',
        formatter: (parametros: { marker: string; name: string; value: number; percent: number }) =>
          `<div style="display:flex;align-items:center;gap:8px">
            ${parametros.marker}
            <span style="flex:1">${parametros.name}</span>
            <strong style="font-variant-numeric:tabular-nums">${formatearMoneda(parametros.value)}</strong>
          </div>
          <div style="opacity:.7;margin-top:2px">${formatearPorcentaje(parametros.percent, 1)} del total</div>`,
      },
      series: [
        {
          type: 'pie',
          // Anillo grueso: deja hueco para el total al centro sin volverse un
          // aro fino donde las porciones chicas dejan de verse.
          radius: ['62%', '86%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          padAngle: 1.5,
          itemStyle: {
            borderRadius: 4,
            borderColor: tema.superficie,
            borderWidth: 2,
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
            itemStyle: { shadowBlur: 12, shadowColor: 'rgb(16 24 40 / 0.16)' },
          },
          data: datos.map((categoria) => ({
            name: categoria.nombre,
            value: categoria.monto,
            itemStyle: { color: tema.series[categoria.indiceColor % tema.series.length] },
          })),
        },
      ],
      animationEasing: 'cubicOut',
      animationDuration: 700,
    }),
    [datos, tema],
  )

  return (
    <ChartCard
      titulo="¿En qué se gastó?"
      subtitulo="Distribución de gastos del mes"
      indice={indice}
      className={className}
    >
      <div className="flex min-w-0 flex-1 flex-col items-center gap-4 px-3 sm:flex-row">
        <div className="relative w-full max-w-[220px] shrink-0">
          <EChart
            opciones={opciones}
            alto={220}
            descripcionAccesible={`Gráfico de dona con la distribución de ${formatearMoneda(total)} en gastos del mes por categoría.`}
          />
          {/* Total al centro. Superpuesto en HTML y no como `graphic` de
              ECharts: así usa la misma tipografía y tokens que el resto, y se
              puede seleccionar y leer con lector de pantalla. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-caption text-foreground-muted">Total gastos</span>
            <span className="text-metric text-foreground tabular">{formatearMoneda(total)}</span>
          </div>
        </div>

        <ul className="flex w-full min-w-0 flex-col gap-1.5">
          {datos.map((categoria) => (
            <li
              key={categoria.id}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2 py-1.5',
                'transition-colors duration-150 hover:bg-surface-hover',
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: tema.series[categoria.indiceColor % tema.series.length],
                }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-body text-foreground-secondary">
                {categoria.nombre}
              </span>
              <span className="shrink-0 text-caption text-foreground-muted tabular">
                {formatearMoneda(categoria.monto)}
              </span>
              <span className="w-10 shrink-0 text-right text-body font-semibold text-foreground tabular">
                {formatearPorcentaje(categoria.porcentaje)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  )
}
