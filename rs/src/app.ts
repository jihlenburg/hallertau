import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { API_VERSION, MIN_CLIENT_VERSION, isClientCompatible } from './version.js'
import { createCdseAuth } from './cdse/auth.js'
import { fetchFieldStats } from './cdse/statistical.js'
import { registerFieldVigorRoute, type VigorDeps } from './routes/fieldVigor.js'

export interface BuildAppOpts {
  logger?: boolean
  /** Datenzugriff injizierbar (Tests stubben; Default = echtes CDSE aus env). */
  deps?: VigorDeps
}

function declaredClientVersion(req: FastifyRequest): number | undefined {
  const h = req.headers['x-client-api']
  const raw = (Array.isArray(h) ? h[0] : h) ?? (req.query as Record<string, string | undefined>)?.clientApi
  if (raw == null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

const ALWAYS_OPEN = new Set(['/api/rs/health', '/api/rs/version'])

/** Default-Deps: echte CDSE-Auth (Client-Credentials aus env) + Statistical-API-Abruf. */
function defaultDeps(): VigorDeps {
  const auth = createCdseAuth({
    clientId: process.env.COPERNICUS_CLIENT_ID ?? '',
    clientSecret: process.env.COPERNICUS_CLIENT_SECRET ?? '',
  })
  return { getToken: () => auth.getToken(), fetchStats: (o, t) => fetchFieldStats(o, t) }
}

export function buildApp(opts: BuildAppOpts = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false })

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

  app.get('/api/rs/health', async () => ({ status: 'ok', service: 'doldenblick-rs', apiVersion: API_VERSION }))
  app.get('/api/rs/version', async () => ({
    service: 'doldenblick-rs',
    apiVersion: API_VERSION,
    minClientVersion: MIN_CLIENT_VERSION,
  }))

  registerFieldVigorRoute(app, opts.deps ?? defaultDeps())

  return app
}
