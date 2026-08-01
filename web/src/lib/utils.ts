import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Nombres de nuestra escala tipográfica (`--text-*` en theme.css).
 *
 * tailwind-merge tiene que saber que estas clases son TAMAÑOS DE FUENTE. Sin
 * esta declaración, ante `cn('text-display', 'text-foreground')` no puede
 * distinguir un tamaño de un color —ambas son clases propias, no de Tailwind—,
 * asume que compiten por la misma propiedad y descarta la primera.
 *
 * El síntoma es silencioso y caro: no hay error, no hay warning; simplemente
 * cada título del sistema pierde su tamaño y hereda los 14px del body.
 */
const TAMANOS_TEXTO = [
  'display',
  'h1',
  'h2',
  'h3',
  'h4',
  'body-lg',
  'body',
  'body-sm',
  'caption',
  'overline',
  'metric-xl',
  'metric-lg',
  'metric',
  'metric-sm',
] as const

/** Radios propios (`--radius-card`, `--radius-control`). Mismo problema que
 *  arriba: sin declararlos, `cn('rounded-card', 'rounded-lg')` no deduplica. */
const RADIOS = ['card', 'control'] as const

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...TAMANOS_TEXTO] }],
      rounded: [{ rounded: [...RADIOS] }],
    },
  },
})

/**
 * Combina clases condicionales (clsx) y resuelve conflictos de Tailwind
 * (tailwind-merge). El orden importa: sin `twMerge`, un `className` que llega
 * por props no puede sobrescribir la clase por defecto del componente porque
 * ambas quedarían en el HTML y ganaría la que CSS decida, no la que pasó quien
 * usa el componente.
 *
 * @example cn('px-4 py-2', isActive && 'bg-primary', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
