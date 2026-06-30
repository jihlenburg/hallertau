/**
 * requireUser — Fastify preHandler that enforces an authenticated session.
 *
 * Reads the `db_session` cookie, verifies its HMAC signature, loads the session
 * from the DB (expired sessions return null), and attaches `req.user` + `req.farm`
 * to the request before the route handler runs.
 *
 * Returns 401 { error: 'unauthorized' } for:
 *  - missing cookie
 *  - bad / tampered cookie signature
 *  - unknown or expired session
 *
 * A user with no farm yet is still authenticated — `req.farm` is null in that case.
 *
 * Design: factory-function injection pattern (repos + optional signing key) so
 * unit tests can run without a real DB or environment variable.
 */

import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify'
import type { Repos, User, Farm } from '../db/repos.js'
import { verifyCookie, loadSession } from './session.js'

// ── Fastify type augmentation ─────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Populated by `requireUser` preHandler.
     * Undefined on routes not guarded by the preHandler.
     */
    user: User
    /**
     * Populated by `requireUser` preHandler.
     * null when the authenticated user has not yet created or joined a farm.
     */
    farm: Farm | null
  }
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface RequireUserOpts {
  /** Repository layer (injected; no real DB needed in tests). */
  repos: Pick<Repos, 'sessions' | 'users' | 'farmMembers' | 'farms'>
  /**
   * HMAC signing key for cookie verification.
   * Falls back to `process.env.SESSION_SIGNING_KEY` when omitted.
   */
  key?: string
}

// ── requireUser ───────────────────────────────────────────────────────────────

const COOKIE_NAME = 'db_session'

/**
 * Returns a Fastify preHandler that authenticates the request via a signed
 * session cookie.
 *
 * Usage:
 *   const guard = requireUser({ repos })
 *   fastify.get('/protected', { preHandler: guard }, handler)
 */
export function requireUser(opts: RequireUserOpts): preHandlerHookHandler {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const cookieValue = req.cookies[COOKIE_NAME]

    if (!cookieValue) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const sessionId = verifyCookie(cookieValue, opts.key)
    if (!sessionId) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const result = await loadSession(sessionId, { repos: opts.repos })
    if (!result) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    req.user = result.user
    req.farm = result.farm
  }
}

// Re-export loadSession so tests can import it from this module
export { loadSession }
