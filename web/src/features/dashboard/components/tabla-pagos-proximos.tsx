import { SectionHeader } from '@/components/dashboard/section-header'
import { DataTable, type ColumnaTabla } from '@/components/tables/data-table'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatearFecha, formatearMoneda } from '@/lib/format'
import type { EstadoPago, PagoProximo } from '@/types'

const VARIANTE_PAGO: Record<
  EstadoPago,
  { variante: 'neutral' | 'caution' | 'negative'; etiqueta: string }
> = {
  programado: { variante: 'neutral', etiqueta: 'Programado' },
  'por-vencer': { variante: 'caution', etiqueta: 'Por vencer' },
  vencido: { variante: 'negative', etiqueta: 'Vencido' },
}

/** Texto humano del plazo. Se calcula acá y no en el mock porque es
 *  presentación pura: el dato es `diasRestantes`, esto es cómo se lee. */
function textoPlazo(dias: number): string {
  if (dias < 0) return `Venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `En ${dias} días`
}

export interface TablaPagosProximosProps {
  pagos: PagoProximo[]
  cargando?: boolean
}

/** Compromisos de pago por vencer. Los vencidos primero, que es el orden en
 *  que hay que actuar sobre ellos. */
export function TablaPagosProximos({ pagos, cargando = false }: TablaPagosProximosProps) {
  const columnas: ColumnaTabla<PagoProximo>[] = [
    {
      id: 'concepto',
      encabezado: 'Concepto',
      celda: (fila) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{fila.concepto}</p>
          <p className="truncate text-caption text-foreground-muted">{fila.proveedor}</p>
        </div>
      ),
    },
    {
      id: 'vencimiento',
      encabezado: 'Vencimiento',
      ocultarHasta: 'md',
      ancho: '150px',
      celda: (fila) => (
        <div>
          <p className="whitespace-nowrap text-caption text-foreground-secondary tabular">
            {formatearFecha(fila.fechaVencimiento)}
          </p>
          <p className="whitespace-nowrap text-caption text-foreground-muted">
            {textoPlazo(fila.diasRestantes)}
          </p>
        </div>
      ),
    },
    {
      id: 'estado',
      encabezado: 'Estado',
      ancho: '120px',
      celda: (fila) => {
        const estado = VARIANTE_PAGO[fila.estado]
        return <Badge variant={estado.variante}>{estado.etiqueta}</Badge>
      },
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

  const total = pagos.reduce((suma, pago) => suma + pago.monto, 0)

  return (
    <Card className="flex flex-col">
      <div className="p-5 pb-2">
        <SectionHeader
          nivel="h3"
          titulo="Próximos Pagos"
          descripcion={`${formatearMoneda(total)} comprometidos`}
        />
      </div>
      <div className="px-2 pb-3">
        <DataTable
          etiqueta="Próximos pagos comprometidos"
          columnas={columnas}
          filas={pagos}
          claveFila={(fila) => fila.id}
          cargando={cargando}
          mensajeVacio="Sin pagos programados"
        />
      </div>
    </Card>
  )
}
