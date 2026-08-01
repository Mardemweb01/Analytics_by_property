import { Outlet } from 'react-router'

import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/store/sidebar-store'

/**
 * Estructura de la aplicación: sidebar fijo + columna de contenido.
 *
 * El margen izquierdo del contenido se calcula desde el ancho del sidebar (en
 * vez de usar flex) porque el sidebar es `fixed`: así el contenido puede
 * scrollear de forma independiente y el menú nunca se va de pantalla en una
 * página larga.
 */
export function DashboardLayout() {
  const { colapsado } = useSidebar()

  return (
    <div className="min-h-screen bg-background">
      {/* Salto al contenido: primer elemento tabulable de la página. Requisito
          WCAG 2.4.1 — permite a quien navega por teclado esquivar el menú
          completo en cada carga. */}
      <a
        href="#contenido-principal"
        className={cn(
          'sr-only-focusable fixed left-4 top-4 z-[80] rounded-control',
          'bg-primary px-4 py-2 text-body font-medium text-primary-foreground shadow-lg',
        )}
      >
        Saltar al contenido
      </a>

      <Sidebar />

      <div
        className={cn(
          'flex min-h-screen flex-col',
          'transition-[padding] duration-200 ease-out',
          colapsado ? 'lg:pl-[var(--sidebar-width-collapsed)]' : 'lg:pl-[var(--sidebar-width)]',
        )}
      >
        <Topbar />

        <main id="contenido-principal" tabIndex={-1} className="flex-1 focus:outline-none">
          {/* Techo de ancho para monitores 1920+: sin él las cards se estiran
              hasta romper la relación entre densidad y legibilidad. */}
          <div className="mx-auto w-full max-w-container-content px-4 py-6 lg:px-6 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
