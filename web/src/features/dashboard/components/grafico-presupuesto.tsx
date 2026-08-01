import { useMemo } from 'react'

import { ChartCard, LeyendaGrafico } from '@/components/charts/chart-card'
import { EChart, type OpcionesECharts } from '@/components/charts/echart'
import { useChartTheme } from '@/hooks/use-chart-theme'
import { ejeMoneda, grillaBase, tooltipBase, tooltipSeriesHtml } from '@/lib/chart-options'
import { formatearMoneda } from '@/lib/format'
import type { RubroPresupuesto } from '@/types'

export interface GraficoPresupuestoProps {
  datos: RubroPresupuesto[]
  indice?: number
}

/**
 * Presupuesto vs ejecutado por rubro.
 *
 * Barras HORIZONTALES: los nombres de rubro ("Mantenimiento",
 * "Administración") no entran bajo una barra vertical sin rotarse, y el texto
 * rotado es sistemáticamente más lento de leer. Con el eje invertido, cada
 * etiqueta se lee en horizontal.
 *
 * El presupuesto va en gris de fondo y el ejecutado en color encima: el
 * sobregiro se ve solo, cuando la barra de color desborda a la gris.
 */
export function GraficoPresupuesto({ datos, indice = 0 }: GraficoPresupuestoProps) {
  const tema = useChartTheme()

  const opciones = useMemo<OpcionesECharts>(() => {
    // ECharts dibuja el eje de categorías de abajo hacia arriba; invertimos
    // para que el primer rubro quede arriba, como se lee una lista.
    const rubros = [...datos].reverse()

    return {
      tooltip: {
        ...tooltipBase(tema),
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: tooltipSeriesHtml,
      },
      grid: grillaBase({ left: 8, right: 16 }),
      xAxis: ejeMoneda(tema),
      yAxis: {
        type: 'category',
        data: rubros.map((rubro) => rubro.nombre),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: tema.textoTenue,
          fontFamily: tema.fuente,
          fontSize: 12,
        },
      },
      series: [
        {
          name: 'Presupuestado',
          type: 'bar',
          data: rubros.map((rubro) => rubro.presupuestado),
          itemStyle: { color: tema.grilla, borderRadius: [0, 4, 4, 0] },
          barMaxWidth: 18,
          // `barGap: '-100%'` superpone esta serie con la siguiente en vez de
          // ponerlas lado a lado: así el ejecutado se dibuja DENTRO del
          // presupuesto y la comparación es inmediata.
          barGap: '-100%',
        },
        {
          name: 'Ejecutado',
          type: 'bar',
          data: rubros.map((rubro) => ({
            value: rubro.ejecutado,
            itemStyle: {
              // Sobregiro en rojo: el color hace el trabajo que si no exigiría
              // leer dos barras y restar.
              color: rubro.ejecucionPorcentual > 100 ? tema.gastos : tema.series[0],
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barMaxWidth: 18,
          animationDelay: (indiceDato: number) => indiceDato * 60,
        },
      ],
      animationEasing: 'cubicOut',
      animationDuration: 700,
    }
  }, [datos, tema])

  const sobregirados = datos.filter((rubro) => rubro.ejecucionPorcentual > 100).length

  return (
    <ChartCard
      titulo="Presupuesto vs Ejecutado"
      subtitulo={
        sobregirados > 0
          ? `${sobregirados} ${sobregirados === 1 ? 'rubro sobregirado' : 'rubros sobregirados'}`
          : 'Acumulado del año'
      }
      indice={indice}
      accesorio={
        <LeyendaGrafico
          items={[
            { etiqueta: 'Presupuestado', color: tema.grilla },
            { etiqueta: 'Ejecutado', color: tema.series[0] ?? '' },
          ]}
        />
      }
    >
      <EChart
        opciones={opciones}
        alto={264}
        descripcionAccesible={`Gráfico de barras comparando presupuesto y ejecución por rubro. ${
          sobregirados > 0 ? `${sobregirados} rubros superan lo presupuestado.` : 'Ningún rubro supera lo presupuestado.'
        } Total ejecutado ${formatearMoneda(datos.reduce((suma, rubro) => suma + rubro.ejecutado, 0))}.`}
      />
    </ChartCard>
  )
}
