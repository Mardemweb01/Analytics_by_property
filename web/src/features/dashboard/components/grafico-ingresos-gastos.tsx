import { useMemo } from 'react'

import { ChartCard, LeyendaGrafico } from '@/components/charts/chart-card'
import { EChart, type OpcionesECharts } from '@/components/charts/echart'
import { useChartTheme } from '@/hooks/use-chart-theme'
import {
  ejeCategoria,
  ejeMoneda,
  grillaBase,
  tooltipBase,
  tooltipSeriesHtml,
} from '@/lib/chart-options'
import { formatearMoneda } from '@/lib/format'
import type { PuntoIngresoGasto } from '@/types'

export interface GraficoIngresosGastosProps {
  datos: PuntoIngresoGasto[]
  indice?: number
}

/**
 * Barras agrupadas de ingresos vs gastos.
 *
 * Agrupadas y no apiladas: la pregunta que responde la card es "¿cuál fue
 * mayor este mes?", y apilar haría imposible comparar las dos alturas. La
 * diferencia (el superávit) queda como el espacio entre los topes de cada par.
 */
export function GraficoIngresosGastos({ datos, indice = 0 }: GraficoIngresosGastosProps) {
  const tema = useChartTheme()

  const opciones = useMemo<OpcionesECharts>(() => {
    const categorias = datos.map((punto) => punto.etiqueta)

    return {
      tooltip: {
        ...tooltipBase(tema),
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: tooltipSeriesHtml,
      },
      grid: grillaBase(),
      xAxis: ejeCategoria(tema, categorias),
      yAxis: ejeMoneda(tema),
      series: [
        {
          name: 'Ingresos',
          type: 'bar',
          data: datos.map((punto) => punto.ingresos),
          itemStyle: { color: tema.ingresos, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 22,
          // Separación negativa: acerca las dos barras del mismo mes para que
          // se lean como un par, y deja el aire entre meses.
          barGap: '12%',
          animationDelay: (indiceDato: number) => indiceDato * 40,
        },
        {
          name: 'Gastos',
          type: 'bar',
          data: datos.map((punto) => punto.gastos),
          itemStyle: { color: tema.gastos, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 22,
          animationDelay: (indiceDato: number) => indiceDato * 40 + 20,
        },
      ],
      animationEasing: 'cubicOut',
      animationDuration: 600,
    }
  }, [datos, tema])

  const totalIngresos = datos.reduce((suma, punto) => suma + punto.ingresos, 0)
  const totalGastos = datos.reduce((suma, punto) => suma + punto.gastos, 0)

  return (
    <ChartCard
      titulo="Ingresos vs Gastos"
      subtitulo="Últimos 6 meses"
      indice={indice}
      accesorio={
        <LeyendaGrafico
          items={[
            { etiqueta: 'Ingresos', color: tema.ingresos },
            { etiqueta: 'Gastos', color: tema.gastos },
          ]}
        />
      }
    >
      <EChart
        opciones={opciones}
        alto={264}
        descripcionAccesible={`Gráfico de barras comparando ingresos y gastos de los últimos 6 meses. Ingresos acumulados ${formatearMoneda(totalIngresos)}, gastos acumulados ${formatearMoneda(totalGastos)}.`}
      />
    </ChartCard>
  )
}
