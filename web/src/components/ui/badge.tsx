import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * Etiqueta compacta para estados discretos: 'Conciliado', 'Vencido',
 * 'Pendiente'. Usa fondo tintado + texto del mismo matiz (no color sólido),
 * que es lo que mantiene la densidad de una tabla sin que parezca un semáforo.
 */
const badgeVariants = cva(
  [
    'inline-flex items-center gap-1.5 whitespace-nowrap',
    'rounded-full border px-2 py-0.5',
    'text-caption font-medium',
    "[&_svg]:size-3 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        neutral: 'border-border bg-surface-sunken text-foreground-secondary',
        positive: 'border-positive-border bg-positive-subtle text-positive-foreground',
        negative: 'border-negative-border bg-negative-subtle text-negative-foreground',
        caution: 'border-caution-border bg-caution-subtle text-caution-foreground',
        informative: 'border-informative-border bg-informative-subtle text-informative-foreground',
        accent: 'border-accent-border bg-accent-subtle text-accent-foreground',
        primary: 'border-primary-border bg-primary-subtle text-primary',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
