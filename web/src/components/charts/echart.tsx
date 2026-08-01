import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

/**
 * Registro explícito de módulos de ECharts.
 *
 * Importamos desde `echarts/core` y registramos solo lo que usamos, en vez de
 * `import * as echarts from 'echarts'`. El paquete completo son ~1 MB sin
 * comprimir; así el chunk baja a una fracción y el tree-shaking funciona de
 * verdad. Agregar un tipo de gráfico nuevo exige registrarlo acá — es
 * intencional: obliga a que el costo del bundle sea una decisión consciente.
 */
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  MarkLineComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
])

export type OpcionesECharts = echarts.EChartsCoreOption

export interface EChartProps {
  opciones: OpcionesECharts
  /** Alto del contenedor. ECharts necesita un alto concreto: sobre un padre
   *  sin altura el canvas se renderiza en 0px. */
  alto?: number | string
  className?: string
  /** Descripción para lectores de pantalla. El canvas es opaco para la
   *  accesibilidad, así que sin esto el gráfico no existe para quien no lo ve. */
  descripcionAccesible: string
  /** Reemplaza las opciones en vez de fusionarlas. Necesario cuando cambia la
   *  cantidad de series: la fusión dejaría vivas las series anteriores. */
  reemplazarAlActualizar?: boolean
}

/**
 * Envoltorio de ECharts sobre React.
 *
 * Resuelve las tres cosas que se rompen al integrar ECharts a mano:
 *   1. Ciclo de vida: init/dispose atados al montaje, sin fugas de instancia.
 *   2. Resize: `ResizeObserver` sobre el contenedor. Escuchar `window.resize`
 *      no alcanza — el sidebar al colapsar cambia el ancho del gráfico sin que
 *      la ventana cambie de tamaño.
 *   3. Actualización: `setOption` sobre la instancia existente en vez de
 *      recrearla, para conservar las animaciones de transición entre estados.
 */
export function EChart({
  opciones,
  alto = 280,
  className,
  descripcionAccesible,
  reemplazarAlActualizar = false,
}: EChartProps) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const instanciaRef = useRef<echarts.ECharts | null>(null)

  // Montaje: crea la instancia y la mantiene ajustada al contenedor.
  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!contenedor) return

    const instancia = echarts.init(contenedor, undefined, { renderer: 'canvas' })
    instanciaRef.current = instancia

    const observador = new ResizeObserver(() => {
      instancia.resize({ animation: { duration: 150 } })
    })
    observador.observe(contenedor)

    return () => {
      observador.disconnect()
      instancia.dispose()
      instanciaRef.current = null
    }
  }, [])

  // Actualización de datos/estilos.
  // Actualización de datos/estilos. Corre después del efecto de montaje, así
  // que `instanciaRef.current` ya existe.
  //
  // `lazyUpdate: true` difiere el repintado al siguiente frame de animación.
  // Vale la pena saberlo al depurar: en una pestaña en segundo plano
  // `requestAnimationFrame` no corre, así que el gráfico queda inicializado
  // pero sin canvas hasta que la pestaña vuelve a primer plano. Es el
  // comportamiento correcto (no gastar CPU en lo invisible), pero parece un
  // bug si uno inspecciona el DOM desde fuera.
  useEffect(() => {
    instanciaRef.current?.setOption(opciones, {
      notMerge: reemplazarAlActualizar,
      lazyUpdate: true,
    })
  }, [opciones, reemplazarAlActualizar])

  return (
    <div
      ref={contenedorRef}
      className={cn('w-full', className)}
      style={{ height: alto }}
      // El contenido del canvas es inaccesible: `img` + `aria-label` le dan al
      // lector de pantalla al menos el resumen de qué muestra el gráfico.
      role="img"
      aria-label={descripcionAccesible}
    />
  )
}
