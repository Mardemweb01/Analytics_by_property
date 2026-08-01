import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Skeleton de una KPI card.
 *
 * Replica la estructura exacta de `MetricCard` (título + icono circular,
 * valor, pie con comparación y sparkline). Que las siluetas coincidan es lo
 * que evita el salto de layout cuando llegan los datos: si el skeleton mide
 * distinto que el contenido real, la pantalla "brinca" y se percibe más lenta
 * que si no hubiera skeleton.
 */
export function LoadingCard({ className }: { className?: string }) {
  return (
    <Card className={cn('h-full', className)}>
      <div className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="size-9 rounded-full" />
        </div>
        <Skeleton className="h-8 w-36" />
        <div className="mt-auto flex items-end justify-between gap-3">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-6 w-[72px]" />
        </div>
      </div>
    </Card>
  )
}

/** Skeleton de una card de gráfico. */
export function LoadingChartCard({
  alto = 264,
  className,
}: {
  alto?: number
  className?: string
}) {
  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <div className="flex items-start justify-between gap-4 p-5 pb-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="px-5 pb-5">
        <Skeleton className="w-full rounded-lg" style={{ height: alto }} />
      </div>
    </Card>
  )
}
