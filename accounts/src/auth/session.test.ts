/**
 * Unit tests for session.ts — all deps injected (no DB, no HTTP).
 *
 * Invariants under test:
 *  1. verifyMagicLink: valid unused token → hashes input, calls findValidByHash,
 *     marks used, finds/creates user, returns userId.
 *  2. verifyMagicLink: findValidByHash returns null → throws 401.
 *  3. createSession: creates a session row with 30-day TTL, returns sessionId.
 *  4. signCookie / verifyCookie: round-trip succeeds.
 *  5. verifyCookie: tampered value → returns null.
 *  6. verifyCookie: missing dot separator → returns null.
 */

import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'crypto'
import {
  verifyMagicLink,
  createSession,
  signCookie,
  verifyCookie,
  AuthError,
} from './session.js'
import type { Repos } from '../db/repos.js'

// ── Shared test fixtures ──────────────────────────────────────────────────────

const TEST_KEY         = 'test-signing-key-for-unit-tests'
const FIXED_TOKEN_HEX  = 'cd'.repeat(32)                              // 64-char hex
const FIXED_TOKEN_HASH = createHash('sha256')
  .update(Buffer.from(FIXED_TOKEN_HEX, 'hex'))
  .digest('hex')
const FIXED_NOW        = new Date('2026-06-30T18:00:00.000Z')
const SESSION_30_DAYS  = new Date(FIXED_NOW.getTime() + 30 * 24 * 60 * 60 * 1000)

const fakeUser = {
  id:                 'user-abc',
  email:              'bauer@hallertau.de',
  email_verified_at:  null as Date | null,
  name:               null as string | null,
  last_login_at:      null as Date | null,
  created_at:         new Date(),
}

const fakeMagicToken = {
  id:         'token-xyz',
  user_id:    fakeUser.id,
  email:      fakeUser.email,
  token_hash: FIXED_TOKEN_HASH,
  purpose:    'verify',
  expires_at: new Date(FIXED_NOW.getTime() + 30 * 60 * 1000),
  used_at:    null as Date | null,
  created_at: FIXED_NOW,
}

const fakeSession = {
  id:         'session-111',
  user_id:    fakeUser.id,
  expires_at: SESSION_30_DAYS,
  user_agent: null,
  ip:         null,
  created_at: FIXED_NOW,
}

// ── verifyMagicLink ───────────────────────────────────────────────────────────

