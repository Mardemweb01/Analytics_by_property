import { RefreshCw, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Los opcionales se declaran `?: T | undefined` explícitamente porque el
 * proyecto compila con `exactOptionalPropertyTypes`. Sin el `| undefined`, esa
 * regla prohíbe pasar una variable que PODRÍA ser undefined (distingue entre
 * "prop ausente" y "prop presente con valor undefined"), y en JSX pasar un
 * valor opcional a una prop opcional es el caso normal.
 */
export interface ErrorCardProps {
  titulo?: string | undefined
  /** Mensaje para el usuario. Nunca el `error.message` crudo: un stack o un
   *  "Failed to fetch" no le dice nada a un administrador de PH. El detalle
   *  técnico va en `detalleTecnico`, plegado. */
  descripcion?: string | undefined
  detalleTecnico?: string | undefined
  alReintentar?: (() => void) | undefined
  reintentando?: boolean | undefined
  className?: string | undefined
}

/**
 * Estado de error de un bloque del dashboard.
 *
 * Contenido, no de pantalla completa: si falla un gráfico, el resto del
 * dashboard sigue siendo útil y no tiene sentido tumbar la vista entera.
 */
export function ErrorCard({
  titulo = 'No se pudieron cargar los datos',
  descripcion = 'Hubo un problema al consultar la información financiera. Podés reintentar en unos segundos.',
  detalleTecnico,
  alReintentar,
  reintentando = false,
  className,
}: ErrorCardProps) {
  return (
    <Card className={cn('h-full', className)}>
      <div
        className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
        role="alert"
      >
        <div
          className="flex size-11 items-center justify-center rounded-full bg-negative-subtle text-negative ring-1 ring-negative-border"
          aria-hidden
        >
          <TriangleAlert className="size-5" />
        </div>

        <div className="flex max-w-sm flex-col gap-1">
          <p className="text-h4 text-foreground">{titulo}</p>
          <p className="text-body text-foreground-muted">{descripcion}</p>
        </div>

        {alReintentar && (
          <Button
            variant="secondary"
            onClick={alReintentar}
            cargando={reintentando}
            iconoIzquierda={<RefreshCw aria-hidden />}
            className="mt-1"
          >
            Reintentar
          </Button>
        )}

        {detalleTecnico && (
          <details className="mt-2 w-full max-w-md text-left">
            <summary className="cursor-pointer text-caption text-foreground-subtle hover:text-foreground-muted">
              Detalle técnico
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-surface-sunken p-3 text-caption text-foreground-muted">
              {detalleTecnico}
            </pre>
          </details>
        )}
      </div>
    </Card>
  )
}
