import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * Placeholder de carga. El barrido (`animate-shimmer`) comunica "esto está en
 * camino" mucho mejor que un bloque gris estático, que se lee como un error de
 * render.
 *
 * `aria-hidden` + `role="presentation"`: el skeleton no aporta nada a un lector
 * de pantalla. El estado de carga se anuncia una sola vez desde el contenedor
 * con `aria-busy`, no una vez por cada barrita.
 */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn('skeleton animate-shimmer rounded-md', className)}
      {...props}
    />
  )
}
