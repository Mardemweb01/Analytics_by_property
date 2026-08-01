import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * Tooltip sobre Radix: nos da el manejo de foco, el `aria-describedby` y el
 * cierre con Escape sin escribirlos a mano.
 *
 * `delayDuration={200}`: instantáneo se siente nervioso al barrer la pantalla
 * con el mouse; por encima de ~400ms el usuario ya se fue.
 */
export function TooltipProvider({
  delayDuration = 200,
  skipDelayDuration = 300,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  )
}

export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-[70] max-w-72 rounded-lg px-2.5 py-1.5',
          'bg-[var(--chart-tooltip-bg)] text-[var(--chart-tooltip-fg)]',
          'text-caption shadow-lg',
          // Animaciones de entrada/salida provistas por tw-animate-css,
          // dirigidas por los data-attributes que expone Radix.
          'animate-in fade-in-0 zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
          'data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}
