import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { CLAVE_SIDEBAR } from '@/constants/app'
import { useEsHastaTablet } from '@/hooks/use-media-query'

interface EstadoSidebar {
  /** Colapsado a solo iconos (escritorio). */
  colapsado: boolean
  /** Abierto como drawer superpuesto (móvil/tablet). */
  abiertoMovil: boolean
  alternarColapso: () => void
  abrirMovil: () => void
  cerrarMovil: () => void
  /** `true` cuando el viewport obliga al modo drawer. */
  modoDrawer: boolean
}

const ContextoSidebar = createContext<EstadoSidebar | null>(null)

function leerColapsadoGuardado(): boolean {
  try {
    return localStorage.getItem(CLAVE_SIDEBAR) === 'true'
  } catch {
    return false
  }
}

/**
 * Estado del sidebar.
 *
 * Va a un store (y no co-locado en el componente) porque hay contexto
 * compartido real: el botón que lo colapsa vive en el Topbar, el que lo
 * consume es el Sidebar, y el DashboardLayout necesita el mismo valor para
 * calcular el margen del contenido. Tres consumidores separados en el árbol =
 * el caso que justifica un contexto.
 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [colapsado, setColapsado] = useState(leerColapsadoGuardado)
  const [abiertoMovil, setAbiertoMovil] = useState(false)
  const modoDrawer = useEsHastaTablet()

  const alternarColapso = useCallback(() => {
    setColapsado((previo) => {
      const siguiente = !previo
      try {
        localStorage.setItem(CLAVE_SIDEBAR, String(siguiente))
      } catch {
        // Sin persistencia: el colapso sigue funcionando en la sesión.
      }
      return siguiente
    })
  }, [])

  const abrirMovil = useCallback(() => setAbiertoMovil(true), [])
  const cerrarMovil = useCallback(() => setAbiertoMovil(false), [])

  // Al pasar a escritorio cerramos el drawer: si no, queda un overlay
  // invisible capturando clicks después de agrandar la ventana.
  useEffect(() => {
    if (!modoDrawer) setAbiertoMovil(false)
  }, [modoDrawer])

  // Escape cierra el drawer. Es la expectativa estándar de cualquier capa
  // modal y parte de los requisitos de navegación por teclado.
  useEffect(() => {
    if (!abiertoMovil) return
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbiertoMovil(false)
    }
    document.addEventListener('keydown', alPresionar)
    return () => document.removeEventListener('keydown', alPresionar)
  }, [abiertoMovil])

  const valor = useMemo<EstadoSidebar>(
    () => ({
      colapsado: modoDrawer ? false : colapsado,
      abiertoMovil,
      alternarColapso,
      abrirMovil,
      cerrarMovil,
      modoDrawer,
    }),
    [colapsado, abiertoMovil, alternarColapso, abrirMovil, cerrarMovil, modoDrawer],
  )

  return <ContextoSidebar.Provider value={valor}>{children}</ContextoSidebar.Provider>
}

export function useSidebar(): EstadoSidebar {
  const contexto = useContext(ContextoSidebar)
  if (!contexto) {
    throw new Error('useSidebar debe usarse dentro de <SidebarProvider>')
  }
  return contexto
}
