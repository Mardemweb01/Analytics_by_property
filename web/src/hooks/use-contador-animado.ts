import { animate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { useMovimientoReducido } from '@/hooks/use-media-query'

export interface OpcionesContador {
  duracion?: number
  /** Retraso de arranque. Escalonar las cards produce el efecto de cascada
   *  sin coreografiar cada una a mano. */
  retraso?: number
  /** Desactiva la animación (p. ej. mientras los datos aún cargan). */
  habilitado?: boolean
}

/**
 * Anima un número desde su valor previo hasta el actual.
 *
 * Dos decisiones importantes:
 *
 *  - Anima desde el valor ANTERIOR, no desde cero. Al cambiar de período, ver
 *    142,580 → 138,200 comunica el cambio; reiniciar desde 0 en cada filtro
 *    sería una animación decorativa que además borra la comparación visual.
 *
 *  - Con `prefers-reduced-motion` devuelve el valor final de inmediato. Un
 *    contador que corre es justo el tipo de movimiento que causa malestar
 *    vestibular, y aquí no aporta información: el número final es el dato.
 */
export function useContadorAnimado(
  valorObjetivo: number,
  { duracion = 0.9, retraso = 0, habilitado = true }: OpcionesContador = {},
): number {
  const movimientoReducido = useMovimientoReducido()
  const [valor, setValor] = useState(valorObjetivo)
  const valorPrevio = useRef(valorObjetivo)

  useEffect(() => {
    if (!habilitado || movimientoReducido) {
      valorPrevio.current = valorObjetivo
      setValor(valorObjetivo)
      return
    }

    const desde = valorPrevio.current
    if (desde === valorObjetivo) return

    const controles = animate(desde, valorObjetivo, {
      duration: duracion,
      delay: retraso,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setValor,
    })

    valorPrevio.current = valorObjetivo
    return () => controles.stop()
  }, [valorObjetivo, duracion, retraso, habilitado, movimientoReducido])

  return valor
}
