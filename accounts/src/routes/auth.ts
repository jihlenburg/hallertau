/**
 * Auth routes — magic-link issuance (Task 3) + verify/session (Task 4).
 */

import type { FastifyInstance } from 'fastify'
import type { Repos } from '../db/repos.js'
import { requestMagicLink } from '../auth/magicLink.js'
import { verifyMagicLink, createSession, signCookie, AuthError } from '../auth/session.js'

export interface AuthRouteDeps {
  repos: Repos
  /** Injectable mail sender — defaults to Postmark; stubbable in tests. */
  sendMagicLinkEmail: (to: string, link: string) => Promise<void>
  /** Returns "now" — injectable for tests. */
  now?: () => Date
}

interface MagicLinkBody {
  email?: unknown
}

interface VerifyBody {
  token?: unknown
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  /**
   * POST /api/auth/magic-link
   * Body: { email: string }
   *
   * Always returns 200 {ok: true} to avoid leaking whether an address exists
   * (address-enumeration protection): errors are silently swallowed after
   * initial input validation.
   */
  app.post<{ Body: MagicLinkBody }>('/api/auth/magic-link', async (req, reply) => {
    const { email } = req.body ?? {}

    if (typeof email !== 'string' || email.trim() === '') {
      return reply.code(400).send({ error: 'email fehlt oder ist ungültig' })
    }

    try {
      await requestMagicLink(
        { email },
        {
          repos:    deps.repos,
          sendMail: (to, link) => deps.sendMagicLinkEmail(to, link),
          now:      deps.now,
        },
      )
    } catch (err: unknown) {
      // Log server-side so real issuance failures are visible (token/link never included)
      req.log.error({ err }, 'magic-link issuance failed')
      // Swallow — never reveal to the caller whether issuance failed (enumeration guard)
    }

    return reply.code(200).send({ ok: true })
  })

  /**
   * POST /api/auth/verify
   * Body: { token: string }  (hex-encoded raw token from the magic-link URL)
   *
   * On success: creates a session and sets a signed HttpOnly cookie.
   * On failure: 401 (invalid / expired / already-used token).
   */
  app.post<{ Body: VerifyBody }>('/api/auth/verify', async (req, reply) => {
    const { token } = req.body ?? {}

    if (typeof token !== 'string' || token.trim() === '') {
      return reply.code(400).send({ error: 'token fehlt oder ist ungültig' })
    }

    try {
      const { userId } = await verifyMagicLink(
        { token },
        { repos: deps.repos },
      )

      const sessionId = await createSession(userId, { repos: deps.repos, now: deps.now })
      const signed    = signCookie(sessionId)

      reply.setCookie('db_session', signed, {
        httpOnly: true,
        secure:   true,
        sameSite: 'lax',
        path:     '/',
        maxAge:   30 * 24 * 60 * 60, // 30 days — matches server session TTL
      })

      return reply.code(200).send({ ok: true })
    } catch (err: unknown) {
      if (err instanceof AuthError && err.statusCode === 401) {
        return reply.code(401).send({ error: 'Token ungültig oder abgelaufen' })
      }
      throw err
    }
  })
}
