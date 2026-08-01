import type { ParametrosResumen } from '@/api/finance-api'

/**
 * Claves de TanStack Query, centralizadas.
 *
 * Construirlas a mano en cada hook es cómo se llega a que un `invalidate` no
 * invalide nada por una diferencia de un carácter. Con esta factoría, la
 * jerarquía es explícita: invalidar `claves.resumen.todos` alcanza a todas las
 * variantes de parámetros de resumen.
 *
 * `as const` en cada tupla mantiene los tipos literales, que es lo que permite
 * a TanStack Query inferir bien las claves.
 */
export const claves = {
  resumen: {
    todos: ['resumen'] as const,
    detalle: (parametros: ParametrosResumen) => ['resumen', 'detalle', parametros] as const,
  },
  catalogos: {
    todos: ['catalogos'] as const,
    periodos: () => ['catalogos', 'periodos'] as const,
    propiedades: () => ['catalogos', 'propiedades'] as const,
  },
} as const
