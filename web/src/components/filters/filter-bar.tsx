import { Building2, Download, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface OpcionFiltro {
  valor: string
  etiqueta: string
}

export interface FilterBarProps {
  propiedades: OpcionFiltro[]
  propiedadId: string
  alCambiarPropiedad: (valor: string) => void

  edificios: OpcionFiltro[]
  edificioId: string | null
  alCambiarEdificio: (valor: string | null) => void

  periodos: OpcionFiltro[]
  periodoId: string
  alCambiarPeriodo: (valor: string) => void

  comparacionId: string
  alCambiarComparacion: (valor: string) => void

  alRefrescar?: () => void
  refrescando?: boolean
  alExportar?: () => void

  className?: string
}

/** Valor centinela para "todos los edificios". Radix Select no admite `value=""`
 *  (lo reserva para limpiar la selección), así que hace falta un token propio. */
const TODOS_LOS_EDIFICIOS = '__todos__'

/**
 * Barra de filtros del dashboard.
 *
 * Presentacional pura: recibe opciones y callbacks, no conoce TanStack Query
 * ni la forma del dominio. Eso permite reusarla en las páginas de Gastos o
 * Morosidad sin arrastrar la lógica del resumen.
 */
export function FilterBar({
  propiedades,
  propiedadId,
  alCambiarPropiedad,
  edificios,
  edificioId,
  alCambiarEdificio,
  periodos,
  periodoId,
  alCambiarPeriodo,
  comparacionId,
  alCambiarComparacion,
  alRefrescar,
  refrescando = false,
  alExportar,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <CampoFiltro etiqueta="Propiedad" className="min-w-[190px] flex-1 sm:flex-none">
        <Select value={propiedadId} onValueChange={alCambiarPropiedad}>
          <SelectTrigger aria-label="Seleccionar propiedad">
            <div className="flex min-w-0 items-center gap-2">
              <Building2 className="size-4 shrink-0 text-foreground-muted" aria-hidden />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {propiedades.map((opcion) => (
              <SelectItem key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CampoFiltro>

      <CampoFiltro etiqueta="Edificio" className="min-w-[150px] flex-1 sm:flex-none">
        <Select
          value={edificioId ?? TODOS_LOS_EDIFICIOS}
          onValueChange={(valor) =>
            alCambiarEdificio(valor === TODOS_LOS_EDIFICIOS ? null : valor)
          }
        >
          <SelectTrigger aria-label="Seleccionar edificio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS_LOS_EDIFICIOS}>Todos</SelectItem>
            {edificios.map((opcion) => (
              <SelectItem key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CampoFiltro>

      <CampoFiltro etiqueta="Período" className="min-w-[160px] flex-1 sm:flex-none">
        <Select value={periodoId} onValueChange={alCambiarPeriodo}>
          <SelectTrigger aria-label="Seleccionar período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodos.map((opcion) => (
              <SelectItem key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CampoFiltro>

      <CampoFiltro etiqueta="Comparar con" className="min-w-[160px] flex-1 sm:flex-none">
        <Select value={comparacionId} onValueChange={alCambiarComparacion}>
          <SelectTrigger aria-label="Seleccionar período de comparación">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodos
              // No tiene sentido comparar un período consigo mismo.
              .filter((opcion) => opcion.valor !== periodoId)
              .map((opcion) => (
                <SelectItem key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </CampoFiltro>

      <div className="flex items-center gap-2">
        {alRefrescar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                onClick={alRefrescar}
                disabled={refrescando}
                aria-label="Actualizar datos"
              >
                <RefreshCw className={cn(refrescando && 'animate-spin')} aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Actualizar datos</TooltipContent>
          </Tooltip>
        )}

        {alExportar && (
          <Button variant="primary" onClick={alExportar} iconoIzquierda={<Download aria-hidden />}>
            Exportar
          </Button>
        )}
      </div>
    </div>
  )
}

/** Campo con etiqueta encima, como en la referencia. `<label>` real para que
 *  el texto sea clickeable y quede asociado al control. */
function CampoFiltro({
  etiqueta,
  children,
  className,
}: {
  etiqueta: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-caption font-medium text-foreground-secondary">{etiqueta}</span>
      {children}
    </div>
  )
}
