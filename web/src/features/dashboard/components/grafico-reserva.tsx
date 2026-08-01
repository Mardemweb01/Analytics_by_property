import { useMemo } from 'react'

import { ChartCard } from '@/components/charts/chart-card'
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
import type { PuntoMensual } from '@/types'

export interface GraficoReservaProps {
  datos: PuntoMensual[]
  /** Gasto mensual promedio. Define la línea de referencia de "3 meses de
   *  reserva", el mínimo que suele exigir la normativa de PH. */
  gastoMensualPromedio?: number | undefined
  indice?: number
  className?: string | undefined
}

/**
 * Evolución del fondo de reserva, como área.
 *
 * Área y no línea: la reserva es un ACUMULADO, y el relleno comunica volumen
 * acumulado mejor que un trazo. La línea se reserva para el saldo bancario,
 * que fluctúa.
 *
 * La `markLine` del mínimo legal es lo que convierte el gráfico en un
 * indicador de cumplimiento: sin ella, el usuario ve una curva subiendo pero
 * no sabe si el nivel alcanza.
 */
export function GraficoReserva({
  datos,
  gastoMensualPromedio,
  indice = 0,
  className,
}: GraficoReservaProps) {
  const tema = useChartTheme()
  const minimoRecomendado = gastoMensualPromedio ? gastoMensualPromedio * 3 : null

  const opciones = useMemo<OpcionesECharts>(() => {
    const valores = datos.map((punto) => punto.valor)

    return {
      tooltip: {
        ...tooltipBase(tema),
        trigger: 'axis',
        formatter: tooltipSeriesHtml,
      },
      grid: grillaBase({ right: 24 }),
      xAxis: ejeCategoria(
        tema,
        datos.map((punto) => punto.etiqueta),
      ),
      yAxis: { ...ejeMoneda(tema), scale: true },
      series: [
        {
          name: 'Fondo de reserva',
          type: 'line',
          data: valores,
          smooth: 0.35,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5, color: tema.series[6] },
          itemStyle: {
            color: tema.series[6],
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
                { offset: 0, color: `${tema.series[6]}3D` },
                { offset: 1, color: `${tema.series[6]}00` },
              ],
            },
          },
          ...(minimoRecomendado
            ? {
                markLine: {
                  silent: true,
                  symbol: 'none',
                  lineStyle: { color: tema.textoTenue, type: 'dashed', width: 1.5 },
                  label: {
                    formatter: 'Mínimo recomendado',
                    position: 'insideStartTop',
                    color: tema.textoTenue,
                    fontFamily: tema.fuente,
                    fontSize: 11,
                  },
                  data: [{ yAxis: minimoRecomendado }],
                },
              }
            : {}),
        },
      ],
      animationEasing: 'cubicOut',
      animationDuration: 800,
    }
  }, [datos, tema, minimoRecomendado])

  const actual = datos[datos.length - 1]?.valor ?? 0
  const mesesCubiertos = gastoMensualPromedio ? actual / gastoMensualPromedio : null

  return (
    <ChartCard
      titulo="Evolución del Fondo de Reserva"
      subtitulo={
        mesesCubiertos !== null
          ? `Cubre ${mesesCubiertos.toFixed(1)} meses de gasto operativo`
          : 'Últimos 6 meses'
      }
      indice={indice}
      className={className}
    >
      <EChart
        opciones={opciones}
        alto={264}
        descripcionAccesible={`Gráfico de área de la evolución del fondo de reserva. Saldo actual ${formatearMoneda(actual)}.`}
      />
    </ChartCard>
  )
}
