import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable, type ColumnaTabla } from '@/components/tables/data-table'
import { SectionHeader } from '@/components/dashboard/section-header'
import { formatearFecha, formatearMoneda } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { EstadoTransaccion, Transaccion } from '@/types'

/** Variante del badge por estado. Tabla completa para que Tailwind vea las
 *  clases y para que agregar un estado nuevo rompa la compilación. */
const VARIANTE_ESTADO: Record<
  EstadoTransaccion,
  { variante: 'positive' | 'caution' | 'neutral'; etiqueta: string }
> = {
  conciliado: { variante: 'positive', etiqueta: 'Conciliado' },
  pendiente: { variante: 'caution', etiqueta: 'Pendiente' },
  anulado: { variante: 'neutral', etiqueta: 'Anulado' },
}

export interface TablaTransaccionesProps {
  transacciones: Transaccion[]
  cargando?: boolean
}

/**
 * Movimientos recientes del período.
 *
 * El monto lleva signo y color según sea ingreso o gasto: en un libro de
 * movimientos mezclados, distinguir la dirección del dinero es lo primero que
 * busca el ojo, y hacerlo con una columna "tipo" aparte obligaría a cruzar dos
 * columnas para leer un solo dato.
 */
export function TablaTransacciones({ transacciones, cargando = false }: TablaTransaccionesProps) {
  const columnas: ColumnaTabla<Transaccion>[] = [
    {
      id: 'fecha',
      encabezado: 'Fecha',
      ancho: '110px',
      celda: (fila) => (
        <span className="whitespace-nowrap text-caption text-foreground-muted tabular">
          {formatearFecha(fila.fecha)}
        </span>
      ),
    },
    {
      id: 'descripcion',
      encabezado: 'Descripción',
      celda: (fila) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{fila.descripcion}</p>
          <p className="truncate text-caption text-foreground-muted">{fila.contraparte}</p>
        </div>
      ),
    },
    {
      id: 'categoria',
      encabezado: 'Categoría',
      ocultarHasta: 'lg',
      celda: (fila) => <span className="text-caption">{fila.categoria}</span>,
    },
    {
      id: 'referencia',
      encabezado: 'Referencia',
      ocultarHasta: 'lg',
      celda: (fila) => (
        <span className="text-caption text-foreground-muted tabular">{fila.referencia}</span>
      ),
    },
    {
      id: 'estado',
      encabezado: 'Estado',
      ocultarHasta: 'md',
      celda: (fila) => {
        const estado = VARIANTE_ESTADO[fila.estado]
        return <Badge variant={estado.variante}>{estado.etiqueta}</Badge>
      },
    },
    {
      id: 'monto',
      encabezado: 'Monto',
      alineacion: 'derecha',
      ancho: '130px',
      celda: (fila) => (
        <span
          className={cn(
            'whitespace-nowrap text-metric-sm tabular',
            fila.tipo === 'ingreso' ? 'text-positive' : 'text-foreground',
          )}
        >
          {fila.tipo === 'ingreso' ? '+' : '−'}
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
          titulo="Movimientos Recientes"
          descripcion="Últimos registros contabilizados del período"
        />
      </div>
      <div className="px-2 pb-3">
        <DataTable
          etiqueta="Movimientos recientes del período"
          columnas={columnas}
          filas={transacciones}
          claveFila={(fila) => fila.id}
          cargando={cargando}
          filasSkeleton={6}
          mensajeVacio="Sin movimientos registrados"
          descripcionVacio="No hay transacciones contabilizadas en el período seleccionado."
        />
      </div>
    </Card>
  )
}
