/* ============================================================================
 * MODELO DE DOMINIO FINANCIERO
 * ----------------------------------------------------------------------------
 * El contrato que la UI consume. Deliberadamente agnóstico de la fuente: hoy
 * lo sirve un mock, mañana el pipeline de Sage 50 — mientras el adapter
 * devuelva estas formas, ningún componente se entera del cambio.
 *
 * Regla del modelo: los importes son SIEMPRE `number` en unidades de moneda
 * (no centavos, no strings). El formato es responsabilidad de `lib/format`,
 * nunca del dato.
 * ========================================================================== */

/* --------------------------------------------------------------------------
 * Primitivas transversales
 * ------------------------------------------------------------------------ */

/**
 * Intención semántica de un valor. Es lo que decide su color, y está separada
 * de la dirección de la tendencia a propósito: en "Gastos del Mes" una flecha
 * hacia abajo es una BUENA noticia, así que dirección e intención no se
 * pueden derivar una de la otra.
 */
export type IntencionSemantica =
  | 'positive'
  | 'negative'
  | 'caution'
  | 'informative'
  | 'accent'
  | 'neutral'

/** Hacia dónde se movió el valor respecto del período comparado. */
export type DireccionTendencia = 'up' | 'down' | 'flat'

/** Cómo se renderiza un valor numérico. */
export type FormatoValor = 'moneda' | 'porcentaje' | 'numero'

/** Estado de carga de un recurso, para los estados de UI. */
export type EstadoRecurso = 'cargando' | 'listo' | 'vacio' | 'error'

/* --------------------------------------------------------------------------
 * Períodos
 * ------------------------------------------------------------------------ */

/**
 * Un período contable. `id` es ISO 'YYYY-MM' para poder ordenar
 * lexicográficamente sin parsear.
 */
export interface Periodo {
  /** 'YYYY-MM', p. ej. '2026-05' */
  id: string
  /** Primer día del período, ISO. */
  inicio: string
  /** Último día del período, ISO. */
  fin: string
  /** Etiqueta lista para UI: 'Mayo 2026'. */
  etiqueta: string
}

/* --------------------------------------------------------------------------
 * Propiedades / edificios
 * ------------------------------------------------------------------------ */

export interface Propiedad {
  id: string
  nombre: string
  /** Código corto para chips y tablas: 'PH-CP'. */
  codigo: string
  /** Edificios/torres dentro de la propiedad. Una PH puede tener varias. */
  edificios: Edificio[]
  unidades: number
}

export interface Edificio {
  id: string
  nombre: string
  unidades: number
}

/* --------------------------------------------------------------------------
 * KPIs
 * ------------------------------------------------------------------------ */

/**
 * Identificadores de las KPIs del resumen. Unión cerrada (no `string`) para
 * que agregar una tarjeta obligue a completar su icono y su orden — el
 * compilador atrapa el olvido en vez de renderizar una card sin icono.
 */
export type KpiId =
  | 'saldo-bancos'
  | 'fondo-reserva'
  | 'ingresos-mes'
  | 'gastos-mes'
  | 'superavit-deficit'
  | 'cobro-cuotas'
  | 'morosidad-total'
  | 'presupuesto-ejecutado'
  | 'salud-financiera'

/** Comparación contra el período anterior. */
export interface Comparacion {
  /** Variación porcentual. 8.7 significa +8.7%, no 0.087. */
  variacionPorcentual: number
  /** Diferencia absoluta en unidades de moneda, si aplica. */
  variacionAbsoluta?: number
  /** Etiqueta del período comparado: 'Abr 2026'. */
  periodoComparado: string
  direccion: DireccionTendencia
  /**
   * Si la dirección del movimiento es buena o mala para el negocio. Se envía
   * explícito porque no se puede inferir: gastos que bajan = 'positive',
   * ingresos que bajan = 'negative'.
   */
  intencion: IntencionSemantica
}

/**
 * Una tarjeta de KPI del resumen ejecutivo.
 */
export interface MetricaKPI {
  id: KpiId
  titulo: string
  valor: number
  formato: FormatoValor
  /** Color del valor. */
  intencion: IntencionSemantica
  /** Decimales del valor. Por defecto 0. */
  decimales?: number
  /** Comparación contra el período anterior. Ausente si no aplica. */
  comparacion?: Comparacion
  /**
   * Serie histórica para el sparkline. Suficiente con los últimos 6-12
   * puntos: el sparkline muestra forma, no valores exactos.
   */
  serie?: number[]
  /**
   * Texto en lugar de la comparación, cuando no hay variación que mostrar
   * ('Sin cambios', 'Del presupuesto anual', 'Superávit').
   */
  nota?: string
}

