import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PantallaCargando } from '@/components/feedback/pantalla-cargando'

/**
 * Rutas de la aplicación.
 *
 * Cada página se carga con `lazy()` para que el bundle inicial contenga solo
 * el layout y la vista de resumen. Importa especialmente acá: las páginas con
 * gráficos arrastran ECharts, y no tiene sentido pagar ese peso al entrar a
 * una pantalla que no lo usa.
 */
const PaginaResumen = lazy(() => import('@/pages/resumen-page'))
const PaginaEnConstruccion = lazy(() => import('@/pages/en-construccion-page'))

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<PantallaCargando />}>
                <PaginaResumen />
              </Suspense>
            }
          />
          {/* Las secciones restantes comparten un placeholder tipado mientras
              se implementan. Están declaradas para que el sidebar navegue de
              verdad y no a rutas muertas. */}
          {['ingresos', 'gastos', 'presupuesto', 'reserva', 'cuotas', 'morosidad', 'ajustes'].map(
            (ruta) => (
              <Route
                key={ruta}
                path={ruta}
                element={
                  <Suspense fallback={<PantallaCargando />}>
                    <PaginaEnConstruccion />
                  </Suspense>
                }
              />
            ),
          )}
          <Route
            path="*"
            element={
              <Suspense fallback={<PantallaCargando />}>
                <PaginaEnConstruccion />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
