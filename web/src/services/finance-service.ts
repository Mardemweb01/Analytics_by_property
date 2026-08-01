import type { FinanceApi, ParametrosResumen } from '@/api/finance-api'
import { FinanceApiError } from '@/api/finance-api'
import { LATENCIA_MOCK_MS } from '@/constants/app'
import {
  PERIODOS_DISPONIBLES,
  PROPIEDADES,
  RESUMEN_MOCK,
} from '@/services/mock/datos-mock'
import type { Periodo, Propiedad, ResumenFinanciero } from '@/types'

/** Espera cancelable. Rechaza si se aborta, para que TanStack Query trate la
 *  cancelación como tal y no como un resultado válido. */
function esperar(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolver, rechazar) => {
    if (signal?.aborted) {
      rechazar(new DOMException('Petición cancelada', 'AbortError'))
      return
    }
    const temporizador = setTimeout(resolver, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(temporizador)
        rechazar(new DOMException('Petición cancelada', 'AbortError'))
      },
      { once: true },
    )
  })
}

/**
 * Implementación mock de `FinanceApi`.
 *
 * Simula latencia a propósito: sin ella los skeletons aparecen y desaparecen
 * en un frame y es imposible verificar que los estados de carga se ven bien.
 */
export class MockFinanceApi implements FinanceApi {
  async obtenerResumen(
    parametros: ParametrosResumen,
    signal?: AbortSignal,
  ): Promise<ResumenFinanciero> {
    await esperar(LATENCIA_MOCK_MS, signal)

    const propiedad = PROPIEDADES.find((item) => item.id === parametros.propiedadId)
    if (!propiedad) {
      throw new FinanceApiError(`No existe la propiedad "${parametros.propiedadId}"`)
    }

    const periodo = PERIODOS_DISPONIBLES.find((item) => item.id === parametros.periodoId)
    const comparacion = PERIODOS_DISPONIBLES.find((item) => item.id === parametros.comparacionId)
    if (!periodo || !comparacion) {
      throw new FinanceApiError('El período solicitado no tiene datos disponibles')
    }

    // El mock tiene una sola foto de datos; reflejamos los filtros elegidos
    // para que la UI muestre coherencia (los títulos y las etiquetas de
    // comparación cambian) sin fabricar series distintas por combinación.
    return {
      ...RESUMEN_MOCK,
      periodo,
      periodoComparacion: comparacion,
      propiedad,
    }
  }

  async listarPeriodos(signal?: AbortSignal): Promise<Periodo[]> {
    await esperar(120, signal)
    return PERIODOS_DISPONIBLES
  }

  async listarPropiedades(signal?: AbortSignal): Promise<Propiedad[]> {
    await esperar(120, signal)
    return PROPIEDADES
  }
}

/**
 * Instancia activa de la fuente de datos.
 *
 * Único punto que hay que tocar para pasar a datos reales:
 *   export const financeApi: FinanceApi = new HttpFinanceApi(import.meta.env.VITE_API_URL)
 */
export const financeApi: FinanceApi = new MockFinanceApi()
