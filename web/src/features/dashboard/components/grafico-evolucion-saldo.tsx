import { useMemo } from 'react'

import { ChartCard } from '@/components/charts/chart-card'
import { EChart, type OpcionesECharts } from '@/components/charts/echart'
import { ComparisonBadge } from '@/components/dashboard/comparison-badge'
import { useChartTheme } from '@/hooks/use-chart-theme'
import {
  ejeCategoria,
  ejeMoneda,
  grillaBase,
  tooltipBase,
  tooltipSeriesHtml,
} from '@/lib/chart-options'
import { formatearMoneda } from '@/lib/format'
import type { Comparacion, PuntoMensual } from '@/types'

export interface GraficoEvolucionSaldoProps {
  datos: PuntoMensual[]
  comparacion?: Comparacion
  indice?: number
}

/**
 * Evolución del saldo bancario.
 *
 * Diferencias deliberadas con la maqueta original, que etiquetaba los seis
 * puntos con su valor:
 *
 *   - Solo se etiqueta el último punto. Seis etiquetas encima de la línea
 *     compiten con la propia línea y obligan a leer números cuando el gráfico
 *     existe para mostrar una FORMA. El resto de los valores quedan en el
 *     tooltip, a un hover de distancia.
 *   - Se agrega un degradado bajo la curva: da peso visual a la tendencia
 *     ascendente sin agregar tinta fuerte.
 */
export function GraficoEvolucionSaldo({ datos, comparacion, indice = 0 }: GraficoEvolucionSaldoProps) {
  const tema = useChartTheme()

  const opciones = useMemo<OpcionesECharts>(() => {
    const categorias = datos.map((punto) => punto.etiqueta)
    const valores = datos.map((punto) => punto.valor)
    const ultimoIndice = valores.length - 1

    return {
      tooltip: {
        ...tooltipBase(tema),
        trigger: 'axis',
        formatter: tooltipSeriesHtml,
      },
      grid: grillaBase({ right: 56 }),
      xAxis: ejeCategoria(tema, categorias),
      yAxis: {
        ...ejeMoneda(tema),
        // La escala no arranca en cero: el saldo oscila entre 105K y 143K, y
        // anclar en cero comprimiría toda la variación en la franja superior
        // del gráfico. Es legítimo porque la card mide EVOLUCIÓN, no magnitud
        // absoluta — y el eje muestra sus valores, así que no engaña.
        scale: true,
      },
      series: [
        {
          name: 'Saldo',
          type: 'line',
          data: valores,
          smooth: 0.35,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 2.5, color: tema.series[0] },
          itemStyle: {
            color: tema.series[0],
            borderColor: tema.superficie,
            borderWidth: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${tema.series[0]}2E` },
                { offset: 1, color: `${tema.series[0]}00` },
              ],
            },
          },
          label: {
            show: true,
            // Solo el punto final lleva etiqueta.
            formatter: (parametros: { dataIndex: number; value: number }) =>
              parametros.dataIndex === ultimoIndice
                ? formatearMoneda(parametros.value)
                : '',
            position: 'top',
            distance: 10,
            color: tema.texto,
            fontFamily: tema.fuente,
            fontSize: 12,
            fontWeight: 600,
          },
          emphasis: { focus: 'series', scale: 1.4 },
        },
      ],
      animationEasing: 'cubicOut',
      animationDuration: 800,
    }
  }, [datos, tema])

  const ultimo = datos[datos.length - 1]

  return (
    <ChartCard
      titulo="Evolución del Saldo Bancario"
      subtitulo="Últimos 6 meses"
      indice={indice}
      accesorio={comparacion ? <ComparisonBadge comparacion={comparacion} /> : undefined}
    >
      <EChart
        opciones={opciones}
        alto={264}
        descripcionAccesible={`Gráfico de línea de la evolución del saldo bancario en los últimos 6 meses, desde ${formatearMoneda(datos[0]?.valor ?? 0)} hasta ${formatearMoneda(ultimo?.valor ?? 0)}.`}
      />
    </ChartCard>
  )
}
