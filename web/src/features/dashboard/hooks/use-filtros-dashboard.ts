import { useCallback, useMemo, useState } from 'react'

import type { ParametrosResumen } from '@/api/finance-api'
import { PERIODO_ACTUAL, PERIODO_ANTERIOR, PROPIEDADES } from '@/services/mock/datos-mock'

export interface FiltrosDashboard {
  periodoId: string
  comparacionId: string
  propiedadId: string
  edificioId: string | null
}

const FILTROS_INICIALES: FiltrosDashboard = {
  periodoId: PERIODO_ACTUAL.id,
  comparacionId: PERIODO_ANTERIOR.id,
  propiedadId: PROPIEDADES[0]!.id,
  edificioId: null,
}

/**
 * Estado de los filtros del dashboard.
 *
 * Co-locado en un hook y NO en un store global, a diferencia del sidebar: los
 * filtros solo los consume esta pantalla, así que un contexto global sería
 * centralizar por reflejo. El día que otra vista necesite el mismo filtro,
 * subirlo a un provider es mecánico porque la forma ya está encapsulada acá.
 *
 * Nota: cambiar de propiedad resetea el edificio. Sin ese reseteo quedaría
 * seleccionado un edificio que no pertenece a la propiedad activa — un filtro
 * imposible que devolvería cero resultados sin explicación visible.
 */
export function useFiltrosDashboard() {
  const [filtros, setFiltros] = useState<FiltrosDashboard>(FILTROS_INICIALES)

  const cambiarPeriodo = useCallback((periodoId: string) => {
    setFiltros((previo) => ({ ...previo, periodoId }))
  }, [])

  const cambiarComparacion = useCallback((comparacionId: string) => {
    setFiltros((previo) => ({ ...previo, comparacionId }))
  }, [])

  const cambiarPropiedad = useCallback((propiedadId: string) => {
    setFiltros((previo) => ({ ...previo, propiedadId, edificioId: null }))
  }, [])

  const cambiarEdificio = useCallback((edificioId: string | null) => {
    setFiltros((previo) => ({ ...previo, edificioId }))
  }, [])

  const reiniciar = useCallback(() => setFiltros(FILTROS_INICIALES), [])

  /** Forma que espera la capa de datos. Memoizada porque es parte de la
   *  queryKey: un objeto nuevo en cada render dispararía refetch infinito. */
  const parametros = useMemo<ParametrosResumen>(
    () => ({
      periodoId: filtros.periodoId,
      comparacionId: filtros.comparacionId,
      propiedadId: filtros.propiedadId,
      edificioId: filtros.edificioId,
    }),
    [filtros.periodoId, filtros.comparacionId, filtros.propiedadId, filtros.edificioId],
  )

  return {
    filtros,
    parametros,
    cambiarPeriodo,
    cambiarComparacion,
    cambiarPropiedad,
    cambiarEdificio,
    reiniciar,
  }
}
