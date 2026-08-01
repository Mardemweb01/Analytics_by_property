import { Skeleton } from '@/components/ui/skeleton'

/**
 * Fallback de `Suspense` para las páginas cargadas de forma diferida.
 *
 * Reproduce la silueta del dashboard (encabezado + fila de KPIs + gráficos) en
 * vez de mostrar un spinner: el layout no salta cuando llega el contenido
 * real, que es lo que hace que la carga se sienta rápida aunque no lo sea.
 */
export function PantallaCargando() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando contenido…</span>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, indice) => (
          <Skeleton key={indice} className="h-36 rounded-card" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, indice) => (
          <Skeleton key={indice} className="h-80 rounded-card" />
        ))}
      </div>
    </div>
  )
}
