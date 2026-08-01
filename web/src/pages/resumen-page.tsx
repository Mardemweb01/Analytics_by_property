import { LoadingChartCard } from '@/components/cards/loading-card'
import { SectionHeader } from '@/components/dashboard/section-header'
import { ErrorCard } from '@/components/feedback/error-card'
import { FilterBar } from '@/components/filters/filter-bar'
import { GraficoDistribucionGastos } from '@/features/dashboard/components/grafico-distribucion-gastos'
import { GraficoEvolucionSaldo } from '@/features/dashboard/components/grafico-evolucion-saldo'
import { GraficoIngresosGastos } from '@/features/dashboard/components/grafico-ingresos-gastos'
import { GraficoMorosidad } from '@/features/dashboard/components/grafico-morosidad'
import { GraficoPresupuesto } from '@/features/dashboard/components/grafico-presupuesto'
import { GraficoReserva } from '@/features/dashboard/components/grafico-reserva'
import { GrillaKpis } from '@/features/dashboard/components/grilla-kpis'
import { TablaGastosPrincipales } from '@/features/dashboard/components/tabla-gastos-principales'
import { TablaMorosidad } from '@/features/dashboard/components/tabla-morosidad'
import { TablaPagosProximos } from '@/features/dashboard/components/tabla-pagos-proximos'
import { TablaTransacciones } from '@/features/dashboard/components/tabla-transacciones'
import { useFiltrosDashboard } from '@/features/dashboard/hooks/use-filtros-dashboard'
import {
  usePeriodos,
  usePropiedades,
  useResumenFinanciero,
} from '@/features/dashboard/hooks/use-resumen-financiero'

/**
 * Vista de Resumen Financiero.
 *
 * La página solo compone: decide QUÉ bloques se muestran y en qué orden. No
 * calcula, no formatea y no habla con la red — eso vive en los hooks de la
 * feature y en los componentes. Por eso se lee de un vistazo pese a ser la
 * pantalla más densa del producto.
 */
