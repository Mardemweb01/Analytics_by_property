/** Identidad del producto, en un solo lugar para no repetir strings en el
 *  layout, el `<title>` y los estados vacíos. */
export const APP = {
  nombre: 'Mardem Analytics',
  modulo: 'Administración de PH',
  version: '0.1.0',
} as const

/** Clave de localStorage del tema. Debe coincidir con el script inline de
 *  `index.html` que evita el flash de tema al cargar. */
export const CLAVE_TEMA = 'mardem-theme'

/** Clave de localStorage del estado colapsado del sidebar. */
export const CLAVE_SIDEBAR = 'mardem-sidebar-colapsado'

/**
 * Configuración de TanStack Query.
 *
 * `staleTime` alto (5 min) porque los datos contables de un período cerrado no
 * cambian minuto a minuto: refetchear al enfocar la ventana solo gastaría red
 * y haría parpadear los gráficos sin aportar nada.
 */
export const QUERY_CONFIG = {
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: 1,
} as const

/** Latencia simulada del mock, para que los skeletons sean visibles en
 *  desarrollo en vez de aparecer y desaparecer en un frame. */
export const LATENCIA_MOCK_MS = 650
