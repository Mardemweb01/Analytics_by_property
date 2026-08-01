import { TrendIndicator } from '@/components/dashboard/trend-indicator'
import { CLASES_BADGE_INTENCION } from '@/constants/kpi'
import { formatearVariacion } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Comparacion } from '@/types'

export interface ComparisonBadgeProps {
  comparacion: Comparacion
  /** Oculta el "vs. Abr 2026" cuando el período ya está claro por contexto
   *  (p. ej. dentro de una tabla que ya lo declara en su encabezado). */
  mostrarPeriodo?: boolean
  className?: string
}

/**
 * Variación respecto del período anterior: "↑ 8.7% vs. Abr 2026".
 *
 * Sin fondo ni borde, a diferencia de `Badge`. Con nueve KPI cards en pantalla,
 * nueve pastillas de color competirían con los valores, que son lo que el
 * lector vino a ver. La flecha y el color ya diferencian lo suficiente.
 */
export function ComparisonBadge({
  comparacion,
  mostrarPeriodo = true,
  className,
}: ComparisonBadgeProps) {
  const { variacionPorcentual, periodoComparado, direccion, intencion } = comparacion
  const variacionFormateada = formatearVariacion(variacionPorcentual)

  return (
    <p className={cn('flex items-center gap-1 text-caption', className)}>
      <TrendIndicator direccion={direccion} intencion={intencion} />
      <span className={cn('font-semibold tabular', CLASES_BADGE_INTENCION[intencion])}>
        {variacionFormateada}
      </span>
      {mostrarPeriodo && (
        <span className="text-foreground-muted">
          vs. <span className="whitespace-nowrap">{periodoComparado}</span>
        </span>
      )}
    </p>
  )
}