export default function PaginaResumen() {
  const {
    filtros,
    parametros,
    cambiarPeriodo,
    cambiarComparacion,
    cambiarPropiedad,
    cambiarEdificio,
  } = useFiltrosDashboard()

  const { data: resumen, isPending, isError, error, refetch, isFetching } = useResumenFinanciero(parametros)
  const { data: periodos = [] } = usePeriodos()
  const { data: propiedades = [] } = usePropiedades()

  const propiedadActiva = propiedades.find((item) => item.id === filtros.propiedadId)

  const barraFiltros = (
    <FilterBar
      propiedades={propiedades.map((item) => ({ valor: item.id, etiqueta: item.nombre }))}
      propiedadId={filtros.propiedadId}
      alCambiarPropiedad={cambiarPropiedad}
      edificios={
        propiedadActiva?.edificios.map((item) => ({ valor: item.id, etiqueta: item.nombre })) ?? []
      }
      edificioId={filtros.edificioId}
      alCambiarEdificio={cambiarEdificio}
      periodos={periodos.map((item) => ({ valor: item.id, etiqueta: item.etiqueta }))}
      periodoId={filtros.periodoId}
      alCambiarPeriodo={cambiarPeriodo}
      comparacionId={filtros.comparacionId}
      alCambiarComparacion={cambiarComparacion}
      alRefrescar={() => void refetch()}
      refrescando={isFetching}
      alExportar={() => window.print()}
    />
  )

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        <SectionHeader
          nivel="h1"
          titulo="Resumen Financiero del Edificio"
          descripcion="Una vista rápida de la situación financiera de nuestro edificio."
        />
        <ErrorCard
          alReintentar={() => void refetch()}
          reintentando={isFetching}
          detalleTecnico={error instanceof Error ? error.message : undefined}
          className="min-h-[320px]"
        />
      </div>
    )
  }

  const comparacionSaldo = resumen?.kpis.find((kpi) => kpi.id === 'saldo-bancos')?.comparacion
  const totalGastos = resumen?.distribucionGastos.reduce((suma, item) => suma + item.monto, 0) ?? 0

  /** Gasto operativo mensual promedio de la serie, base del "mínimo
   *  recomendado" (3 meses) que marca el gráfico de reserva. */
  const gastoMensualPromedio = resumen?.ingresosVsGastos.length
    ? resumen.ingresosVsGastos.reduce((suma, punto) => suma + punto.gastos, 0) /
      resumen.ingresosVsGastos.length
    : undefined

  return (
    <div className="flex flex-col gap-6">
      {/* Título y filtros en filas separadas. La referencia los pone en la
          misma línea, pero ahí había 3 controles; acá son 6 (el brief pide
          además Propiedad, Edificio y Refrescar) y comprimirlos contra un
          título de 36px los volvía ilegibles por debajo de 1440px. */}
      <SectionHeader
        nivel="h1"
        titulo="Resumen Financiero del Edificio"
        descripcion={
          resumen
            ? `${resumen.propiedad.nombre} · ${resumen.periodo.etiqueta} · comparado con ${resumen.periodoComparacion.etiqueta}`
            : 'Una vista rápida de la situación financiera de nuestro edificio.'
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        {barraFiltros}
      </div>

      <GrillaKpis
        kpis={resumen?.kpis ?? []}
        salud={
          resumen?.salud ?? {
            nivel: 'buena',
            puntaje: 0,
            etiqueta: '—',
            descripcion: '',
            factores: [],
          }
        }
        cargando={isPending}
      />

      {/* Fila principal de gráficos. En 1280+ van los tres en fila; por debajo
          el donut baja a ancho completo porque su leyenda de 5 filas no entra
          cómoda en media pantalla. */}
      <section
        aria-label="Gráficos principales del período"
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
      >
        {isPending ? (
          <>
            <LoadingChartCard />
            <LoadingChartCard />
            <LoadingChartCard className="lg:col-span-2 xl:col-span-1" />
          </>
        ) : resumen ? (
          <>
            <GraficoIngresosGastos datos={resumen.ingresosVsGastos} indice={0} />
            <GraficoEvolucionSaldo
              datos={resumen.evolucionSaldo}
              {...(comparacionSaldo ? { comparacion: comparacionSaldo } : {})}
              indice={1}
            />
            <GraficoDistribucionGastos
              datos={resumen.distribucionGastos}
              total={totalGastos}
              indice={2}
              className="lg:col-span-2 xl:col-span-1"
            />
          </>
        ) : null}
      </section>

      <section
        aria-label="Análisis de presupuesto, reserva y morosidad"
        className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
      >
        {isPending ? (
          <>
            <LoadingChartCard />
            <LoadingChartCard />
            <LoadingChartCard className="lg:col-span-2 xl:col-span-1" />
          </>
        ) : resumen ? (
          <>
            <GraficoPresupuesto datos={resumen.presupuestoVsReal} indice={3} />
            <GraficoReserva
              datos={resumen.evolucionReserva}
              gastoMensualPromedio={gastoMensualPromedio}
              indice={4}
            />
            <GraficoMorosidad
              datos={resumen.antiguedadMorosidad}
              indice={5}
              className="lg:col-span-2 xl:col-span-1"
            />
          </>
        ) : null}
      </section>

      {/* Tablas. Dos columnas en escritorio: cada par responde una pregunta
          distinta (qué entró/salió, y qué falta cobrar/pagar). */}
      <section aria-label="Detalle de movimientos y cuentas" className="flex flex-col gap-4">
        <TablaTransacciones
          transacciones={resumen?.transaccionesRecientes ?? []}
          cargando={isPending}
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TablaMorosidad cuentas={resumen?.cuentasMorosas ?? []} cargando={isPending} />
          <TablaPagosProximos pagos={resumen?.pagosProximos ?? []} cargando={isPending} />
        </div>

        <TablaGastosPrincipales gastos={resumen?.gastosPrincipales ?? []} cargando={isPending} />
      </section>
    </div>
  )
}
