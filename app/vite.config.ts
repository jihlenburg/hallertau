import { defineConfig } from 'vite'

// Same-origin /api/* im Dev-Server. Drei Ziele:
//  - /api/brightsky → api.brightsky.dev (DWD-Warnungen; CORS-frei via Proxy, mit Rewrite)
//  - /api/water-balance, /api/version → das live DoldenBlick-Backend (BFF + Compute)
// In Prod übernimmt nginx dieselben Routen (kein App-Proxy nötig). Nur `npm run dev`.
const API_ORIGIN = process.env.API_ORIGIN || 'https://doldenblick.de'

export default defineConfig({
  server: {
    proxy: {
      '/api/brightsky': {
        target: 'https://api.brightsky.dev',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/brightsky/, ''),
      },
      '/api/water-balance': { target: API_ORIGIN, changeOrigin: true },
      '/api/version': { target: API_ORIGIN, changeOrigin: true },
    },
  },
})
