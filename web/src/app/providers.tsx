import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { QUERY_CONFIG } from '@/constants/app'
import { SidebarProvider } from '@/store/sidebar-store'

/**
 * Providers de la aplicación, en el orden en que se necesitan.
 *
 * El `QueryClient` se crea con `useState` y no como constante de módulo: una
 * constante compartiría cache entre tests y entre instancias durante HMR, que
 * es una fuente clásica de tests que pasan aislados y fallan en conjunto.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: QUERY_CONFIG.staleTime,
            gcTime: QUERY_CONFIG.gcTime,
            retry: QUERY_CONFIG.retry,
            // Los datos de un período contable cerrado no cambian al volver a
            // la pestaña; refetchear ahí solo haría parpadear los gráficos.
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider>{children}</SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
