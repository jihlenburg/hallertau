import { defineConfig } from 'vite'

// Same-origin /api/* im Dev-Server. Ziele:
//  - /api/brightsky   → api.brightsky.dev (DWD-Warnungen; CORS-frei via Proxy, mit Rewrite)
//  - /api/water-balance, /api/version, /api/field-vigor, /api/rs → DoldenBlick-Backend
//  - /api/auth        → DoldenBlick-Backend (Magic-Link, Passkey-Zeremonien)
//  - /api/onboarding  → DoldenBlick-Backend (Farm, Schläge, Me)
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
      '/api/field-vigor': { target: API_ORIGIN, changeOrigin: true },
      '/api/rs': { target: API_ORIGIN, changeOrigin: true },
      '/api/auth': { target: API_ORIGIN, changeOrigin: true },
      '/api/onboarding': { target: API_ORIGIN, changeOrigin: true },
    },
  },
})
