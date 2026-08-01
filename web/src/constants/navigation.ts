import {
  Banknote,
  ChartColumn,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Un ítem del menú lateral. */
export interface ItemNavegacion {
  id: string
  etiqueta: string
  ruta: string
  icono: LucideIcon
  /** Contador opcional (p. ej. cuentas morosas pendientes). */
  insignia?: number
}

export interface GrupoNavegacion {
  id: string
  /** Título del grupo. `null` en el primer grupo: encabezar "Resumen" con un
   *  rótulo agrega ruido sin agregar información. */
  etiqueta: string | null
  items: ItemNavegacion[]
}

/**
 * Estructura del menú. Agrupada por dominio y no por tipo de pantalla: el
 * administrador piensa en "cobranza" o "gastos", no en "tablas" o "reportes".
 */
export const NAVEGACION: GrupoNavegacion[] = [
  {
    id: 'general',
    etiqueta: null,
    items: [
      {
        id: 'resumen',
        etiqueta: 'Resumen',
        ruta: '/',
        icono: LayoutDashboard,
      },
    ],
  },
  {
    id: 'finanzas',
    etiqueta: 'Finanzas',
    items: [
      { id: 'ingresos', etiqueta: 'Ingresos', ruta: '/ingresos', icono: Banknote },
      { id: 'gastos', etiqueta: 'Gastos', ruta: '/gastos', icono: Receipt },
      { id: 'presupuesto', etiqueta: 'Presupuesto', ruta: '/presupuesto', icono: ChartColumn },
      { id: 'reserva', etiqueta: 'Fondo de Reserva', ruta: '/reserva', icono: PiggyBank },
    ],
  },
  {
    id: 'cobranza',
    etiqueta: 'Cobranza',
    items: [
      { id: 'cuotas', etiqueta: 'Cuotas', ruta: '/cuotas', icono: Wallet },
      {
        id: 'morosidad',
        etiqueta: 'Morosidad',
        ruta: '/morosidad',
        icono: TriangleAlert,
        insignia: 12,
      },
    ],
  },
]

/** Ítems del pie del menú, separados de la navegación principal. */
export const NAVEGACION_SECUNDARIA: ItemNavegacion[] = [
  { id: 'ajustes', etiqueta: 'Configuración', ruta: '/ajustes', icono: Settings },
]
