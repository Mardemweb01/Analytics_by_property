import { useCallback, useEffect, useState } from 'react'

import { CLAVE_TEMA } from '@/constants/app'

export type Tema = 'light' | 'dark'

/** Lee el tema ya aplicado por el script inline de `index.html`. Leemos del
 *  DOM y no de localStorage para tener una única fuente de verdad: el script
 *  inline ya resolvió la preferencia del sistema si no había nada guardado. */
function temaActual(): Tema {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * Maneja el tema claro/oscuro.
 *
 * El estado real vive en el DOM (`<html class="dark">`), no en React: el
 * script inline de `index.html` lo aplica antes del primer paint para evitar
 * el flash de tema claro, así que React llega a sincronizarse, no a decidir.
 */
export function useTheme() {
  const [tema, setTema] = useState<Tema>(temaActual)

  const aplicar = useCallback((siguiente: Tema) => {
    const raiz = document.documentElement

    // Activa las transiciones de color solo durante el cambio. Sin este
    // flag, cada hover de la app pagaría el costo de transicionar
    // background-color en todos los elementos.
    raiz.setAttribute('data-theme-changing', '')

    raiz.classList.toggle('dark', siguiente === 'dark')
    raiz.dataset.theme = siguiente
    try {
      localStorage.setItem(CLAVE_TEMA, siguiente)
    } catch {
      // localStorage bloqueado: el tema aplica igual, solo no persiste.
    }
    setTema(siguiente)

    window.setTimeout(() => raiz.removeAttribute('data-theme-changing'), 220)
  }, [])

  const alternar = useCallback(() => {
    aplicar(temaActual() === 'dark' ? 'light' : 'dark')
  }, [aplicar])

  // Sigue la preferencia del sistema, pero solo mientras el usuario no haya
  // elegido explícitamente: una elección manual gana sobre el sistema.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const alCambiar = (evento: MediaQueryListEvent) => {
      const hayPreferenciaGuardada = (() => {
        try {
          return localStorage.getItem(CLAVE_TEMA) !== null
        } catch {
          return false
        }
      })()
      if (hayPreferenciaGuardada) return
      aplicar(evento.matches ? 'dark' : 'light')
    }

    media.addEventListener('change', alCambiar)
    return () => media.removeEventListener('change', alCambiar)
  }, [aplicar])

  return { tema, alternar, aplicar, esOscuro: tema === 'dark' }
}
