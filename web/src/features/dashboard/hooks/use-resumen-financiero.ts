import { useQuery } from '@tanstack/react-query'

import type { ParametrosResumen } from '@/api/finance-api'
import { claves } from '@/lib/query-keys'
import { financeApi } from '@/services/finance-service'

/**
 * Datos del resumen financiero para los filtros activos.
 *
 * Un solo hook para toda la pantalla (en vez de uno por card) por una razón
 * concreta: garantiza que las KPIs, los gráficos y las tablas provengan del
 * mismo corte de datos. Con nueve queries independientes es cuestión de tiempo
 * que las KPIs muestren mayo mientras un gráfico todavía pinta abril.
 *
 * `placeholderData` mantiene en pantalla el resultado anterior mientras llega
 * el nuevo: al cambiar de período el dashboard se atenúa en vez de colapsar a
 * skeletons, que es lo que hace que el filtro se sienta instantáneo.
 */
export function useResumenFinanciero(parametros: ParametrosResumen) {
  return useQuery({
    queryKey: claves.resumen.detalle(parametros),
    queryFn: ({ signal }) => financeApi.obtenerResumen(parametros, signal),
    placeholderData: (anterior) => anterior,
  })
}

/** Catálogo de períodos para el filtro. */
export function usePeriodos() {
  return useQuery({
    queryKey: claves.catalogos.periodos(),
    queryFn: ({ signal }) => financeApi.listarPeriodos(signal),
    // Los catálogos no cambian durante una sesión: no tiene sentido
    // revalidarlos.
    staleTime: Infinity,
  })
}

/** Catálogo de propiedades para el filtro. */
export function usePropiedades() {
  return useQuery({
    queryKey: claves.catalogos.propiedades(),
    queryFn: ({ signal }) => financeApi.listarPropiedades(signal),
    staleTime: Infinity,
  })
}
