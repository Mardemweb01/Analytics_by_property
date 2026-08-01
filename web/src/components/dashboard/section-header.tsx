import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface SectionHeaderProps {
  titulo: string
  descripcion?: string
  /** Acciones alineadas a la derecha (filtros, exportar, refrescar). */
  acciones?: ReactNode
  /** Nivel del encabezado. Por defecto `h2`: la página ya tiene su `h1`, y
   *  saltar niveles rompe la navegación por encabezados de un lector de
   *  pantalla. */
  nivel?: 'h1' | 'h2' | 'h3'
  className?: string
}

/**
 * Encabezado de sección con acciones opcionales. Unifica el ritmo vertical
 * entre bloques del dashboard y mantiene la jerarquía semántica explícita.
 */
export function SectionHeader({
  titulo,
  descripcion,
  acciones,
  nivel = 'h2',
  className,
}: SectionHeaderProps) {
  const Encabezado = nivel
  // El `h1` usa la escala `display`: es el título de la pantalla y en la
  // referencia domina claramente sobre el resto. Los `h2`/`h3` son
  // subdivisiones internas y no deben competir con él.
  const clasesTitulo = {
    h1: 'text-display',
    h2: 'text-h2',
    h3: 'text-h3',
  }[nivel]

  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <Encabezado className={cn(clasesTitulo, 'text-foreground')}>{titulo}</Encabezado>
        {descripcion && <p className="mt-1 text-body text-foreground-muted">{descripcion}</p>}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  )
}
