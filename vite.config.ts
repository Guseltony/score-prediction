import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all .env variables (including non-VITE_ prefixed)
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.VITE_API_FOOTBALL_KEY ?? ''

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        // Proxy /api-football/* → https://v3.football.api-sports.io/*
        // Using the low-level proxyReq event so headers are ALWAYS injected
        '/api-football': {
          target: 'https://v3.football.api-sports.io',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api-football/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('x-apisports-key', apiKey)
              proxyReq.setHeader('x-apisports-host', 'v3.football.api-sports.io')
            })
            proxy.on('error', (err) => {
              console.error('[proxy error]', err)
            })
          },
        },
      },
    },
  }
})
