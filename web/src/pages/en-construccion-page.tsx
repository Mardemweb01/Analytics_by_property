import { Construction } from 'lucide-react'
import { useLocation } from 'react-router'

import { EstadoVacio } from '@/components/feedback/estado-vacio'

/**
 * Placeholder de las secciones aún no implementadas. Existe para que el
 * sidebar navegue a rutas reales: un menú que lleva a una pantalla en blanco
 * se lee como un bug, uno que lleva a un estado vacío explícito se lee como
 * un producto en construcción.
 */
export default function PaginaEnConstruccion() {
  const { pathname } = useLocation()
  const seccion = pathname.replace('/', '') || 'Sección'

  return (
    <EstadoVacio
      icono={Construction}
      titulo={`${seccion.charAt(0).toUpperCase()}${seccion.slice(1)} en construcción`}
      descripcion="Esta sección todavía no está disponible. El resumen financiero ya está operativo."
      className="min-h-[60vh]"
    />
  )
}
