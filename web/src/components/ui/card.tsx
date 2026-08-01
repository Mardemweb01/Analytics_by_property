import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * Card base del sistema. Todo bloque de contenido del dashboard se apoya acá:
 * KPIs, gráficos y tablas comparten borde, radio y elevación desde este único
 * lugar, así que ajustar el look de las cards es un cambio de un archivo.
 *
 * La jerarquía visual se apoya en el borde + una sombra muy suave, no en un
 * salto de color contra el fondo. Es lo que hace que la pantalla se vea
 * tranquila incluso con 15 cards simultáneas.
 */
const cardVariants = cva(
  ['rounded-card border bg-surface', 'transition-all duration-200 ease-out'],
  {
    variants: {
      elevacion: {
        plana: 'border-border shadow-none',
        baja: 'border-border shadow-xs',
        media: 'border-border shadow-sm',
      },
      interactiva: {
        // Elevación en hover: la card sube 1px y gana sombra. Sutil a
        // propósito — el brief pide microinteracción, no un salto.
        true: 'hover:-translate-y-px hover:shadow-md hover:border-border-strong',
        false: '',
      },
      enfasis: {
        ninguno: '',
        // Para la card de salud financiera: fondo tintado según estado.
        positivo: 'border-positive-border bg-positive-subtle',
        precaucion: 'border-caution-border bg-caution-subtle',
        negativo: 'border-negative-border bg-negative-subtle',
      },
    },
    defaultVariants: {
      elevacion: 'baja',
      interactiva: false,
      enfasis: 'ninguno',
    },
  },
)

export interface CardProps extends ComponentProps<'div'>, VariantProps<typeof cardVariants> {}

export function Card({ className, elevacion, interactiva, enfasis, ...props }: CardProps) {
  return (
    <div
      className={cn(cardVariants({ elevacion, interactiva, enfasis }), className)}
      {...props}
    />
  )
}

/** Encabezado de la card. `pb-0` porque el espaciado inferior lo aporta el
 *  `CardContent`; duplicarlo generaría el doble de aire del previsto. */
export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-0', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('text-h4 text-foreground', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-caption text-foreground-muted', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-2 border-t border-border-subtle px-5 py-3', className)}
      {...props}
    />
  )
}

export { cardVariants }
