import { Check, X } from 'lucide-react'
import { motion } from 'motion/react'

import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { NivelSalud, SaludFinanciera } from '@/types'

/** Estilos por nivel de salud. Tabla completa (no interpolación) para que
 *  Tailwind vea las clases literales al escanear el código. */
const ESTILO_NIVEL: Record<
  NivelSalud,
  { enfasis: 'positivo' | 'precaucion' | 'negativo'; anillo: string; texto: string; pista: string }
> = {
  buena: {
    enfasis: 'positivo',
    anillo: 'stroke-positive',
    texto: 'text-positive',
    pista: 'stroke-positive-border',
  },
  regular: {
    enfasis: 'precaucion',
    anillo: 'stroke-caution',
    texto: 'text-caution-strong',
    pista: 'stroke-caution-border',
  },
  critica: {
    enfasis: 'negativo',
    anillo: 'stroke-negative',
    texto: 'text-negative',
    pista: 'stroke-negative-border',
  },
}

export interface StatusCardProps {
  salud: SaludFinanciera
  indice?: number
  className?: string
}

/**
 * Semáforo financiero.
 *
 * La maqueta original usaba un círculo sólido de color. Acá es un anillo de
 * progreso que además codifica el PUNTAJE: el color sigue diciendo el estado
 * de un vistazo, pero el arco agrega la magnitud, así que la card informa dos
 * cosas en el mismo espacio en vez de una.
 *
 * El nivel nunca se comunica solo por color: va acompañado de la etiqueta
 * textual ("Buena") y del puntaje numérico, requisito de WCAG 1.4.1.
 */
export function StatusCard({ salud, indice = 0, className }: StatusCardProps) {
  const estilo = ESTILO_NIVEL[salud.nivel]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: indice * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      <Card enfasis={estilo.enfasis} className="h-full">
        <div className="flex h-full flex-col gap-3 p-5">
          <p className="text-body font-medium text-foreground-secondary">Semáforo Financiero</p>

          <div className="flex items-center gap-4">
            <AnilloSalud puntaje={salud.puntaje} estilo={estilo} />

            <div className="min-w-0 flex-1">
              <p className="text-caption text-foreground-muted">Salud Financiera</p>
              <p className={cn('text-metric', estilo.texto)}>{salud.etiqueta}</p>
            </div>
          </div>

          <p className="text-caption leading-relaxed text-foreground-secondary">
            {salud.descripcion}
          </p>

          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {salud.factores.map((factor) => (
              <Tooltip key={factor.etiqueta}>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'flex size-5 cursor-help items-center justify-center rounded-full',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                      factor.cumple
                        ? 'bg-positive/15 text-positive'
                        : 'bg-caution/20 text-caution-strong',
                    )}
                    tabIndex={0}
                    role="img"
                    aria-label={`${factor.etiqueta}: ${factor.cumple ? 'cumple' : 'no cumple'}`}
                  >
                    {factor.cumple ? (
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    ) : (
                      <X className="size-3" strokeWidth={3} aria-hidden />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {factor.etiqueta} · {factor.cumple ? `+${factor.aporte} pts` : 'sin aporte'}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

/** Anillo de progreso en SVG. El arco se anima dibujándose vía
 *  `strokeDashoffset`, que es la técnica más barata: no repinta layout. */
function AnilloSalud({
  puntaje,
  estilo,
}: {
  puntaje: number
  estilo: (typeof ESTILO_NIVEL)[NivelSalud]
}) {
  const tamano = 68
  const grosor = 6
  const radio = (tamano - grosor) / 2
  const circunferencia = 2 * Math.PI * radio
  const proporcion = Math.max(0, Math.min(100, puntaje)) / 100

  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg
        width={tamano}
        height={tamano}
        viewBox={`0 0 ${tamano} ${tamano}`}
        // Rota -90° para que el arco arranque arriba y no a las 3 en punto.
        className="-rotate-90"
        aria-hidden
        focusable="false"
      >
        <circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={radio}
          fill="none"
          strokeWidth={grosor}
          className={estilo.pista}
        />
        <motion.circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={radio}
          fill="none"
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          className={estilo.anillo}
          initial={{ strokeDashoffset: circunferencia }}
          animate={{ strokeDashoffset: circunferencia * (1 - proporcion) }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center text-body font-bold tabular',
          estilo.texto,
        )}
      >
        {puntaje}
      </span>
    </div>
  )
}
