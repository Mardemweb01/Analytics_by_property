import { SectionHeader } from '@/components/dashboard/section-header'
import { DataTable, type ColumnaTabla } from '@/components/tables/data-table'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatearFecha, formatearMoneda, formatearNumero } from '@/lib/format'
import type { CuentaMorosa } from '@/types'

/** Severidad según antigüedad. La escala está en un solo lugar para que la
 *  tabla, el gráfico de aging y cualquier alerta futura coincidan. */
function severidadPorDias(dias: number): { variante: 'caution' | 'negative' | 'neutral'; texto: string } {
  if (dias > 90) return { variante: 'negative', texto: `${dias} días` }
  if (dias > 30) return { variante: 'caution', texto: `${dias} días` }
  return { variante: 'neutral', texto: `${dias} días` }
}

export interface TablaMorosidadProps {
  cuentas: CuentaMorosa[]
  cargando?: boolean
}

/**
 * Cuentas por cobrar, ordenadas por antigüedad descendente.
 *
 * El orden lo define quien provee los datos, no este componente: cuál es la
 * cuenta "más urgente" es una regla de negocio (¿la más vieja? ¿la de mayor
 * monto?) y no una decisión de presentación.
 */
export function TablaMorosidad({ cuentas, cargando = false }: TablaMorosidadProps) {
  const columnas: ColumnaTabla<CuentaMorosa>[] = [
    {
      id: 'unidad',
      encabezado: 'Unidad',
      ancho: '150px',
      celda: (fila) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{fila.unidad}</p>
          <p className="truncate text-caption text-foreground-muted">{fila.propietario}</p>
        </div>
      ),
    },
    {
      id: 'antiguedad',
      encabezado: 'Antigüedad',
      ocultarHasta: 'sm',
      celda: (fila) => {
        const severidad = severidadPorDias(fila.diasVencido)
        return <Badge variant={severidad.variante}>{severidad.texto}</Badge>
      },
    },
    {
      id: 'ultimo-pago',
      encabezado: 'Último pago',
      ocultarHasta: 'lg',
      celda: (fila) => (
        <span className="whitespace-nowrap text-caption text-foreground-muted tabular">
          {fila.ultimoPago ? formatearFecha(fila.ultimoPago) : 'Sin registro'}
        </span>
      ),
    },
    {
      id: 'monto',
      encabezado: 'Saldo',
      alineacion: 'derecha',
      ancho: '120px',
      celda: (fila) => (
        <span className="whitespace-nowrap text-metric-sm text-foreground tabular">
          {formatearMoneda(fila.monto)}
        </span>
      ),
    },
  ]

  const total = cuentas.reduce((suma, cuenta) => suma + cuenta.monto, 0)

  return (
    <Card className="flex flex-col">
      <div className="p-5 pb-2">
        <SectionHeader
          nivel="h3"
          titulo="Cuentas por Cobrar"
          descripcion={`${formatearNumero(cuentas.length)} unidades · ${formatearMoneda(total)} pendiente`}
        />
      </div>
      <div className="px-2 pb-3">
        <DataTable
          etiqueta="Cuentas por cobrar por unidad"
          columnas={columnas}
          filas={cuentas}
          claveFila={(fila) => fila.id}
          cargando={cargando}
          mensajeVacio="Sin morosidad"
          descripcionVacio="Todas las unidades están al día con sus cuotas."
        />
      </div>
    </Card>
  )
}
