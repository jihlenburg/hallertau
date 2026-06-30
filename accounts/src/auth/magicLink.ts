/**
 * Magic-link issuance — pure, fully dependency-injected.
 *
 * Security invariants:
 *  - Only the SHA-256 hash of the token is persisted; the raw token
 *    is never logged or returned — it appears only in the emailed link.
 *  - E-mail is normalised (trim + toLowerCase) at the boundary so the
 *    citext DB column and any dedup logic behave consistently.
 */

import { createHash, randomBytes } from 'crypto'
import type { Repos } from '../db/repos.js'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Minimal injected mail sender; full implementation lives in postmark.ts. */
export type SendMail = (to: string, link: string) => Promise<void>

export interface RequestMagicLinkDeps {
  repos:        Pick<Repos, 'users' | 'magicTokens'>
  sendMail:     SendMail
  /** Returns "now" — injectable so tests can freeze time. */
  now?:         () => Date
  /** Returns a random token Buffer — injectable for deterministic tests. */
  randomToken?: () => Buffer
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Issues a magic-link token:
 *  1. Normalises the e-mail.
 *  2. Finds-or-creates the user.
 *  3. Generates a random token, stores only its SHA-256 hash with a 30-min TTL.
 *  4. Sends the raw token embedded in the verification link via `sendMail`.
 *
 * Returns `{ok: true}` on success; never reveals the raw token to the caller.
 */
export async function requestMagicLink(
  { email }: { email: string },
  deps: RequestMagicLinkDeps,
): Promise<{ ok: true }> {
  const {
    repos,
    sendMail,
    now         = () => new Date(),
    randomToken = () => randomBytes(32),
  } = deps

  // 1. Normalise — citext column + dedup rely on this
  const normalizedEmail = email.trim().toLowerCase()

  // 2. Find or create user
  const existingUser = await repos.users.findByEmail(normalizedEmail)
  const user = existingUser ?? await repos.users.create({ email: normalizedEmail })

  // 3. Generate token — raw Buffer stays in this scope only
  const rawToken  = randomToken()
  const tokenHex  = rawToken.toString('hex')          // goes into the link
  const tokenHash = createHash('sha256').update(rawToken).digest('hex') // stored

  const purpose   = (existingUser?.email_verified_at != null) ? 'signin' : 'verify'
  const expiresAt = new Date(now().getTime() + 30 * 60 * 1000) // +30 min

  await repos.magicTokens.create({
    email:      normalizedEmail,
    token_hash: tokenHash,        // only the hash is persisted
    purpose,
    expires_at: expiresAt,
    user_id:    user.id,
  })

  // 4. Build verification link and send — raw token only here, never logged
  const siteUrl = process.env.SITE_URL ?? 'https://doldenblick.de'
  const link    = `${siteUrl}/onboarding/verify?token=${tokenHex}`

  await sendMail(normalizedEmail, link)

  return { ok: true }
}
