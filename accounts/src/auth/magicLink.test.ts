/**
 * Unit tests for requestMagicLink — all deps injected (no DB, no HTTP).
 *
 * Key invariants under test:
 *  1. Only the SHA-256 hash is persisted (raw token never stored).
 *  2. sendMail receives a link that embeds the raw token.
 *  3. E-mail is normalised (trim + lowercase) before every store / lookup.
 *  4. Token TTL is exactly 30 minutes from `now()`.
 *  5. Return value is {ok: true}.
 */

import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'crypto'
import { requestMagicLink } from './magicLink.js'
import type { Repos } from '../db/repos.js'

// ── Fixed test fixtures ───────────────────────────────────────────────────────

const FIXED_TOKEN_HEX = 'ab'.repeat(32) // 32 bytes expressed as 64 hex chars
const FIXED_TOKEN      = Buffer.from(FIXED_TOKEN_HEX, 'hex')
const FIXED_HASH       = createHash('sha256').update(FIXED_TOKEN).digest('hex')
const FIXED_NOW        = new Date('2026-06-30T10:00:00.000Z')
const EXPECTED_EXPIRY  = new Date(FIXED_NOW.getTime() + 30 * 60 * 1000)

// ── Helpers ───────────────────────────────────────────────────────────────────

type PartialRepos = Pick<Repos, 'users' | 'magicTokens'>

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  email_verified_at: null,
  name: null,
  last_login_at: null,
  created_at: new Date(),
}

function makeRepos(existingUser: typeof fakeUser | null = null): PartialRepos {
  return {
    users: {
      findByEmail: vi.fn().mockResolvedValue(existingUser),
      create:      vi.fn().mockResolvedValue(fakeUser),
    } as unknown as Repos['users'],
    magicTokens: {
      create: vi.fn().mockResolvedValue({
        id:         'token-1',
        email:      fakeUser.email,
        token_hash: FIXED_HASH,
        purpose:    'verify',
        expires_at: EXPECTED_EXPIRY,
        user_id:    fakeUser.id,
        used_at:    null,
        created_at: FIXED_NOW,
      }),
    } as unknown as Repos['magicTokens'],
  }
}

function makeDeps(repos: PartialRepos) {
  return {
    repos,
    sendMail: vi.fn<[string, string], Promise<void>>().mockResolvedValue(undefined),
    now:         () => FIXED_NOW,
    randomToken: () => FIXED_TOKEN,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('requestMagicLink', () => {
  it('stores the SHA-256 hash — not the raw token — in magicTokens', async () => {
    const repos = makeRepos()
    const deps  = makeDeps(repos)

    await requestMagicLink({ email: 'test@example.com' }, deps)

    const createCall = (repos.magicTokens.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    // Hash must be stored
    expect(createCall.token_hash).toBe(FIXED_HASH)
    // Raw token hex must NOT be stored
    expect(createCall.token_hash).not.toBe(FIXED_TOKEN_HEX)
  })

  it('calls sendMail with a link that contains the raw token', async () => {
    const repos = makeRepos()
    const deps  = makeDeps(repos)

    await requestMagicLink({ email: 'test@example.com' }, deps)

    expect(deps.sendMail).toHaveBeenCalledTimes(1)
    const [_to, link] = (deps.sendMail as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string]
    expect(link).toContain(FIXED_TOKEN_HEX)
    // Sanity: link must NOT contain the hash instead of the raw token
    expect(link).not.toContain(FIXED_HASH)
  })

  it('normalises email (trim + lowercase) before user lookup and token storage', async () => {
    const repos = makeRepos()
    const deps  = makeDeps(repos)

    await requestMagicLink({ email: '  Test@Example.COM  ' }, deps)

    expect((repos.users.findByEmail as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('test@example.com')
    const createCall = (repos.magicTokens.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(createCall.email).toBe('test@example.com')
  })

  it('sendMail receives the normalised email as "to"', async () => {
    const repos = makeRepos()
    const deps  = makeDeps(repos)

    await requestMagicLink({ email: '  Test@Example.COM  ' }, deps)

    const [to] = (deps.sendMail as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string]
    expect(to).toBe('test@example.com')
  })

  it('sets token TTL to exactly 30 minutes from now()', async () => {
    const repos = makeRepos()
    const deps  = makeDeps(repos)

    await requestMagicLink({ email: 'test@example.com' }, deps)

    const createCall = (repos.magicTokens.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(createCall.expires_at).toEqual(EXPECTED_EXPIRY)
  })

  it('returns {ok: true}', async () => {
    const repos = makeRepos()
    const deps  = makeDeps(repos)

    const result = await requestMagicLink({ email: 'test@example.com' }, deps)

    expect(result).toEqual({ ok: true })
  })

  it('uses purpose "verify" for a new / unverified user', async () => {
    const repos = makeRepos(null) // user does not exist yet
    const deps  = makeDeps(repos)

    await requestMagicLink({ email: 'new@example.com' }, deps)

    const createCall = (repos.magicTokens.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(createCall.purpose).toBe('verify')
  })

  it('uses purpose "signin" for an already-verified user', async () => {
    const verifiedUser = { ...fakeUser, email_verified_at: new Date('2026-01-01') }
    const repos = makeRepos(verifiedUser)
    const deps  = makeDeps(repos)

    await requestMagicLink({ email: 'test@example.com' }, deps)

    const createCall = (repos.magicTokens.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(createCall.purpose).toBe('signin')
  })
})
