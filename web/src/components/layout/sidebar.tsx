import { AnimatePresence, motion } from 'motion/react'
import { NavLink } from 'react-router'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { APP } from '@/constants/app'
import { NAVEGACION, NAVEGACION_SECUNDARIA, type ItemNavegacion } from '@/constants/navigation'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/store/sidebar-store'

/**
 * Menú lateral.
 *
 * Tres modos en un solo componente:
 *   - escritorio expandido (256px)
 *   - escritorio colapsado (72px, solo iconos + tooltips)
 *   - drawer superpuesto (<1024px)
 *
 * Están unificados a propósito: mantener dos árboles de navegación en paralelo
 * garantiza que uno quede desactualizado.
 */
export function Sidebar() {
  const { colapsado, abiertoMovil, cerrarMovil, modoDrawer } = useSidebar()

  const contenido = (
    <div className="flex h-full flex-col gap-1 overflow-hidden">
      <MarcaSidebar colapsado={colapsado} />

      <nav
        aria-label="Navegación principal"
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2"
      >
        {NAVEGACION.map((grupo) => (
          <div key={grupo.id} className="mb-4 last:mb-0">
            {grupo.etiqueta && !colapsado && (
              <p className="px-3 pb-1.5 pt-2 text-overline uppercase text-foreground-subtle">
                {grupo.etiqueta}
              </p>
            )}
            {/* En modo colapsado el rótulo del grupo no cabe; una línea
                mantiene la separación visual sin ocupar alto. */}
            {grupo.etiqueta && colapsado && <div className="mx-2 my-3 h-px bg-border-subtle" />}
            <ul className="flex flex-col gap-0.5">
              {grupo.items.map((item) => (
                <li key={item.id}>
                  <EnlaceNavegacion item={item} colapsado={colapsado} alNavegar={cerrarMovil} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border-subtle px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {NAVEGACION_SECUNDARIA.map((item) => (
            <li key={item.id}>
              <EnlaceNavegacion item={item} colapsado={colapsado} alNavegar={cerrarMovil} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )

  if (modoDrawer) {
    return (
      <AnimatePresence>
        {abiertoMovil && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={cerrarMovil}
              className="fixed inset-0 z-[40] bg-neutral-900/40 backdrop-blur-[2px] lg:hidden"
              aria-hidden
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-[50] w-64 border-r border-border bg-surface lg:hidden"
              aria-label="Menú lateral"
            >
              {contenido}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    )
  }

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-[20] hidden border-r border-border bg-surface lg:block',
        'transition-[width] duration-200 ease-out',
        colapsado ? 'w-[var(--sidebar-width-collapsed)]' : 'w-[var(--sidebar-width)]',
      )}
      aria-label="Menú lateral"
    >
      {contenido}
    </aside>
  )
}

/** Bloque de marca. Alto fijo igual al del Topbar para que el borde inferior
 *  de ambos quede a la misma altura — un desalineo de 1px acá es de lo primero
 *  que delata una UI descuidada. */
function MarcaSidebar({ colapsado }: { colapsado: boolean }) {
  return (
    <div
      className={cn(
        'flex h-[var(--topbar-height)] shrink-0 items-center border-b border-border-subtle',
        colapsado ? 'justify-center px-2' : 'gap-2.5 px-5',
      )}
    >
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs"
        aria-hidden
      >
        <span className="text-body font-bold">M</span>
      </div>
      {!colapsado && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold leading-tight text-foreground">
            {APP.nombre}
          </p>
          <p className="truncate text-caption leading-tight text-foreground-muted">{APP.modulo}</p>
        </div>
      )}
    </div>
  )
}

interface PropsEnlace {
  item: ItemNavegacion
  colapsado: boolean
  alNavegar: () => void
}

function EnlaceNavegacion({ item, colapsado, alNavegar }: PropsEnlace) {
  const Icono = item.icono

  const enlace = (
    <NavLink
      to={item.ruta}
      onClick={alNavegar}
      // `end` solo en la raíz: sin esto, "/" quedaría activo en todas las
      // rutas porque todo path empieza con "/".
      end={item.ruta === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-control px-3 py-2',
          'text-body font-medium',
          'transition-colors duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          colapsado && 'justify-center px-0',
          isActive
            ? 'bg-primary-subtle text-primary'
            : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Indicador de activo: barra a la izquierda. Redundante con el
              fondo tintado a propósito — el color solo no alcanza como único
              canal de información (WCAG 1.4.1). */}
          {isActive && !colapsado && (
            <motion.span
              layoutId="indicador-nav"
              className="absolute left-0 h-5 w-0.5 rounded-r-full bg-primary"
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              aria-hidden
            />
          )}
          <Icono className="size-4.5 shrink-0" aria-hidden />
          {!colapsado && (
            <>
              <span className="flex-1 truncate">{item.etiqueta}</span>
              {item.insignia !== undefined && (
                <span className="shrink-0 rounded-full bg-negative-subtle px-1.5 py-0.5 text-caption font-semibold text-negative-foreground tabular">
                  {item.insignia}
                </span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  )

  // Colapsado la etiqueta no se ve, así que el tooltip deja de ser un extra y
  // pasa a ser la única forma de saber a dónde lleva cada icono.
  if (colapsado) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{enlace}</TooltipTrigger>
        <TooltipContent side="right">
          {item.etiqueta}
          {item.insignia !== undefined && ` (${item.insignia})`}
        </TooltipContent>
      </Tooltip>
    )
  }

  return enlace
}
