import {
  Activity,
  ChartPie,
  Landmark,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { IntencionSemantica, KpiId } from '@/types'

/**
 * Icono de cada KPI. Vive acá y no en el mock porque es una decisión de
 * presentación, no un dato: si mañana los KPIs vienen de una API, el backend
 * no debería estar eligiendo iconos de Lucide.
 *
 * `Record<KpiId, ...>` (no `Partial`) obliga a que agregar un `KpiId` nuevo
 * rompa la compilación hasta que se le asigne icono.
 */
export const ICONO_KPI: Record<KpiId, LucideIcon> = {
  'saldo-bancos': Landmark,
  'fondo-reserva': ShieldCheck,
  'ingresos-mes': TrendingUp,
  'gastos-mes': TrendingDown,
  'superavit-deficit': Wallet,
  'cobro-cuotas': Users,
  'morosidad-total': TriangleAlert,
  'presupuesto-ejecutado': ChartPie,
  'salud-financiera': Activity,
}

/**
 * Clases del contenedor circular del icono, por intención.
 *
 * Se resuelven con un mapa de literales completos y no con interpolación
 * (`bg-${intencion}-subtle`): Tailwind escanea el código fuente en busca de
 * clases literales, y una clase construida en runtime nunca llega al CSS
 * final. Es el error más común al "parametrizar" estilos con Tailwind.
 */
export const CLASES_ICONO_INTENCION: Record<IntencionSemantica, string> = {
  positive: 'bg-positive-subtle text-positive ring-positive-border',
  negative: 'bg-negative-subtle text-negative ring-negative-border',
  caution: 'bg-caution-subtle text-caution ring-caution-border',
  informative: 'bg-informative-subtle text-informative ring-informative-border',
  accent: 'bg-accent-subtle text-accent ring-accent-border',
  neutral: 'bg-surface-sunken text-foreground-muted ring-border',
}

/** Color del valor numérico, por intención. */
export const CLASES_VALOR_INTENCION: Record<IntencionSemantica, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  caution: 'text-caution-strong',
  informative: 'text-informative',
  accent: 'text-accent',
  neutral: 'text-foreground',
}

/** Colores del badge de comparación, por intención. */
export const CLASES_BADGE_INTENCION: Record<IntencionSemantica, string> = {
  positive: 'text-positive-foreground',
  negative: 'text-negative-foreground',
  caution: 'text-caution-foreground',
  informative: 'text-informative-foreground',
  accent: 'text-accent-foreground',
  neutral: 'text-foreground-muted',
}

/**
 * Color del sparkline. Son clases `text-*` y no `stroke-*` a propósito: el
 * componente pinta el trazo con `stroke="currentColor"` y el degradado del
 * área con `stopColor="currentColor"`. `currentColor` resuelve contra la
 * propiedad `color`, así que una clase `stroke-*` teñiría la línea pero
 * dejaría el degradado heredando el color del texto de la card.
 */
export const CLASES_SPARKLINE_INTENCION: Record<IntencionSemantica, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  caution: 'text-caution',
  informative: 'text-informative',
  accent: 'text-accent',
  neutral: 'text-foreground-subtle',
}