describe('verifyMagicLink', () => {
  function makeRepos(override: Partial<{
    consumeByHash:     ReturnType<typeof vi.fn>
    findByEmail:       ReturnType<typeof vi.fn>
    create:            ReturnType<typeof vi.fn>
    markEmailVerified: ReturnType<typeof vi.fn>
  }> = {}): Pick<Repos, 'magicTokens' | 'users'> {
    return {
      magicTokens: {
        consumeByHash: override.consumeByHash ?? vi.fn().mockResolvedValue(fakeMagicToken),
      } as unknown as Repos['magicTokens'],
      users: {
        findByEmail:       override.findByEmail       ?? vi.fn().mockResolvedValue(null),
        create:            override.create            ?? vi.fn().mockResolvedValue(fakeUser),
        markEmailVerified: override.markEmailVerified ?? vi.fn().mockResolvedValue(undefined),
      } as unknown as Repos['users'],
    }
  }

  it('hashes the token hex and passes the hash to consumeByHash', async () => {
    const r = makeRepos()
    await verifyMagicLink({ token: FIXED_TOKEN_HEX }, { repos: r })
    expect(r.magicTokens.consumeByHash).toHaveBeenCalledWith(FIXED_TOKEN_HASH)
  })

  it('atomically consumes the token (consumeByHash called, no separate markUsed)', async () => {
    const r = makeRepos()
    await verifyMagicLink({ token: FIXED_TOKEN_HEX }, { repos: r })
    // consumeByHash is the single atomic operation — no separate find + markUsed pair
    expect(r.magicTokens.consumeByHash).toHaveBeenCalledTimes(1)
    expect(r.magicTokens.consumeByHash).toHaveBeenCalledWith(FIXED_TOKEN_HASH)
  })

  it('creates a new user when no existing user is found', async () => {
    const r = makeRepos({ findByEmail: vi.fn().mockResolvedValue(null) })
    const result = await verifyMagicLink({ token: FIXED_TOKEN_HEX }, { repos: r })
    expect(r.users.create).toHaveBeenCalledWith({ email: fakeUser.email })
    expect(result.userId).toBe(fakeUser.id)
  })

  it('reuses existing user and does NOT call create', async () => {
    const existingUser = { ...fakeUser, email_verified_at: new Date('2026-01-01') }
    const r = makeRepos({ findByEmail: vi.fn().mockResolvedValue(existingUser) })
    const result = await verifyMagicLink({ token: FIXED_TOKEN_HEX }, { repos: r })
    expect(r.users.create).not.toHaveBeenCalled()
    expect(result.userId).toBe(existingUser.id)
  })

  it('calls markEmailVerified for a newly-created user', async () => {
    const r = makeRepos({ findByEmail: vi.fn().mockResolvedValue(null) })
    await verifyMagicLink({ token: FIXED_TOKEN_HEX }, { repos: r })
    expect(r.users.markEmailVerified).toHaveBeenCalledWith(fakeUser.id)
  })

  it('calls markEmailVerified for an existing unverified user', async () => {
    const unverifiedUser = { ...fakeUser, email_verified_at: null }
    const r = makeRepos({ findByEmail: vi.fn().mockResolvedValue(unverifiedUser) })
    await verifyMagicLink({ token: FIXED_TOKEN_HEX }, { repos: r })
    expect(r.users.markEmailVerified).toHaveBeenCalledWith(unverifiedUser.id)
  })

  it('does NOT call markEmailVerified for an already-verified user', async () => {
    const verifiedUser = { ...fakeUser, email_verified_at: new Date('2026-01-01') }
    const r = makeRepos({ findByEmail: vi.fn().mockResolvedValue(verifiedUser) })
    await verifyMagicLink({ token: FIXED_TOKEN_HEX }, { repos: r })
    expect(r.users.markEmailVerified).not.toHaveBeenCalled()
  })

  it('throws AuthError(401) when consumeByHash returns null (expired or already used)', async () => {
    const r = makeRepos({ consumeByHash: vi.fn().mockResolvedValue(null) })
    await expect(
      verifyMagicLink({ token: FIXED_TOKEN_HEX }, { repos: r }),
    ).rejects.toThrow(AuthError)
    await expect(
      verifyMagicLink({ token: FIXED_TOKEN_HEX }, { repos: r }),
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('does NOT create user when consumeByHash returns null (token invalid)', async () => {
    const r = makeRepos({ consumeByHash: vi.fn().mockResolvedValue(null) })
    await expect(
      verifyMagicLink({ token: FIXED_TOKEN_HEX }, { repos: r }),
    ).rejects.toThrow()
    expect(r.users.create).not.toHaveBeenCalled()
  })
})

// ── createSession ─────────────────────────────────────────────────────────────

describe('createSession', () => {
  it('creates a session with 30-day expiry and returns the session id', async () => {
    const sessionsRepo = {
      create: vi.fn().mockResolvedValue(fakeSession),
    } as unknown as Repos['sessions']

    const result = await createSession(fakeUser.id, {
      repos: { sessions: sessionsRepo } as unknown as Pick<Repos, 'sessions'>,
      now:   () => FIXED_NOW,
    })

    expect(sessionsRepo.create).toHaveBeenCalledWith({
      user_id:    fakeUser.id,
      expires_at: SESSION_30_DAYS,
    })
    expect(result).toBe(fakeSession.id)
  })
})

// ── signCookie / verifyCookie ─────────────────────────────────────────────────

describe('signCookie / verifyCookie', () => {
  it('round-trip: verifyCookie(signCookie(id)) returns the original id', () => {
    const id = 'session-abc-123'
    const signed = signCookie(id, TEST_KEY)
    expect(verifyCookie(signed, TEST_KEY)).toBe(id)
  })

  it('signed value contains the id followed by a dot and a hex signature', () => {
    const id = 'session-abc-123'
    const signed = signCookie(id, TEST_KEY)
    expect(signed).toMatch(/^session-abc-123\.[0-9a-f]{64}$/)
  })

  it('verifyCookie returns null when the signature is tampered', () => {
    const id = 'session-abc-123'
    const signed = signCookie(id, TEST_KEY)
    const tampered = signed.slice(0, -4) + 'dead'
    expect(verifyCookie(tampered, TEST_KEY)).toBeNull()
  })

  it('verifyCookie returns null when no dot separator is present', () => {
    expect(verifyCookie('no-dot-at-all', TEST_KEY)).toBeNull()
  })

  it('verifyCookie returns null when the id part is modified', () => {
    const id = 'session-abc-123'
    const signed = signCookie(id, TEST_KEY)
    const dotIdx = signed.lastIndexOf('.')
    const tampered = 'evil-id' + signed.slice(dotIdx)
    expect(verifyCookie(tampered, TEST_KEY)).toBeNull()
  })

  it('verifyCookie returns null when signed with a different key', () => {
    const id = 'session-abc-123'
    const signed = signCookie(id, TEST_KEY)
    expect(verifyCookie(signed, 'wrong-key')).toBeNull()
  })
})
