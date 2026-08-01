/* ============================================================================
 * DATOS MOCK — Resumen Financiero
 * ----------------------------------------------------------------------------
 * Reproduce los valores de la maqueta de referencia. Vive detrás de
 * `finance-service`, así que sustituirlo por el pipeline real de Sage 50 no
 * toca ni un componente.
 *
 * NOTA SOBRE LA REFERENCIA — la maqueta original no cerraba consigo misma y
 * hubo que reconciliarla:
 *
 *   1. "Otros 0%" en el donut. Las otras cinco categorías ya sumaban 100%,
 *      así que la sexta era una porción vacía: un slice de área cero con
 *      entrada en la leyenda. Se eliminó.
 *
 *   2. Saldo bancario vs superávit. El salto de abril (131,100) a mayo
 *      (142,580) es 11,480, pero el superávit del mes es 6,460. NO es un
 *      error: el saldo en bancos también se mueve por partidas no operativas
 *      (aportes al fondo de reserva, cobros de períodos anteriores). Se
 *      mantuvieron ambos y se agregó `movimientosNoOperativos` para que la
 *      diferencia sea explícita y auditable en vez de parecer un bug.
 *
 *   3. Los meses previos se derivaron hacia atrás desde las variaciones que
 *      la maqueta muestra (+8.7% saldo, +5.3% ingresos, -2.1% gastos, +3%
 *      cobro, -4.2% morosidad), de modo que cada porcentaje sea verificable
 *      contra la serie y no un número suelto.
 * ========================================================================== */

import type {
  CategoriaGasto,
  CuentaMorosa,
  GastoPrincipal,
  MetricaKPI,
  PagoProximo,
  Periodo,
  Propiedad,
  PuntoIngresoGasto,
  PuntoMensual,
  ResumenFinanciero,
  RubroPresupuesto,
  SaludFinanciera,
  Transaccion,
  TramoMorosidad,
} from '@/types'

/* --------------------------------------------------------------------------
 * Períodos y propiedad
 * ------------------------------------------------------------------------ */

export const PERIODO_ACTUAL: Periodo = {
  id: '2026-05',
  inicio: '2026-05-01',
  fin: '2026-05-31',
  etiqueta: 'Mayo 2026',
}

export const PERIODO_ANTERIOR: Periodo = {
  id: '2026-04',
  inicio: '2026-04-01',
  fin: '2026-04-30',
  etiqueta: 'Abril 2026',
}

/** Períodos ofrecidos en el filtro, del más reciente al más antiguo. */
export const PERIODOS_DISPONIBLES: Periodo[] = [
  PERIODO_ACTUAL,
  PERIODO_ANTERIOR,
  { id: '2026-03', inicio: '2026-03-01', fin: '2026-03-31', etiqueta: 'Marzo 2026' },
  { id: '2026-02', inicio: '2026-02-01', fin: '2026-02-28', etiqueta: 'Febrero 2026' },
  { id: '2026-01', inicio: '2026-01-01', fin: '2026-01-31', etiqueta: 'Enero 2026' },
  { id: '2025-12', inicio: '2025-12-01', fin: '2025-12-31', etiqueta: 'Diciembre 2025' },
]

export const PROPIEDADES: Propiedad[] = [
  {
    id: 'ph-clayton-park',
    nombre: 'PH Clayton Park',
    codigo: 'PH-CP',
    unidades: 84,
    edificios: [
      { id: 'torre-a', nombre: 'Torre A', unidades: 42 },
      { id: 'torre-b', nombre: 'Torre B', unidades: 42 },
    ],
  },
  {
    id: 'ph-portanova',
    nombre: 'PH Portanova',
    codigo: 'PH-PN',
    unidades: 56,
    edificios: [{ id: 'torre-unica', nombre: 'Torre Única', unidades: 56 }],
  },
  {
    id: 'ph-vita-bella',
    nombre: 'PH Vita Bella',
    codigo: 'PH-VB',
    unidades: 120,
    edificios: [
      { id: 'torre-norte', nombre: 'Torre Norte', unidades: 60 },
      { id: 'torre-sur', nombre: 'Torre Sur', unidades: 60 },
    ],
  },
]

