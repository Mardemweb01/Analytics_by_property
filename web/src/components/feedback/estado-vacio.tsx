import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface EstadoVacioProps {
  icono: LucideIcon
  titulo: string
  descripcion?: string
  /** Acción sugerida (típicamente un `<Button>`). Un estado vacío sin salida
   *  deja al usuario sin saber qué hacer. */
  accion?: ReactNode
  className?: string
}

/**
 * Estado vacío reutilizable: sin datos, sin resultados de filtro, sección no
 * implementada. Uno solo para todos los casos mantiene el tono consistente en
 * lugar de tener cinco mensajes escritos por cinco manos distintas.
 */
export function EstadoVacio({
  icono: Icono,
  titulo,
  descripcion,
  accion,
  className,
}: EstadoVacioProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <div
        className="flex size-11 items-center justify-center rounded-full bg-surface-sunken text-foreground-subtle ring-1 ring-border"
        aria-hidden
      >
        <Icono className="size-5" />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-h4 text-foreground">{titulo}</p>
        {descripcion && <p className="text-body text-foreground-muted">{descripcion}</p>}
      </div>
      {accion && <div className="pt-1">{accion}</div>}
    </div>
  )
}
