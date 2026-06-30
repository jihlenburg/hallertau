import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { VERSION, CONTRACT, MIN_CLIENT_CONTRACT, isClientCompatible } from './version.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerOnboardingRoutes } from './routes/onboarding.js'
import { sendMagicLinkEmail as defaultMailSender } from './mail/postmark.js'
import { createPool } from './db/pool.js'
import { repos as makeRepos } from './db/repos.js'
import type { Repos } from './db/repos.js'

/** Injizierbare Abhängigkeiten (DB, externe Dienste). In Tests stubbar. */
export interface Deps {
  /** Datenbankzugriff. Wenn gesetzt, werden Auth-Routen registriert. */
  repos?: Repos
}

export interface BuildAppOpts {
  logger?: boolean
  /** Datenzugriff injizierbar (Tests stubben; Default = Produktionsimplementierung). */
  deps?: Partial<Deps>
  /**
   * Maildienst injizierbar (Tests übergeben eine Stub-Funktion).
   * Default: Postmark-Implementierung aus mail/postmark.ts.
   */
  sendMagicLinkEmail?: (to: string, link: string) => Promise<void>
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
 *
 * Production: `buildApp({ logger: true })` — liest DATABASE_URL aus der Umgebung.
 * Tests:      `buildApp({ deps: { repos: mockRepos }, sendMagicLinkEmail: stub })`.
 *
 * Implementierungshinweis — Plugin-Reihenfolge:
 *   Alle Routen werden innerhalb eines `app.register()`-Callbacks registriert, damit sie
 *   NACH dem Rate-Limit-Plugin (`@fastify/rate-limit`) in der avvio-Queue laufen.
 *   Das Rate-Limit-Plugin nutzt einen `onRoute`-Hook, der nur für Routen greift, die nach
 *   der Plugin-Initialisierung registriert werden — deshalb darf `app.post()` nicht direkt
 *   (synchron) aus `buildApp()` heraus aufgerufen werden.
 */
export function buildApp(opts: BuildAppOpts = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false })

  // Cookie-Plugin für Auth-Routen (HttpOnly, signierte Session-Cookies).
  // fastify-plugin: kein Scope-Isolation → Decorator in allen Kind-Scopes verfügbar.
  void app.register(fastifyCookie)

  // Rate-Limit-Plugin (in-memory, kein DB-Bedarf) — global: false → Opt-in per Route.
  // fastify-plugin: onRoute-Hook gilt für alle Kind-Scopes.
  // Routes werden unterhalb in einem register()-Callback registriert, damit der onRoute-Hook
  // des Rate-Limit-Plugins bereits installiert ist, wenn die Routen registriert werden.
  void app.register(rateLimit, { global: false })

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

  // Resolve repos: injected mock (tests) → live pool (production) → skip routes
  let effectiveRepos: Repos | undefined = opts.deps?.repos
  if (!effectiveRepos) {
    try {
      effectiveRepos = makeRepos(createPool())
    } catch (err) {
      // Swallow only in test env (DATABASE_URL absent is expected) — in production,
      // a missing/bad DATABASE_URL must be a hard boot failure, not a silent 404.
      if (process.env.VITEST || process.env.NODE_ENV === 'test') {
        // DATABASE_URL nicht gesetzt (Unit-Test ohne DB) — Auth-Routen überspringen
      } else {
        throw err
      }
    }
  }

  // Capture für Closure
  const resolvedRepos = effectiveRepos
  const sendMail = opts.sendMagicLinkEmail ?? defaultMailSender

  // Alle Routen werden in einem register()-Callback registriert, damit der onRoute-Hook
  // des Rate-Limit-Plugins bereits aktiv ist, wenn die Routen zum Routing-Baum hinzugefügt
  // werden (avvio verarbeitet Plugins in Deklarationsreihenfolge).
  void app.register(async (scope) => {
    scope.get('/api/accounts/health', async () => ({ status: 'ok' }))

    scope.get('/api/accounts/version', async () => ({
      name: 'doldenblick-accounts',
      version: VERSION,
      contract: CONTRACT,
    }))

    if (resolvedRepos) {
      registerAuthRoutes(scope, {
        repos:              resolvedRepos,
        sendMagicLinkEmail: sendMail,
      })

      registerOnboardingRoutes(scope, { repos: resolvedRepos })
    }
  })

  return app
}