/* --------------------------------------------------------------------------
 * Series históricas (6 meses: dic 2025 - may 2026)
 * ------------------------------------------------------------------------ */

/** Serie del saldo bancario, tal cual la maqueta de referencia. */
export const EVOLUCION_SALDO: PuntoMensual[] = [
  { periodo: '2025-12', etiqueta: 'Dic', valor: 105_200 },
  { periodo: '2026-01', etiqueta: 'Ene', valor: 112_450 },
  { periodo: '2026-02', etiqueta: 'Feb', valor: 120_300 },
  { periodo: '2026-03', etiqueta: 'Mar', valor: 125_600 },
  { periodo: '2026-04', etiqueta: 'Abr', valor: 131_100 },
  { periodo: '2026-05', etiqueta: 'May', valor: 142_580 },
]

/**
 * Ingresos y gastos mensuales. Los valores de abril están fijados para que las
 * variaciones de las KPIs sean exactas:
 *   ingresos: 64,780 / 61,520 = +5.30%
 *   gastos:   58,320 / 59,570 = -2.10%
 */
export const INGRESOS_VS_GASTOS: PuntoIngresoGasto[] = [
  { periodo: '2025-12', etiqueta: 'Dic', ingresos: 63_400, gastos: 57_180 },
  { periodo: '2026-01', etiqueta: 'Ene', ingresos: 64_150, gastos: 56_900 },
  { periodo: '2026-02', etiqueta: 'Feb', ingresos: 63_800, gastos: 57_950 },
  { periodo: '2026-03', etiqueta: 'Mar', ingresos: 62_900, gastos: 58_600 },
  { periodo: '2026-04', etiqueta: 'Abr', ingresos: 61_520, gastos: 59_570 },
  { periodo: '2026-05', etiqueta: 'May', ingresos: 64_780, gastos: 58_320 },
]

/** Fondo de reserva. Plano en mayo — de ahí el "Sin cambios" de la KPI. */
export const EVOLUCION_RESERVA: PuntoMensual[] = [
  { periodo: '2025-12', etiqueta: 'Dic', valor: 72_400 },
  { periodo: '2026-01', etiqueta: 'Ene', valor: 75_900 },
  { periodo: '2026-02', etiqueta: 'Feb', valor: 79_100 },
  { periodo: '2026-03', etiqueta: 'Mar', valor: 82_050 },
  { periodo: '2026-04', etiqueta: 'Abr', valor: 85_250 },
  { periodo: '2026-05', etiqueta: 'May', valor: 85_250 },
]

/** Serie del % de cobro, para el sparkline de esa KPI. */
export const SERIE_COBRO: number[] = [87, 88, 90, 89, 89, 92]

/** Serie de morosidad, para el sparkline. Abril = 19,572 sostiene el -4.2%. */
export const SERIE_MOROSIDAD: number[] = [21_400, 20_850, 20_100, 19_900, 19_572, 18_750]

/** Serie de ejecución presupuestaria acumulada, en %. */
export const SERIE_PRESUPUESTO: number[] = [12, 26, 39, 51, 64, 76]

/* --------------------------------------------------------------------------
 * Distribución de gastos del mes (total: 58,320)
 * ------------------------------------------------------------------------ */

export const DISTRIBUCION_GASTOS: CategoriaGasto[] = [
  { id: 'seguridad', nombre: 'Seguridad', monto: 22_162, porcentaje: 38, indiceColor: 0 },
  { id: 'limpieza', nombre: 'Limpieza', monto: 11_664, porcentaje: 20, indiceColor: 1 },
  { id: 'mantenimiento', nombre: 'Mantenimiento', monto: 10_498, porcentaje: 18, indiceColor: 3 },
  { id: 'electricidad', nombre: 'Electricidad', monto: 8_165, porcentaje: 14, indiceColor: 2 },
  { id: 'administracion', nombre: 'Administración', monto: 5_831, porcentaje: 10, indiceColor: 4 },
]

