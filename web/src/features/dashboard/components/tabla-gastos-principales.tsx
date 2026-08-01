import { SectionHeader } from '@/components/dashboard/section-header'
import { ComparisonBadge } from '@/components/dashboard/comparison-badge'
import { DataTable, type ColumnaTabla } from '@/components/tables/data-table'
import { Card } from '@/components/ui/card'
import { formatearMoneda, formatearPorcentaje } from '@/lib/format'
import type { GastoPrincipal } from '@/types'

export interface TablaGastosPrincipalesProps {
  gastos: GastoPrincipal[]
  cargando?: boolean
}

/**
 * Principales gastos del período por proveedor.
 *
 * La columna de participación usa una barra de progreso además del número: el
 * peso relativo se compara mucho más rápido entre barras que entre porcentajes,
 * y el número queda para quien necesita el valor exacto.
 */
export function TablaGastosPrincipales({ gastos, cargando = false }: TablaGastosPrincipalesProps) {
  const columnas: ColumnaTabla<GastoPrincipal>[] = [
    {
      id: 'proveedor',
      encabezado: 'Proveedor',
      celda: (fila) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{fila.proveedor}</p>
          <p className="truncate text-caption text-foreground-muted">{fila.categoria}</p>
        </div>
      ),
    },
    {
      id: 'participacion',
      encabezado: 'Participación',
      ocultarHasta: 'md',
      ancho: '160px',
      celda: (fila) => (
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken"
            role="img"
            aria-label={`${formatearPorcentaje(fila.porcentajeDelTotal, 1)} del gasto total`}
          >
            <div
              className="h-full rounded-full bg-informative transition-[width] duration-500 ease-out"
              style={{ width: `${Math.min(100, fila.porcentajeDelTotal)}%` }}
            />
          </div>
          <span className="w-11 shrink-0 text-right text-caption text-foreground-muted tabular">
            {formatearPorcentaje(fila.porcentajeDelTotal, 1)}
          </span>
        </div>
      ),
    },
    {
      id: 'variacion',
      encabezado: 'vs. mes anterior',
      ocultarHasta: 'lg',
      ancho: '120px',
      celda: (fila) =>
        fila.variacionPorcentual === 0 ? (
          <span className="text-caption text-foreground-muted">Sin cambios</span>
        ) : (
          <ComparisonBadge
            mostrarPeriodo={false}
            comparacion={{
              variacionPorcentual: fila.variacionPorcentual,
              periodoComparado: '',
              direccion: fila.variacionPorcentual > 0 ? 'up' : 'down',
              // Un gasto que sube es mala noticia: la intención se invierte
              // respecto de la dirección.
              intencion: fila.variacionPorcentual > 0 ? 'negative' : 'positive',
            }}
          />
        ),
    },
    {
      id: 'monto',
      encabezado: 'Monto',
      alineacion: 'derecha',
      ancho: '120px',
      celda: (fila) => (
        <span className="whitespace-nowrap text-metric-sm text-foreground tabular">
          {formatearMoneda(fila.monto)}
        </span>
      ),
    },
  ]

  return (
    <Card className="flex flex-col">
      <div className="p-5 pb-2">
        <SectionHeader
          nivel="h3"
          titulo="Principales Gastos"
          descripcion="Proveedores con mayor peso en el gasto del mes"
        />
      </div>
      <div className="px-2 pb-3">
        <DataTable
          etiqueta="Principales gastos por proveedor"
          columnas={columnas}
          filas={gastos}
          claveFila={(fila) => fila.id}
          cargando={cargando}
          mensajeVacio="Sin gastos registrados"
        />
      </div>
    </Card>
  )
}
