import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { registerWaterBalanceRoute } from './routes/waterBalance.js'
import { fetchOpenMeteoDailyCached, type DailySeries } from './sources/openMeteo.js'
import { API_VERSION, MIN_CLIENT_VERSION, isClientCompatible } from './version.js'

export interface BuildAppOpts {
  logger?: boolean
  /** Open-Meteo-Quelle injizierbar (Tests stubben sie; Default = echter Abruf). */
  fetchDaily?: (lat: number, lon: number, signal?: AbortSignal) => Promise<DailySeries>
}

/** Vom Client deklarierte API-Major aus Header `x-client-api` oder Query `clientApi`. */
function declaredClientVersion(req: FastifyRequest): number | undefined {
  const h = req.headers['x-client-api']
  const raw = (Array.isArray(h) ? h[0] : h) ?? (req.query as Record<string, string | undefined>)?.clientApi
  if (raw == null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

// Routen, die zur Versions-Aushandlung IMMER erreichbar bleiben (kein Compat-Gate).
const ALWAYS_OPEN = new Set(['/api/health', '/api/version'])

/**
 * Baut die Fastify-Instanz (ohne zu lauschen) — testbar via `app.inject(...)`.
 * Der Server (`server.ts`) ruft `buildApp()` und ruft danach `listen`.
 */
export function buildApp(opts: BuildAppOpts = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false })

  // Jede Antwort trägt die API-Vertragsversion; inkompatible Clients an Datenrouten werden abgewiesen.
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-api-version', String(API_VERSION))
    const path = req.url.split('?')[0]
    if (ALWAYS_OPEN.has(path)) return
    const cv = declaredClientVersion(req)
    if (cv != null && !isClientCompatible(cv)) {
      return reply.code(426).send({
        error: 'Client-/API-Version inkompatibel — bitte App aktualisieren.',
        apiVersion: API_VERSION,
        minClientVersion: MIN_CLIENT_VERSION,
      })
    }
  })

  app.get('/api/health', async () => ({ status: 'ok', service: 'doldenblick-api', apiVersion: API_VERSION }))

  app.get('/api/version', async () => ({
    service: 'doldenblick-api',
    apiVersion: API_VERSION,
    minClientVersion: MIN_CLIENT_VERSION,
  }))

  registerWaterBalanceRoute(app, { fetchDaily: opts.fetchDaily ?? fetchOpenMeteoDailyCached })

  return app
}
