/**
 * Session management — magic-link verification, session creation, cookie signing.
 *
 * Security invariants:
 *  - Raw token is never logged; only its SHA-256 hash is compared.
 *  - Tokens are single-use: markUsed is called before any user operations so a
 *    concurrent replay attempt always loses the race.
 *  - Cookie signatures use HMAC-SHA256 with timingSafeEqual comparison.
 *  - SESSION_SIGNING_KEY is never logged.
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto'
import type { Repos } from '../db/repos.js'

// ── Error type ────────────────────────────────────────────────────────────────

export class AuthError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'AuthError'
    this.statusCode = statusCode
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VerifyMagicLinkDeps {
  repos: Pick<Repos, 'magicTokens' | 'users'>
  /** Returns "now" — injectable so tests can freeze time. */
  now?: () => Date
}

export interface CreateSessionDeps {
  repos: Pick<Repos, 'sessions'>
  /** Returns "now" — injectable so tests can freeze time. */
  now?: () => Date
}

// ── verifyMagicLink ───────────────────────────────────────────────────────────

/**
 * Verifies a magic-link token (supplied as hex):
 *  1. Hashes the token and looks it up via findValidByHash (which checks expiry + used_at).
 *  2. Marks the token as used immediately — single-use enforcement before any user ops.
 *  3. Finds or creates the user; sets email_verified_at when absent.
 *  4. Returns { userId }.
 *
 * Throws AuthError(401) when the token is invalid, expired, or already used.
 */
export async function verifyMagicLink(
  { token }: { token: string },
  { repos, now: _now = () => new Date() }: VerifyMagicLinkDeps,
): Promise<{ userId: string }> {
  // Hash the raw token hex → stored hash
  const tokenHash = createHash('sha256')
    .update(Buffer.from(token, 'hex'))
    .digest('hex')

  const magicToken = await repos.magicTokens.findValidByHash(tokenHash)
  if (!magicToken) {
    throw new AuthError('Token ungültig oder abgelaufen', 401)
  }

  // Mark used first — prevents replay even if subsequent steps fail
  await repos.magicTokens.markUsed(magicToken.id)

  // Find or create user; ensure email is verified
  const existingUser = await repos.users.findByEmail(magicToken.email)
  let userId: string

  if (existingUser) {
    userId = existingUser.id
    if (!existingUser.email_verified_at) {
      await repos.users.markEmailVerified(existingUser.id)
    }
  } else {
    const newUser = await repos.users.create({ email: magicToken.email })
    await repos.users.markEmailVerified(newUser.id)
    userId = newUser.id
  }

  return { userId }
}

// ── createSession ─────────────────────────────────────────────────────────────

/**
 * Creates a session row with a 30-day TTL.
 * Returns the new session's UUID (used as the unsigned cookie payload).
 */
export async function createSession(
  userId: string,
  { repos, now = () => new Date() }: CreateSessionDeps,
): Promise<string> {
  const expiresAt = new Date(now().getTime() + 30 * 24 * 60 * 60 * 1000)
  const session = await repos.sessions.create({ user_id: userId, expires_at: expiresAt })
  return session.id
}

// ── Cookie signing ────────────────────────────────────────────────────────────

function resolveKey(key: string | undefined): string {
  const k = key ?? process.env.SESSION_SIGNING_KEY
  if (!k) throw new Error('SESSION_SIGNING_KEY ist nicht gesetzt')
  return k
}

/**
 * Signs a session id: returns `<id>.<hmac-sha256-hex>`.
 * Throws if SESSION_SIGNING_KEY is not set and no key is injected.
 */
export function signCookie(id: string, key?: string): string {
  const k = resolveKey(key)
  const sig = createHmac('sha256', k).update(id).digest('hex')
  return `${id}.${sig}`
}

/**
 * Verifies a signed cookie value.
 * Returns the session id on success, or null on tamper / missing key / bad format.
 * Uses constant-time comparison to resist timing attacks.
 */
export function verifyCookie(value: string, key?: string): string | null {
  try {
    const k = resolveKey(key)
    const dot = value.lastIndexOf('.')
    if (dot === -1) return null

    const id          = value.slice(0, dot)
    const providedSig = value.slice(dot + 1)
    const expectedSig = createHmac('sha256', k).update(id).digest('hex')

    const a = Buffer.from(providedSig, 'hex')
    const b = Buffer.from(expectedSig, 'hex')

    // Length check guards timingSafeEqual (requires equal-length buffers)
    if (a.length !== b.length || a.length === 0) return null
    if (!timingSafeEqual(a, b)) return null

    return id
  } catch {
    return null
  }
}
