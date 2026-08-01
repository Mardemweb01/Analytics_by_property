import { useId, useMemo } from 'react'

import { calcularSparkline } from '@/lib/sparkline'
import { cn } from '@/lib/utils'
import type { IntencionSemantica } from '@/types'
import { CLASES_SPARKLINE_INTENCION } from '@/constants/kpi'

export interface SparklineProps {
  valores: readonly number[]
  intencion?: IntencionSemantica
  ancho?: number
  alto?: number
  /** Rellena el área bajo la línea con un degradado. Da peso visual sin
   *  agregar tinta fuerte. */
  conArea?: boolean
  className?: string
}

/**
 * Micro-gráfico de tendencia para las KPI cards.
 *
 * SVG a mano y no ECharts: instanciar nueve gráficos ECharts para dibujar
 * nueve polilíneas de seis puntos cuesta megabytes de runtime y un observer de
 * resize por card, a cambio de nada. Este componente son ~40 líneas y no
 * arrastra dependencias.
 *
 * `aria-hidden`: el sparkline es decorativo. El dato que comunica ya está en
 * el valor y en el badge de comparación de la misma card, así que anunciarlo
 * de nuevo sería ruido para un lector de pantalla.
 */
export function Sparkline({
  valores,
  intencion = 'neutral',
  ancho = 120,
  alto = 32,
  conArea = true,
  className,
}: SparklineProps) {
  // `useId` evita que dos sparklines en la misma página compartan el id del
  // degradado: si colisionan, el segundo hereda el color del primero.
  const idGradiente = useId()

  const trazado = useMemo(
    () => calcularSparkline(valores, { ancho, alto }),
    [valores, ancho, alto],
  )

  if (!trazado.linea) return null

  return (
    <svg
      width={ancho}
      height={alto}
      viewBox={`0 0 ${ancho} ${alto}`}
      // `none` deja que el trazo se estire con el contenedor: la card manda
      // el ancho, el sparkline se adapta.
      preserveAspectRatio="none"
      className={cn('overflow-visible', CLASES_SPARKLINE_INTENCION[intencion], className)}
      aria-hidden="true"
      focusable="false"
    >
      {conArea && (
        <>
          <defs>
            <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={trazado.area} fill={`url(#${idGradiente})`} stroke="none" />
        </>
      )}

      <path
        d={trazado.linea}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        // Mantiene el grosor del trazo constante pese al escalado no uniforme
        // que impone `preserveAspectRatio="none"`; sin esto la línea se
        // engorda al estirarse en horizontal.
        vectorEffect="non-scaling-stroke"
      />

      {trazado.ultimoPunto && (
        <circle
          cx={trazado.ultimoPunto.x}
          cy={trazado.ultimoPunto.y}
          r={2}
          fill="currentColor"
          stroke="var(--surface)"
          strokeWidth={1.5}
        />
      )}
    </svg>
  )
}
