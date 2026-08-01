import { motion } from 'motion/react'
import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface ChartCardProps {
  titulo: string
  subtitulo?: string
  /** Contenido a la derecha del encabezado: leyenda, toggle de rango,
   *  acciones. */
  accesorio?: ReactNode
  children: ReactNode
  indice?: number
  className?: string
}

/**
 * Contenedor de un gráfico: card + encabezado + zona de contenido.
 *
 * Existe para que los seis gráficos del dashboard compartan exactamente el
 * mismo encabezado, padding y ritmo vertical. Sin este componente, cada
 * gráfico terminaría con su propia interpretación del espaciado y la pantalla
 * perdería la alineación que la hace ver ordenada.
 */
export function ChartCard({
  titulo,
  subtitulo,
  accesorio,
  children,
  indice = 0,
  className,
}: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 + indice * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className={cn('min-w-0', className)}
    >
      <Card className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div className="min-w-0">
            <h3 className="text-h4 text-foreground">{titulo}</h3>
            {subtitulo && <p className="text-caption text-foreground-muted">{subtitulo}</p>}
          </div>
          {accesorio && <div className="shrink-0">{accesorio}</div>}
        </div>

        <div className="flex min-w-0 flex-1 flex-col px-2 pb-3">{children}</div>
      </Card>
    </motion.div>
  )
}

/** Leyenda propia, en HTML. Preferida sobre la leyenda nativa de ECharts
 *  porque esta hereda la tipografía y los tokens del sistema, es seleccionable
 *  y la leen los lectores de pantalla — el canvas de ECharts no. */
export function LeyendaGrafico({
  items,
  className,
}: {
  items: { etiqueta: string; color: string }[]
  className?: string
}) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <li key={item.etiqueta} className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="text-caption text-foreground-secondary">{item.etiqueta}</span>
        </li>
      ))}
    </ul>
  )
}
