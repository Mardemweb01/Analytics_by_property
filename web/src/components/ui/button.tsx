import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Variantes del botón.
 *
 * `focus-visible` (y no `focus`) para que el anillo aparezca en navegación por
 * teclado pero no al clickear — es la diferencia entre accesible y molesto.
 * El `active:scale` es la microinteracción: 1% de compresión, suficiente para
 * que el click se sienta físico sin que parezca un juguete.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-medium select-none',
    'transition-[background-color,border-color,color,box-shadow,transform]',
    'duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.99]',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover active:bg-primary-active',
        secondary:
          'bg-surface text-foreground-secondary border border-border shadow-xs hover:bg-surface-hover hover:border-border-strong',
        ghost: 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground',
        subtle: 'bg-primary-subtle text-primary hover:bg-primary-subtle-hover',
        danger: 'bg-negative text-primary-foreground shadow-xs hover:bg-negative-strong',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-caption',
        md: 'h-9 rounded-control px-3.5 text-body',
        lg: 'h-10 rounded-control px-4 text-body',
        icon: 'size-9 rounded-control',
        'icon-sm': 'size-8 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  /** Renderiza el hijo como el elemento raíz (patrón `asChild` de Radix).
   *  Sirve para que un `<Link>` herede los estilos del botón sin anidar un
   *  `<button>` dentro de un `<a>`, que sería HTML inválido. */
  asChild?: boolean
  /** Muestra un spinner y deshabilita el botón. */
  cargando?: boolean
  iconoIzquierda?: ReactNode
  iconoDerecha?: ReactNode
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  cargando = false,
  iconoIzquierda,
  iconoDerecha,
  children,
  disabled,
  ...props
}: ButtonProps) {
  // `Slot` exige exactamente un hijo, así que en modo `asChild` delegamos el
  // contenido completo al consumidor y no inyectamos iconos ni spinner: quien
  // usa `asChild` está componiendo su propio interior (típicamente un `Link`).
  if (asChild) {
    return (
      <Slot className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot>
    )
  }

  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled ?? cargando}
      // Comunica el estado de carga a lectores de pantalla: sin esto el
      // usuario no vidente no sabe que la acción está en curso.
      aria-busy={cargando || undefined}
      {...props}
    >
      {cargando ? <LoaderCircle className="animate-spin" aria-hidden /> : iconoIzquierda}
      {children}
      {!cargando && iconoDerecha}
    </button>
  )
}

export { buttonVariants }