/* --------------------------------------------------------------------------
 * KPIs
 * ------------------------------------------------------------------------ */

const serieSaldo = EVOLUCION_SALDO.map((punto) => punto.valor)
const serieIngresos = INGRESOS_VS_GASTOS.map((punto) => punto.ingresos)
const serieGastos = INGRESOS_VS_GASTOS.map((punto) => punto.gastos)
const serieSuperavit = INGRESOS_VS_GASTOS.map((punto) => punto.ingresos - punto.gastos)
const serieReserva = EVOLUCION_RESERVA.map((punto) => punto.valor)

export const KPIS: MetricaKPI[] = [
  {
    id: 'saldo-bancos',
    titulo: 'Saldo en Bancos',
    valor: 142_580,
    formato: 'moneda',
    intencion: 'positive',
    serie: serieSaldo,
    comparacion: {
      variacionPorcentual: 8.7,
      variacionAbsoluta: 11_480,
      periodoComparado: 'Abr 2026',
      direccion: 'up',
      intencion: 'positive',
    },
  },
  {
    id: 'fondo-reserva',
    titulo: 'Fondo de Reserva',
    valor: 85_250,
    formato: 'moneda',
    intencion: 'positive',
    serie: serieReserva,
    // Sin `comparacion`: la variación es 0 y un badge "+0.0%" es ruido. La
    // nota comunica lo mismo con menos tinta.
    nota: 'Sin cambios',
  },
  {
    id: 'ingresos-mes',
    titulo: 'Ingresos del Mes',
    valor: 64_780,
    formato: 'moneda',
    intencion: 'informative',
    serie: serieIngresos,
    comparacion: {
      variacionPorcentual: 5.3,
      variacionAbsoluta: 3_260,
      periodoComparado: 'Abr 2026',
      direccion: 'up',
      intencion: 'positive',
    },
  },
  {
    id: 'gastos-mes',
    titulo: 'Gastos del Mes',
    valor: 58_320,
    formato: 'moneda',
    intencion: 'negative',
    serie: serieGastos,
    comparacion: {
      variacionPorcentual: -2.1,
      variacionAbsoluta: -1_250,
      periodoComparado: 'Abr 2026',
      direccion: 'down',
      // Gastos que BAJAN son buena noticia: por eso la intención no se puede
      // derivar de la dirección de la flecha.
      intencion: 'positive',
    },
  },
  {
    id: 'superavit-deficit',
    titulo: 'Superávit / Déficit',
    valor: 6_460,
    formato: 'moneda',
    intencion: 'accent',
    serie: serieSuperavit,
    nota: 'Superávit',
  },
  {
    id: 'cobro-cuotas',
    titulo: '% de Cobro de Cuotas',
    valor: 92,
    formato: 'porcentaje',
    intencion: 'positive',
    serie: SERIE_COBRO,
    comparacion: {
      variacionPorcentual: 3,
      periodoComparado: 'Abr 2026',
      direccion: 'up',
      intencion: 'positive',
    },
  },
  {
    id: 'morosidad-total',
    titulo: 'Morosidad Total',
    valor: 18_750,
    formato: 'moneda',
    intencion: 'caution',
    serie: SERIE_MOROSIDAD,
    comparacion: {
      variacionPorcentual: -4.2,
      variacionAbsoluta: -822,
      periodoComparado: 'Abr 2026',
      direccion: 'down',
      intencion: 'positive',
    },
  },
  {
    id: 'presupuesto-ejecutado',
    titulo: 'Presupuesto Ejecutado',
    valor: 76,
    formato: 'porcentaje',
    intencion: 'informative',
    serie: SERIE_PRESUPUESTO,
    nota: 'Del presupuesto anual',
  },
]

