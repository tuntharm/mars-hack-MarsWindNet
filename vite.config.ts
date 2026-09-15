/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Vite's SPA fallback otherwise serves React for static directory URLs.
function sensorDirectory(): Plugin {
  const middleware = (req: { url?: string }, _res: unknown, next: () => void) => {
    if (req.url?.split('?')[0] === '/sensor/') req.url = req.url.replace('/sensor/', '/sensor/index.html')
    next()
  }
  return {
    name: 'sensor-directory',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}

export default defineConfig({
  plugins: [sensorDirectory(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
