import { LoadingCard } from '@/components/cards/loading-card'
import { MetricCard } from '@/components/cards/metric-card'
import { StatusCard } from '@/components/cards/status-card'
import type { MetricaKPI, SaludFinanciera } from '@/types'

export interface GrillaKpisProps {
  kpis: MetricaKPI[]
  salud: SaludFinanciera
  cargando?: boolean
}

/**
 * Las nueve tarjetas del resumen, en dos filas.
 *
 * La partición 5 + 4 viene de la maqueta y tiene lógica detrás: la primera
 * fila son magnitudes absolutas (saldos y flujos del mes), la segunda son
 * indicadores de gestión (ratios y estado). Se leen como dos preguntas
 * distintas: "cuánto hay" y "cómo vamos".
 *
 * En la segunda fila el semáforo ocupa el lugar de la quinta card. Como es
 * una card más ancha en la maqueta, acá se le da el mismo ancho que al resto
 * y se compensa con `xl:col-span-2` en pantallas anchas, donde sobra espacio.
 */
export function GrillaKpis({ kpis, salud, cargando = false }: GrillaKpisProps) {
  if (cargando) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, indice) => (
            <LoadingCard key={indice} />
          ))}
        </div>
        {/* 3 cards + el semáforo ocupando 2 columnas = las mismas 5 de la
            primera fila. Debe coincidir exactamente con el reparto del
            contenido real, o la pantalla salta al terminar de cargar. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 3 }, (_, indice) => (
            <LoadingCard key={indice} />
          ))}
          <LoadingCard className="sm:col-span-2 lg:col-span-3 xl:col-span-2" />
        </div>
      </div>
    )
  }

  const primeraFila = kpis.slice(0, 5)
  const segundaFila = kpis.slice(5)

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Indicadores financieros del período"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        {primeraFila.map((metrica, indice) => (
          <MetricCard key={metrica.id} metrica={metrica} indice={indice} />
        ))}
      </section>

      <section
        aria-label="Indicadores de gestión"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        {segundaFila.map((metrica, indice) => (
          <MetricCard key={metrica.id} metrica={metrica} indice={indice + 5} />
        ))}
        <StatusCard
          salud={salud}
          indice={segundaFila.length + 5}
          className="sm:col-span-2 lg:col-span-3 xl:col-span-2"
        />
      </section>
    </div>
  )
}