/* --------------------------------------------------------------------------
 * Salud financiera
 * ------------------------------------------------------------------------ */

export const SALUD_FINANCIERA: SaludFinanciera = {
  nivel: 'buena',
  puntaje: 82,
  etiqueta: 'Buena',
  descripcion: 'Las finanzas del edificio se encuentran en una condición saludable.',
  factores: [
    { etiqueta: 'Cobro de cuotas sobre 90%', aporte: 25, cumple: true },
    { etiqueta: 'Superávit operativo positivo', aporte: 25, cumple: true },
    { etiqueta: 'Reserva sobre 3 meses de gasto', aporte: 22, cumple: true },
    { etiqueta: 'Morosidad bajo 5% del ingreso anual', aporte: 10, cumple: false },
  ],
}

/* --------------------------------------------------------------------------
 * Presupuesto vs real (acumulado del año)
 * ------------------------------------------------------------------------ */

export const PRESUPUESTO_VS_REAL: RubroPresupuesto[] = [
  {
    id: 'seguridad',
    nombre: 'Seguridad',
    presupuestado: 115_000,
    ejecutado: 108_400,
    ejecucionPorcentual: 94.3,
  },
  {
    id: 'limpieza',
    nombre: 'Limpieza',
    presupuestado: 62_000,
    ejecutado: 57_900,
    ejecucionPorcentual: 93.4,
  },
  {
    id: 'mantenimiento',
    nombre: 'Mantenimiento',
    presupuestado: 48_000,
    ejecutado: 52_300,
    ejecucionPorcentual: 109.0,
  },
  {
    id: 'electricidad',
    nombre: 'Electricidad',
    presupuestado: 44_000,
    ejecutado: 40_100,
    ejecucionPorcentual: 91.1,
  },
  {
    id: 'administracion',
    nombre: 'Administración',
    presupuestado: 30_000,
    ejecutado: 28_600,
    ejecucionPorcentual: 95.3,
  },
]

/* --------------------------------------------------------------------------
 * Morosidad por antigüedad (total: 18,750)
 * ------------------------------------------------------------------------ */

export const ANTIGUEDAD_MOROSIDAD: TramoMorosidad[] = [
  { tramo: '0-30', etiqueta: '0 a 30 días', monto: 6_420, unidades: 14, severidad: 'informative' },
  { tramo: '31-60', etiqueta: '31 a 60 días', monto: 4_980, unidades: 9, severidad: 'caution' },
  { tramo: '61-90', etiqueta: '61 a 90 días', monto: 3_650, unidades: 6, severidad: 'caution' },
  { tramo: '90+', etiqueta: 'Más de 90 días', monto: 3_700, unidades: 5, severidad: 'negative' },
]

/* --------------------------------------------------------------------------
 * Tablas
 * ------------------------------------------------------------------------ */

