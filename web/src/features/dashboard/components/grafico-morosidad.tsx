import { useMemo } from 'react'

import { ChartCard } from '@/components/charts/chart-card'
import { EChart, type OpcionesECharts } from '@/components/charts/echart'
import { useChartTheme } from '@/hooks/use-chart-theme'
import { ejeCategoria, ejeMoneda, grillaBase, tooltipBase } from '@/lib/chart-options'
import { formatearMoneda, formatearNumero } from '@/lib/format'
import type { IntencionSemantica, TramoMorosidad } from '@/types'

export interface GraficoMorosidadProps {
  datos: TramoMorosidad[]
  indice?: number
  className?: string | undefined
}

/**
 * Antigüedad de la morosidad (aging).
 *
 * El color escala con la severidad —azul, ámbar, rojo— en lugar de usar una
 * sola serie. En un aging el tramo importa tanto como el monto: B/. 3,700 a
 * más de 90 días es un problema distinto que B/. 6,420 a menos de 30, y el
 * degradado de color lo dice sin tener que leer los ejes.
 */
export function GraficoMorosidad({ datos, indice = 0, className }: GraficoMorosidadProps) {
  const tema = useChartTheme()

  const colorPorSeveridad = useMemo<Record<IntencionSemantica, string>>(
    () => ({
      positive: tema.ingresos,
      informative: tema.series[0] ?? '',
      caution: tema.series[2] ?? '',
      negative: tema.gastos,
      accent: tema.series[3] ?? '',
      neutral: tema.series[7] ?? '',
    }),
    [tema],
  )

  const opciones = useMemo<OpcionesECharts>(
    () => ({
      tooltip: {
        ...tooltipBase(tema),
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: readonly { dataIndex: number; marker: string; name: string }[]) => {
          const punto = params[0]
          if (!punto) return ''
          const tramo = datos[punto.dataIndex]
          if (!tramo) return ''
          return `<div style="font-weight:600">${tramo.etiqueta}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              ${punto.marker}
              <span style="flex:1">Saldo</span>
              <strong style="font-variant-numeric:tabular-nums">${formatearMoneda(tramo.monto)}</strong>
            </div>
            <div style="opacity:.7;margin-top:2px">${formatearNumero(tramo.unidades)} unidades</div>`
        },
      },
      grid: grillaBase(),
      xAxis: ejeCategoria(
        tema,
        datos.map((tramo) => tramo.tramo),
      ),
      yAxis: ejeMoneda(tema),
      series: [
        {
          name: 'Morosidad',
          type: 'bar',
          data: datos.map((tramo) => ({
            value: tramo.monto,
            itemStyle: {
              color: colorPorSeveridad[tramo.severidad],
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barMaxWidth: 44,
          animationDelay: (indiceDato: number) => indiceDato * 70,
        },
      ],
      animationEasing: 'cubicOut',
      animationDuration: 700,
    }),
    [datos, tema, colorPorSeveridad],
  )

  const total = datos.reduce((suma, tramo) => suma + tramo.monto, 0)
  const critico = datos.find((tramo) => tramo.tramo === '90+')

  return (
    <ChartCard
      titulo="Antigüedad de la Morosidad"
      subtitulo={
        critico
          ? `${formatearMoneda(critico.monto)} con más de 90 días`
          : `${formatearMoneda(total)} pendiente`
      }
      indice={indice}
      className={className}
    >
      <EChart
        opciones={opciones}
        alto={264}
        descripcionAccesible={`Gráfico de barras con la antigüedad de la morosidad por tramo de días. Total pendiente ${formatearMoneda(total)}.`}
      />
    </ChartCard>
  )
}