/* --------------------------------------------------------------------------
 * Salud financiera (el "semáforo")
 * ------------------------------------------------------------------------ */

export type NivelSalud = 'buena' | 'regular' | 'critica'

export interface SaludFinanciera {
  nivel: NivelSalud
  /** Puntaje 0-100 que respalda el nivel. */
  puntaje: number
  etiqueta: string
  descripcion: string
  /** Factores que explican el puntaje, para el tooltip de detalle. */
  factores: FactorSalud[]
}

export interface FactorSalud {
  etiqueta: string
  /** Aporte al puntaje, positivo o negativo. */
  aporte: number
  cumple: boolean
}

/* --------------------------------------------------------------------------
 * Series para gráficos
 * ------------------------------------------------------------------------ */

/** Un punto de una serie temporal mensual. */
export interface PuntoMensual {
  /** 'YYYY-MM' */
  periodo: string
  /** Etiqueta corta para el eje: 'Abr'. */
  etiqueta: string
  valor: number
}

/** Ingresos y gastos del mismo mes, para el gráfico de barras agrupadas. */
export interface PuntoIngresoGasto {
  periodo: string
  etiqueta: string
  ingresos: number
  gastos: number
}

/** Categoría del donut de distribución de gastos. */
export interface CategoriaGasto {
  id: string
  nombre: string
  monto: number
  /** Participación sobre el total, 0-100. */
  porcentaje: number
  /** Índice de la serie de color (--chart-1..8). */
  indiceColor: number
}

/** Comparación presupuesto vs ejecutado por rubro. */
export interface RubroPresupuesto {
  id: string
  nombre: string
  presupuestado: number
  ejecutado: number
  /** Ejecutado / presupuestado * 100. */
  ejecucionPorcentual: number
}

/** Tramo de antigüedad de la morosidad. */
export interface TramoMorosidad {
  /** '0-30', '31-60', '61-90', '90+' */
  tramo: string
  etiqueta: string
  monto: number
  unidades: number
  /** Sube con la antigüedad: tiñe el tramo de verde a rojo. */
  severidad: IntencionSemantica
}

/* --------------------------------------------------------------------------
 * Tablas
 * ------------------------------------------------------------------------ */

export type TipoTransaccion = 'ingreso' | 'gasto'

export interface Transaccion {
  id: string
  fecha: string
  descripcion: string
  /** Unidad o proveedor asociado. */
  contraparte: string
  categoria: string
  tipo: TipoTransaccion
  monto: number
  /** Referencia del asiento en el sistema contable. */
  referencia: string
  estado: EstadoTransaccion
}

export type EstadoTransaccion = 'conciliado' | 'pendiente' | 'anulado'

export interface CuentaMorosa {
  id: string
  unidad: string
  propietario: string
  monto: number
  /** Días transcurridos desde el vencimiento más antiguo. */
  diasVencido: number
  tramo: string
  ultimoPago: string | null
}

export interface GastoPrincipal {
  id: string
  proveedor: string
  categoria: string
  monto: number
  /** Participación sobre el gasto total del período, 0-100. */
  porcentajeDelTotal: number
  variacionPorcentual: number
}

export interface PagoProximo {
  id: string
  concepto: string
  proveedor: string
  monto: number
  fechaVencimiento: string
  /** Días hasta el vencimiento. Negativo = ya vencido. */
  diasRestantes: number
  estado: EstadoPago
}

export type EstadoPago = 'programado' | 'por-vencer' | 'vencido'

/* --------------------------------------------------------------------------
 * Agregado del dashboard
 * ------------------------------------------------------------------------ */

/**
 * Todo lo que necesita la vista de resumen, en una sola forma. Un único
 * agregado (en vez de nueve endpoints sueltos) mantiene la pantalla coherente:
 * es imposible que las KPIs muestren mayo y los gráficos abril.
 */
export interface ResumenFinanciero {
  periodo: Periodo
  periodoComparacion: Periodo
  propiedad: Propiedad
  kpis: MetricaKPI[]
  salud: SaludFinanciera
  ingresosVsGastos: PuntoIngresoGasto[]
  evolucionSaldo: PuntoMensual[]
  distribucionGastos: CategoriaGasto[]
  evolucionReserva: PuntoMensual[]
  presupuestoVsReal: RubroPresupuesto[]
  antiguedadMorosidad: TramoMorosidad[]
  transaccionesRecientes: Transaccion[]
  cuentasMorosas: CuentaMorosa[]
  gastosPrincipales: GastoPrincipal[]
  pagosProximos: PagoProximo[]
  /** Momento en que se generaron los datos, para el "actualizado hace X". */
  generadoEn: string
}