export const TRANSACCIONES_RECIENTES: Transaccion[] = [
  {
    id: 'tx-1',
    fecha: '2026-05-28',
    descripcion: 'Cuota de mantenimiento — Mayo',
    contraparte: 'Apto. 12-B',
    categoria: 'Cuotas',
    tipo: 'ingreso',
    monto: 385,
    referencia: 'REC-4821',
    estado: 'conciliado',
  },
  {
    id: 'tx-2',
    fecha: '2026-05-27',
    descripcion: 'Servicio de seguridad — Mayo',
    contraparte: 'Seguridad Omega S.A.',
    categoria: 'Seguridad',
    tipo: 'gasto',
    monto: 22_162,
    referencia: 'FAC-9014',
    estado: 'conciliado',
  },
  {
    id: 'tx-3',
    fecha: '2026-05-26',
    descripcion: 'Consumo eléctrico áreas comunes',
    contraparte: 'ENSA',
    categoria: 'Electricidad',
    tipo: 'gasto',
    monto: 8_165,
    referencia: 'FAC-8877',
    estado: 'conciliado',
  },
  {
    id: 'tx-4',
    fecha: '2026-05-25',
    descripcion: 'Cuota de mantenimiento — Mayo',
    contraparte: 'Apto. 7-A',
    categoria: 'Cuotas',
    tipo: 'ingreso',
    monto: 385,
    referencia: 'REC-4820',
    estado: 'conciliado',
  },
  {
    id: 'tx-5',
    fecha: '2026-05-24',
    descripcion: 'Reparación bomba de agua',
    contraparte: 'Hidrotec Panamá',
    categoria: 'Mantenimiento',
    tipo: 'gasto',
    monto: 2_840,
    referencia: 'FAC-8801',
    estado: 'pendiente',
  },
  {
    id: 'tx-6',
    fecha: '2026-05-22',
    descripcion: 'Limpieza áreas comunes — Mayo',
    contraparte: 'Servilimp S.A.',
    categoria: 'Limpieza',
    tipo: 'gasto',
    monto: 11_664,
    referencia: 'FAC-8790',
    estado: 'conciliado',
  },
  {
    id: 'tx-7',
    fecha: '2026-05-20',
    descripcion: 'Alquiler salón de eventos',
    contraparte: 'Apto. 15-C',
    categoria: 'Otros ingresos',
    tipo: 'ingreso',
    monto: 250,
    referencia: 'REC-4815',
    estado: 'conciliado',
  },
  {
    id: 'tx-8',
    fecha: '2026-05-18',
    descripcion: 'Honorarios de administración',
    contraparte: 'Mardem Administración',
    categoria: 'Administración',
    tipo: 'gasto',
    monto: 5_831,
    referencia: 'FAC-8771',
    estado: 'conciliado',
  },
]

export const CUENTAS_MOROSAS: CuentaMorosa[] = [
  {
    id: 'mor-1',
    unidad: 'Apto. 3-C',
    propietario: 'Rodríguez Herrera, L.',
    monto: 2_310,
    diasVencido: 187,
    tramo: '90+',
    ultimoPago: '2025-11-15',
  },
  {
    id: 'mor-2',
    unidad: 'Apto. 9-A',
    propietario: 'Castillo Mendoza, R.',
    monto: 1_925,
    diasVencido: 152,
    tramo: '90+',
    ultimoPago: '2025-12-20',
  },
  {
    id: 'mor-3',
    unidad: 'Apto. 14-D',
    propietario: 'Ng Villalobos, A.',
    monto: 1_540,
    diasVencido: 118,
    tramo: '90+',
    ultimoPago: '2026-01-22',
  },
  {
    id: 'mor-4',
    unidad: 'Apto. 6-B',
    propietario: 'Batista Sáenz, M.',
    monto: 1_155,
    diasVencido: 87,
    tramo: '61-90',
    ultimoPago: '2026-02-25',
  },
  {
    id: 'mor-5',
    unidad: 'Apto. 11-A',
    propietario: 'De León Ortiz, C.',
    monto: 1_155,
    diasVencido: 74,
    tramo: '61-90',
    ultimoPago: '2026-03-10',
  },
  {
    id: 'mor-6',
    unidad: 'Apto. 2-D',
    propietario: 'Samaniego Ruiz, P.',
    monto: 770,
    diasVencido: 52,
    tramo: '31-60',
    ultimoPago: '2026-04-02',
  },
  {
    id: 'mor-7',
    unidad: 'Apto. 8-C',
    propietario: 'Arosemena Gil, J.',
    monto: 385,
    diasVencido: 27,
    tramo: '0-30',
    ultimoPago: '2026-04-28',
  },
]

