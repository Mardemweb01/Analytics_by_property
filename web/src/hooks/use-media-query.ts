import { useSyncExternalStore } from 'react'

/**
 * Suscribe a una media query.
 *
 * Usa `useSyncExternalStore` en vez de `useState` + `useEffect` porque el
 * ancho de la ventana es exactamente eso: un store externo. React lee el valor
 * en el momento correcto del render y evita el frame intermedio en el que el
 * componente se pinta con el valor viejo — que en un layout responsive se ve
 * como un salto del sidebar al cargar.
 */
export function useMediaQuery(consulta: string): boolean {
  return useSyncExternalStore(
    (alCambiar) => {
      const media = window.matchMedia(consulta)
      media.addEventListener('change', alCambiar)
      return () => media.removeEventListener('change', alCambiar)
    },
    () => window.matchMedia(consulta).matches,
    // Snapshot de servidor: sin DOM asumimos escritorio, que es el caso
    // principal de este producto (desktop-first).
    () => false,
  )
}

/** Breakpoints del sistema, alineados con los de `theme.css`. Centralizados
 *  para que un cambio de breakpoint no obligue a buscar strings sueltos. */
export const CONSULTAS = {
  movil: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1023px)',
  hastaTablet: '(max-width: 1023px)',
  escritorio: '(min-width: 1024px)',
  escritorioAncho: '(min-width: 1440px)',
  movimientoReducido: '(prefers-reduced-motion: reduce)',
} as const

export const useEsMovil = () => useMediaQuery(CONSULTAS.movil)
export const useEsHastaTablet = () => useMediaQuery(CONSULTAS.hastaTablet)
export const useMovimientoReducido = () => useMediaQuery(CONSULTAS.movimientoReducido)
