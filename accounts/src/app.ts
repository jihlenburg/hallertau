import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { VERSION, CONTRACT, MIN_CLIENT_CONTRACT, isClientCompatible } from './version.js'

/** Injizierbare Abhängigkeiten (DB, externe Dienste). In Tests stubbar. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Deps {}

export interface BuildAppOpts {
  logger?: boolean
  /** Datenzugriff injizierbar (Tests stubben; Default = Produktionsimplementierung). */
  deps?: Partial<Deps>
}

/** Vom Client deklarierte Contract-Major aus Header `x-client-api` oder Query `clientApi`. */
function declaredClientContract(req: FastifyRequest): number | undefined {
  const h = req.headers['x-client-api']
  const raw = (Array.isArray(h) ? h[0] : h) ?? (req.query as Record<string, string | undefined>)?.clientApi
  if (raw == null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

// Routen, die zur Versions-Aushandlung IMMER erreichbar bleiben (kein Compat-Gate).
const ALWAYS_OPEN = new Set(['/api/accounts/health', '/api/accounts/version'])

/**
 * Baut die Fastify-Instanz (ohne zu lauschen) — testbar via `app.inject(...)`.
 * Der Server (`server.ts`) ruft `buildApp()` und danach `listen`.
 */
export function buildApp(opts: BuildAppOpts = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false })

  // Jede Antwort trägt die Contract-Version; inkompatible Clients werden abgewiesen.
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-api-version', String(CONTRACT))
    const path = req.url.split('?')[0]
    if (ALWAYS_OPEN.has(path)) return
    const cv = declaredClientContract(req)
    if (cv != null && !isClientCompatible(cv)) {
      return reply.code(426).send({
        error: 'Client-/API-Version inkompatibel — bitte App aktualisieren.',
        contract: CONTRACT,
        minClientContract: MIN_CLIENT_CONTRACT,
      })
    }
  })

  app.get('/api/accounts/health', async () => ({ status: 'ok' }))

  app.get('/api/accounts/version', async () => ({
    name: 'doldenblick-accounts',
    version: VERSION,
    contract: CONTRACT,
  }))

  return app
}