export const GASTOS_PRINCIPALES: GastoPrincipal[] = [
  {
    id: 'gp-1',
    proveedor: 'Seguridad Omega S.A.',
    categoria: 'Seguridad',
    monto: 22_162,
    porcentajeDelTotal: 38,
    variacionPorcentual: 0,
  },
  {
    id: 'gp-2',
    proveedor: 'Servilimp S.A.',
    categoria: 'Limpieza',
    monto: 11_664,
    porcentajeDelTotal: 20,
    variacionPorcentual: 1.8,
  },
  {
    id: 'gp-3',
    proveedor: 'ENSA',
    categoria: 'Electricidad',
    monto: 8_165,
    porcentajeDelTotal: 14,
    variacionPorcentual: -6.4,
  },
  {
    id: 'gp-4',
    proveedor: 'Mardem Administración',
    categoria: 'Administración',
    monto: 5_831,
    porcentajeDelTotal: 10,
    variacionPorcentual: 0,
  },
  {
    id: 'gp-5',
    proveedor: 'Hidrotec Panamá',
    categoria: 'Mantenimiento',
    monto: 2_840,
    porcentajeDelTotal: 4.9,
    variacionPorcentual: 42.3,
  },
]

export const PAGOS_PROXIMOS: PagoProximo[] = [
  {
    id: 'pp-1',
    concepto: 'Póliza de seguro del edificio',
    proveedor: 'ASSA Compañía de Seguros',
    monto: 4_850,
    fechaVencimiento: '2026-06-05',
    diasRestantes: 5,
    estado: 'por-vencer',
  },
  {
    id: 'pp-2',
    concepto: 'Servicio de seguridad — Junio',
    proveedor: 'Seguridad Omega S.A.',
    monto: 22_162,
    fechaVencimiento: '2026-06-10',
    diasRestantes: 10,
    estado: 'programado',
  },
  {
    id: 'pp-3',
    concepto: 'Mantenimiento de ascensores',
    proveedor: 'Otis Panamá',
    monto: 3_400,
    fechaVencimiento: '2026-06-12',
    diasRestantes: 12,
    estado: 'programado',
  },
  {
    id: 'pp-4',
    concepto: 'Reparación bomba de agua',
    proveedor: 'Hidrotec Panamá',
    monto: 2_840,
    fechaVencimiento: '2026-05-30',
    diasRestantes: -1,
    estado: 'vencido',
  },
  {
    id: 'pp-5',
    concepto: 'Limpieza áreas comunes — Junio',
    proveedor: 'Servilimp S.A.',
    monto: 11_664,
    fechaVencimiento: '2026-06-15',
    diasRestantes: 15,
    estado: 'programado',
  },
]

/* --------------------------------------------------------------------------
 * Agregado
 * ------------------------------------------------------------------------ */

/** Diferencia entre el movimiento del saldo bancario y el superávit del mes,
 *  explicada por partidas no operativas. Ver nota (2) al inicio del archivo. */
export const MOVIMIENTOS_NO_OPERATIVOS = 5_020

export const RESUMEN_MOCK: ResumenFinanciero = {
  periodo: PERIODO_ACTUAL,
  periodoComparacion: PERIODO_ANTERIOR,
  propiedad: PROPIEDADES[0]!,
  kpis: KPIS,
  salud: SALUD_FINANCIERA,
  ingresosVsGastos: INGRESOS_VS_GASTOS,
  evolucionSaldo: EVOLUCION_SALDO,
  distribucionGastos: DISTRIBUCION_GASTOS,
  evolucionReserva: EVOLUCION_RESERVA,
  presupuestoVsReal: PRESUPUESTO_VS_REAL,
  antiguedadMorosidad: ANTIGUEDAD_MOROSIDAD,
  transaccionesRecientes: TRANSACCIONES_RECIENTES,
  cuentasMorosas: CUENTAS_MOROSAS,
  gastosPrincipales: GASTOS_PRINCIPALES,
  pagosProximos: PAGOS_PROXIMOS,
  generadoEn: '2026-05-31T18:00:00-05:00',
}
