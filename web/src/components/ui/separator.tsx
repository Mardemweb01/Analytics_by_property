import * as SeparatorPrimitive from '@radix-ui/react-separator'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * Separador. Por defecto `decorative`, que le pone `role="none"`: una línea
 * que solo agrupa visualmente no debe anunciarse como separador semántico a un
 * lector de pantalla. Pasar `decorative={false}` cuando sí divide secciones
 * con significado.
 */
export function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
}
