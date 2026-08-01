import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// El alias `@` apunta a `src` para que los imports no degeneren en `../../../`
// a medida que crece la profundidad de las features.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Separamos las dependencias pesadas en chunks propios: ECharts pesa mucho
    // más que el resto del bundle y cambia con muy baja frecuencia, así que
    // aislarlo mantiene el cache del navegador vivo entre despliegues.
    // Forma de función (no de objeto) porque el bundler de Vite 8 solo tipa
    // `manualChunks` como ManualChunksFunction.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('echarts') || id.includes('zrender')) return 'echarts'
          if (id.includes('@tanstack')) return 'query'
          if (id.includes('react-router') || id.includes('/react-dom/') || id.includes('/react/')) {
            return 'react'
          }
          return undefined
        },
      },
    },
  },
})
