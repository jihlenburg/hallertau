import { defineConfig } from 'vite'

// Bright Sky (DWD-Warnungen) sendet im Browser nicht zuverlässig CORS-Header.
// Im Dev-Server routen wir die Anfrage daher über einen Proxy — so entfällt CORS
// komplett, ohne einen eigenen Backend-Prozess. Hinweis: das gilt nur für
// `npm run dev`; ein rein statischer Prod-Build bräuchte einen echten Proxy.
export default defineConfig({
  server: {
    proxy: {
      '/api/brightsky': {
        target: 'https://api.brightsky.dev',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/brightsky/, ''),
      },
    },
  },
})
