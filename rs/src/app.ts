import Fastify, { type FastifyInstance } from 'fastify'
import { API_VERSION, MIN_CLIENT_VERSION } from './version.js'

export interface BuildAppOpts {
  logger?: boolean
}

/**
 * Baut die RS-Fastify-Instanz (ohne zu lauschen) — testbar via `app.inject(...)`.
 * Eigene Pfade unter `/api/rs/*` + Datenroute(n), getrennt vom Wasserbilanz-Dienst (`api/`).
 */
export function buildApp(opts: BuildAppOpts = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false })

  app.addHook('onRequest', async (_req, reply) => {
    reply.header('x-api-version', String(API_VERSION))
  })

  app.get('/api/rs/health', async () => ({ status: 'ok', service: 'doldenblick-rs', apiVersion: API_VERSION }))
  app.get('/api/rs/version', async () => ({
    service: 'doldenblick-rs',
    apiVersion: API_VERSION,
    minClientVersion: MIN_CLIENT_VERSION,
  }))

  // /api/field-vigor wird in R5 registriert (deps-injiziert: CDSE-Auth + Statistical-Client).

  return app
}
