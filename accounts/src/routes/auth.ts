/**
 * Auth routes — magic-link issuance (Task 3).
 * Verify / session creation is Task 4.
 */

import type { FastifyInstance } from 'fastify'
import type { Repos } from '../db/repos.js'
import { requestMagicLink } from '../auth/magicLink.js'
import { sendMagicLinkEmail } from '../mail/postmark.js'

export interface AuthRouteDeps {
  repos: Repos
}

interface MagicLinkBody {
  email?: unknown
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  /**
   * POST /api/auth/magic-link
   * Body: { email: string }
   *
   * Always returns 200 {ok: true} to avoid leaking whether an address exists.
   */
  app.post<{ Body: MagicLinkBody }>('/api/auth/magic-link', async (req, reply) => {
    const { email } = req.body ?? {}

    if (typeof email !== 'string' || email.trim() === '') {
      return reply.code(400).send({ error: 'email fehlt oder ist ungültig' })
    }

    await requestMagicLink(
      { email },
      {
        repos:    deps.repos,
        sendMail: (to, link) => sendMagicLinkEmail(to, link),
      },
    )

    return reply.code(200).send({ ok: true })
  })
}
