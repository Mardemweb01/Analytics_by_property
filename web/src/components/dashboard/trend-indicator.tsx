import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

import { CLASES_BADGE_INTENCION } from '@/constants/kpi'
import { cn } from '@/lib/utils'
import type { DireccionTendencia, IntencionSemantica } from '@/types'

const ICONO_DIRECCION = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
} as const

export interface TrendIndicatorProps {
  direccion: DireccionTendencia
  /** Color de la flecha. Se pasa aparte de la dirección porque el significado
   *  no es el movimiento: en "Gastos del Mes" una flecha hacia abajo es
   *  `positive`, y en "Ingresos" la misma flecha es `negative`. */
  intencion: IntencionSemantica
  className?: string
}

/**
 * Flecha de dirección. Componente propio (en vez de un icono suelto dentro del
 * badge) porque la dirección también se usa en tablas y en encabezados de
 * gráfico, y la regla dirección/intención tiene que ser una sola.
 */
export function TrendIndicator({ direccion, intencion, className }: TrendIndicatorProps) {
  const Icono = ICONO_DIRECCION[direccion]

  return (
    <Icono
      className={cn('size-3.5 shrink-0', CLASES_BADGE_INTENCION[intencion], className)}
      strokeWidth={2.5}
      aria-hidden
    />
  )
}
