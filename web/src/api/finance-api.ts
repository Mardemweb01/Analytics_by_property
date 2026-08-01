import type { Periodo, Propiedad, ResumenFinanciero } from '@/types'

/**
 * Contrato de la fuente de datos financieros.
 *
 * Es el punto de corte del sistema: la UI depende de esta interfaz, nunca de
 * quién la implementa. Hoy la cumple un mock; cuando el pipeline de Sage 50
 * exponga un endpoint, se escribe un `HttpFinanceApi` y se cambia una línea en
 * `finance-service` — ningún componente ni hook se entera.
 *
 * Todos los métodos reciben `AbortSignal` para que TanStack Query pueda
 * cancelar peticiones en vuelo cuando el usuario cambia de filtro rápido.
 */
export interface FinanceApi {
  /** Agregado completo del resumen para un período y propiedad. */
  obtenerResumen(parametros: ParametrosResumen, signal?: AbortSignal): Promise<ResumenFinanciero>

  /** Períodos con datos disponibles, del más reciente al más antiguo. */
  listarPeriodos(signal?: AbortSignal): Promise<Periodo[]>

  /** Propiedades administradas a las que el usuario tiene acceso. */
  listarPropiedades(signal?: AbortSignal): Promise<Propiedad[]>
}

export interface ParametrosResumen {
  /** Id de período, 'YYYY-MM'. */
  periodoId: string
  /** Id de período contra el que se compara. */
  comparacionId: string
  propiedadId: string
  /** Id del edificio, o `null` para consolidar toda la propiedad. */
  edificioId?: string | null
}

/** Error de dominio de la capa de datos. Tipado propio para que la UI pueda
 *  distinguir un fallo de datos de un error de programación cualquiera.
 *
 *  El campo se declara y asigna explícitamente en vez de usar una propiedad de
 *  parámetro (`constructor(readonly causa)`): esa azúcar de TypeScript emite
 *  código en tiempo de ejecución, y el proyecto compila con
 *  `erasableSyntaxOnly`, que solo admite sintaxis borrable por completo. */
export class FinanceApiError extends Error {
  readonly causa: unknown

  constructor(mensaje: string, causa?: unknown) {
    super(mensaje)
    this.name = 'FinanceApiError'
    this.causa = causa
  }
}
