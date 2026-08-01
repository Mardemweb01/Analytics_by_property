import { Bell, Menu, Moon, PanelLeft, Search, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/store/sidebar-store'

/**
 * Barra superior. Contiene solo acciones globales (buscar, notificaciones,
 * tema, cuenta); los filtros de datos viven en la `FilterBar` de la página,
 * porque pertenecen al contenido y no al chrome de la aplicación.
 */
export function Topbar() {
  const { colapsado, alternarColapso, abrirMovil, modoDrawer } = useSidebar()
  const { esOscuro, alternar } = useTheme()

  return (
    <header
      className={cn(
        'sticky top-0 z-[30] flex h-[var(--topbar-height)] items-center gap-3',
        'border-b border-border bg-surface/85 px-4 backdrop-blur-md lg:px-6',
      )}
    >
      {modoDrawer ? (
        <Button variant="ghost" size="icon" onClick={abrirMovil} aria-label="Abrir menú lateral">
          <Menu aria-hidden />
        </Button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={alternarColapso}
              aria-label={colapsado ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
              aria-expanded={!colapsado}
            >
              <PanelLeft
                className={cn('transition-transform duration-200', colapsado && 'rotate-180')}
                aria-hidden
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {colapsado ? 'Expandir menú' : 'Colapsar menú'}
          </TooltipContent>
        </Tooltip>
      )}

      <BuscadorGlobal />

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notificaciones" className="relative">
              <Bell aria-hidden />
              {/* Punto de notificaciones sin leer. `sr-only` acompaña porque
                  un punto de color no le dice nada a un lector de pantalla. */}
              <span
                className="absolute right-2 top-2 size-1.5 rounded-full bg-negative ring-2 ring-surface"
                aria-hidden
              />
              <span className="sr-only">Tenés notificaciones sin leer</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Notificaciones</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={alternar}
              aria-label={esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            >
              {esOscuro ? <Sun aria-hidden /> : <Moon aria-hidden />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{esOscuro ? 'Tema claro' : 'Tema oscuro'}</TooltipContent>
        </Tooltip>

        <div className="mx-1 h-5 w-px bg-border" aria-hidden />

        <MenuUsuario />
      </div>
    </header>
  )
}

/** Buscador global. Presentacional en esta fase: abre el mismo patrón de
 *  command palette que usan Linear/Vercel, pendiente de cablear. */
function BuscadorGlobal() {
  return (
    <button
      type="button"
      className={cn(
        'hidden h-9 items-center gap-2 rounded-control border border-border bg-surface-sunken px-3 md:flex',
        'text-body text-foreground-muted',
        'transition-colors duration-150 ease-out',
        'hover:border-border-strong hover:bg-surface-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        'w-56 lg:w-72',
      )}
      aria-label="Buscar en el sistema"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 text-left">Buscar…</span>
      <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-overline text-foreground-subtle">
        ⌘K
      </kbd>
    </button>
  )
}

function MenuUsuario() {
  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-2 rounded-control py-1 pl-1 pr-2',
        'transition-colors duration-150 ease-out hover:bg-surface-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
      )}
      aria-label="Menú de la cuenta"
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-caption font-semibold text-accent"
        aria-hidden
      >
        OM
      </span>
      <span className="hidden text-left lg:block">
        <span className="block text-caption font-medium leading-tight text-foreground">
          Oldemar M.
        </span>
        <span className="block text-overline leading-tight text-foreground-muted">
          Administrador
        </span>
      </span>
    </button>
  )
}
