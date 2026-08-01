import { motion } from 'motion/react'

import { Sparkline } from '@/components/charts/sparkline'
import { ComparisonBadge } from '@/components/dashboard/comparison-badge'
import { Card } from '@/components/ui/card'
import { CLASES_ICONO_INTENCION, CLASES_VALOR_INTENCION, ICONO_KPI } from '@/constants/kpi'
import { useContadorAnimado } from '@/hooks/use-contador-animado'
import { formatearMoneda, formatearNumero, formatearPorcentaje } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MetricaKPI } from '@/types'

export interface MetricCardProps {
  metrica: MetricaKPI
  /** Posición en la grilla. Define el retraso de entrada para que las cards
   *  aparezcan en cascada de izquierda a derecha. */
  indice?: number
  className?: string
}

/**
 * Tarjeta de KPI: icono, título, valor, comparación y sparkline.
 *
 * Es el componente más repetido de la pantalla (nueve instancias), así que
 * cualquier detalle mal resuelto acá se multiplica por nueve. De ahí que el
 * formato, el color y el icono vengan todos de tablas centralizadas en vez de
 * decidirse dentro del componente.
 */
export function MetricCard({ metrica, indice = 0, className }: MetricCardProps) {
  const { id, titulo, valor, formato, intencion, decimales, comparacion, serie, nota } = metrica

  const Icono = ICONO_KPI[id]
  const valorAnimado = useContadorAnimado(valor, { retraso: indice * 0.05 })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: indice * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      <Card interactiva className="group h-full">
        <div className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-body font-medium text-foreground-secondary">{titulo}</p>
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full ring-1',
                'transition-transform duration-200 ease-out group-hover:scale-105',
                CLASES_ICONO_INTENCION[intencion],
              )}
              aria-hidden
            >
              <Icono className="size-4.5" strokeWidth={2} />
            </span>
          </div>

          <p
            className={cn(
              'text-metric-xl tabular tracking-tight',
              CLASES_VALOR_INTENCION[intencion],
            )}
          >
            {formatearValor(valorAnimado, formato, decimales)}
          </p>

          <div className="mt-auto flex items-end justify-between gap-3">
            {comparacion ? (
              <ComparisonBadge comparacion={comparacion} />
            ) : nota ? (
              <p className="text-caption text-foreground-muted">{nota}</p>
            ) : (
              <span />
            )}

            {serie && serie.length > 1 && (
              <Sparkline
                valores={serie}
                intencion={comparacion?.intencion ?? intencion}
                ancho={72}
                alto={26}
                className="shrink-0 opacity-70 transition-opacity duration-200 group-hover:opacity-100"
              />
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

/** Aplica el formato declarado por la métrica. Vive fuera del componente para
 *  que no se recree en cada render. */
function formatearValor(
  valor: number,
  formato: MetricaKPI['formato'],
  decimales: number | undefined,
): string {
  switch (formato) {
    case 'moneda':
      return formatearMoneda(valor, { decimales: decimales ?? 0 })
    case 'porcentaje':
      return formatearPorcentaje(valor, decimales ?? 0)
    case 'numero':
      return formatearNumero(valor, decimales ?? 0)
  }
}
