// Minimaler, host-unabhängiger Produktions-Server für den gebauten Build (dist/).
//
// Zweck: Er liefert die statischen Dateien aus UND stellt denselben Bright-Sky-Proxy
// unter /api/brightsky bereit wie der Vite-Dev-Proxy (vite.config.ts). Damit funktionieren
// die amtlichen DWD-Warnungen auch im Prod-Build — ohne CORS-Problem und ohne API-Key.
//
//   npm run build && npm run serve        # → http://localhost:4173
//
// Für serverlose Hosts (Cloudflare Worker / Netlify / Vercel) genügt eine winzige
// Funktion mit derselben Logik wie der /api/brightsky-Zweig unten — siehe app/README.md.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, extname } from 'node:path'

const PORT = Number(process.env.PORT) || 4173
const DIST = fileURLToPath(new URL('./dist/', import.meta.url))
const BRIGHTSKY = process.env.BRIGHTSKY_URL || 'https://api.brightsky.dev'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  // 1) Bright Sky (DWD-Warnungen) — identisch zum Vite-Dev-Proxy.
  if (url.pathname.startsWith('/api/brightsky')) {
    const target = BRIGHTSKY + url.pathname.replace(/^\/api\/brightsky/, '') + url.search
    try {
      const up = await fetch(target, { headers: { accept: 'application/json' } })
      const body = Buffer.from(await up.arrayBuffer())
      res.writeHead(up.status, { 'content-type': up.headers.get('content-type') || 'application/json' })
      res.end(body)
    } catch {
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'brightsky proxy unreachable' }))
    }
    return
  }

  // 2) Statische Dateien aus dist/ mit SPA-Fallback auf index.html.
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '')
  const filePath = resolve(DIST, rel)
  if (!filePath.startsWith(DIST)) {
    // Path-Traversal verhindern.
    res.writeHead(403)
    res.end('forbidden')
    return
  }
  try {
    const data = await readFile(filePath)
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    try {
      const index = await readFile(resolve(DIST, 'index.html'))
      res.writeHead(200, { 'content-type': MIME['.html'] })
      res.end(index)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  }
})

server.listen(PORT, () => {
  console.log(`DoldenBlick Prod-Server auf http://localhost:${PORT} (Bright Sky → ${BRIGHTSKY})`)
})
