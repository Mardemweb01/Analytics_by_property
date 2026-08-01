import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

import { EstadoVacio } from '@/components/feedback/estado-vacio'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Definición de una columna. `T` es la forma de la fila. */
export interface ColumnaTabla<T> {
  id: string
  encabezado: string
  /** Render de la celda. Recibe la fila completa, no solo un campo: muchas
   *  celdas combinan varios (monto + variación, unidad + propietario). */
  celda: (fila: T) => ReactNode
  /** Alineación. Los importes van a la derecha SIEMPRE: alinear números por
   *  la derecha es lo que permite comparar magnitudes de un vistazo. */
  alineacion?: 'izquierda' | 'derecha' | 'centro'
  /** Oculta la columna por debajo del breakpoint indicado, para que la tabla
   *  degrade en pantallas angostas sin scroll horizontal. */
  ocultarHasta?: 'sm' | 'md' | 'lg'
  ancho?: string
}

export interface DataTableProps<T> {
  columnas: ColumnaTabla<T>[]
  filas: T[]
  /** Clave estable por fila. Obligatoria: usar el índice rompe la
   *  reconciliación de React al reordenar o filtrar. */
  claveFila: (fila: T) => string
  cargando?: boolean
  filasSkeleton?: number
  mensajeVacio?: string
  descripcionVacio?: string
  /** Etiqueta accesible de la tabla. Requerida: una tabla sin nombre es
   *  indistinguible de otra en la lista de tablas de un lector de pantalla. */
  etiqueta: string
  className?: string
}

const CLASES_ALINEACION = {
  izquierda: 'text-left',
  derecha: 'text-right',
  centro: 'text-center',
} as const

const CLASES_OCULTAR = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const

/**
 * Tabla de datos genérica.
 *
 * Genérica sobre `T` y no sobre `Record<string, unknown>`: así el render de
 * cada celda recibe la fila con su tipo real y el compilador atrapa un campo
 * mal escrito en la definición de columnas, que es donde más se equivoca uno.
 *
 * Sin virtualización a propósito: estas tablas muestran los "top N" (5-10
 * filas). Virtualizar acá agregaría un observer y complejidad de scroll para
 * resolver un problema que no existe. Cuando alguna vista liste cientos de
 * movimientos, ahí sí corresponde.
 */
export function DataTable<T>({
  columnas,
  filas,
  claveFila,
  cargando = false,
  filasSkeleton = 5,
  mensajeVacio = 'Sin datos para este período',
  descripcionVacio,
  etiqueta,
  className,
}: DataTableProps<T>) {
  if (!cargando && filas.length === 0) {
    return (
      <EstadoVacio
        icono={Inbox}
        titulo={mensajeVacio}
        {...(descripcionVacio ? { descripcion: descripcionVacio } : {})}
        className="py-10"
      />
    )
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-body" aria-label={etiqueta}>
        <thead>
          <tr className="border-b border-border">
            {columnas.map((columna) => (
              <th
                key={columna.id}
                scope="col"
                style={columna.ancho ? { width: columna.ancho } : undefined}
                className={cn(
                  'px-3 py-2 text-overline font-semibold uppercase text-foreground-subtle',
                  CLASES_ALINEACION[columna.alineacion ?? 'izquierda'],
                  columna.ocultarHasta && CLASES_OCULTAR[columna.ocultarHasta],
                )}
              >
                {columna.encabezado}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {cargando
            ? Array.from({ length: filasSkeleton }, (_, indiceFila) => (
                <tr key={indiceFila} className="border-b border-border-subtle last:border-0">
                  {columnas.map((columna) => (
                    <td
                      key={columna.id}
                      className={cn(
                        'px-3 py-2.5',
                        columna.ocultarHasta && CLASES_OCULTAR[columna.ocultarHasta],
                      )}
                    >
                      <Skeleton
                        className={cn(
                          'h-4',
                          columna.alineacion === 'derecha' ? 'ml-auto w-16' : 'w-24',
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))
            : filas.map((fila) => (
                <tr
                  key={claveFila(fila)}
                  className={cn(
                    'border-b border-border-subtle last:border-0',
                    'transition-colors duration-150 hover:bg-surface-hover',
                  )}
                >
                  {columnas.map((columna) => (
                    <td
                      key={columna.id}
                      className={cn(
                        'px-3 py-2.5 text-foreground-secondary',
                        CLASES_ALINEACION[columna.alineacion ?? 'izquierda'],
                        columna.ocultarHasta && CLASES_OCULTAR[columna.ocultarHasta],
                      )}
                    >
                      {columna.celda(fila)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
