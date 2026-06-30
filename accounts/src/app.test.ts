import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'crypto'
import { buildApp } from './app.js'
import { VERSION, CONTRACT } from './version.js'
import { verifyCookie } from './auth/session.js'
import type { Repos } from './db/repos.js'

// ── Health / version ──────────────────────────────────────────────────────────

describe('accounts app', () => {
  it('health', async () => {
    const app = buildApp()
    const r = await app.inject({ method: 'GET', url: '/api/accounts/health' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ status: 'ok' })
    await app.close()
  })

  it('GET /api/accounts/version → Vertragsversion', async () => {
    const app = buildApp()
    const r = await app.inject({ method: 'GET', url: '/api/accounts/version' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ name: 'doldenblick-accounts', version: VERSION, contract: CONTRACT })
    await app.close()
  })
})

// ── Auth route helpers ────────────────────────────────────────────────────────

const TEST_SIGNING_KEY = 'test-signing-key-for-route-tests'

const FIXED_TOKEN_HEX = 'ef'.repeat(32)
const FIXED_TOKEN_HASH = createHash('sha256')
  .update(Buffer.from(FIXED_TOKEN_HEX, 'hex'))
  .digest('hex')

const fakeUser = {
  id:                'user-route-1',
  email:             'bauer@hallertau.de',
  email_verified_at: null as Date | null,
  name:              null as string | null,
  last_login_at:     null as Date | null,
  created_at:        new Date(),
}

const fakeMagicToken = {
  id:         'token-route-1',
  user_id:    fakeUser.id,
  email:      fakeUser.email,
  token_hash: FIXED_TOKEN_HASH,
  purpose:    'verify',
  expires_at: new Date(Date.now() + 30 * 60 * 1000),
  used_at:    null as Date | null,
  created_at: new Date(),
}

const fakeSession = {
  id:         'session-route-1',
  user_id:    fakeUser.id,
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  user_agent: null,
  ip:         null,
  created_at: new Date(),
}

function makeAuthRepos(override: {
  consumeByHash?: ReturnType<typeof vi.fn>
} = {}): Repos {
  return {
    magicTokens: {
      consumeByHash: override.consumeByHash ?? vi.fn().mockResolvedValue(fakeMagicToken),
      create:        vi.fn().mockResolvedValue(fakeMagicToken),
    },
    users: {
      findByEmail:       vi.fn().mockResolvedValue(null),
      create:            vi.fn().mockResolvedValue(fakeUser),
      markEmailVerified: vi.fn().mockResolvedValue(undefined),
    },
    sessions: {
      create: vi.fn().mockResolvedValue(fakeSession),
    },
  } as unknown as Repos
}

// ── POST /api/auth/magic-link ─────────────────────────────────────────────────

describe('POST /api/auth/magic-link', () => {
  it('returns {ok:true} for a valid email', async () => {
    const repos = makeAuthRepos()
    // Override sendMail so no real HTTP is issued
    ;(repos.magicTokens.create as ReturnType<typeof vi.fn>).mockResolvedValue(fakeMagicToken)

    const app = buildApp({
      deps: { repos },
      sendMagicLinkEmail: async () => undefined,
    })
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/magic-link',
      payload: { email: 'bauer@hallertau.de' },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ ok: true })
    await app.close()
  })

  it('returns 400 when email is missing', async () => {
    const repos = makeAuthRepos()
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })
    const r = await app.inject({ method: 'POST', url: '/api/auth/magic-link', payload: {} })
    expect(r.statusCode).toBe(400)
    await app.close()
  })

  it('returns {ok:true} even when mail sending throws (address-enumeration guard)', async () => {
    const repos = makeAuthRepos()
    const app = buildApp({
      deps: { repos },
      sendMagicLinkEmail: async () => { throw new Error('postmark down') },
    })
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/magic-link',
      payload: { email: 'bauer@hallertau.de' },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ ok: true })
    await app.close()
  })
})

// ── Rate-limit: POST /api/auth/magic-link ─────────────────────────────────────

describe('Rate-limit auf /api/auth/magic-link', () => {
  it('gibt 429 zurück wenn dasselbe IP das Limit (5/15min) überschreitet', async () => {
    const repos = makeAuthRepos()
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    // Erste 5 Anfragen müssen durchkommen (oder 400 bei leerem body — egal, kein 429)
    for (let i = 0; i < 5; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/auth/magic-link',
        payload: { email: 'bauer@hallertau.de' },
        remoteAddress: '10.0.0.1',
      })
      expect(r.statusCode).not.toBe(429)
    }

    // 6. Anfrage derselben IP → 429 Too Many Requests
    const r6 = await app.inject({
      method: 'POST',
      url: '/api/auth/magic-link',
      payload: { email: 'bauer@hallertau.de' },
      remoteAddress: '10.0.0.1',
    })
    expect(r6.statusCode).toBe(429)

    await app.close()
  })
})

// ── POST /api/auth/verify ─────────────────────────────────────────────────────

describe('POST /api/auth/verify', () => {
  beforeEach(() => {
    process.env.SESSION_SIGNING_KEY = TEST_SIGNING_KEY
  })
  afterEach(() => {
    delete process.env.SESSION_SIGNING_KEY
  })

  it('returns 200 and sets a signed HttpOnly cookie for a valid token', async () => {
    const repos = makeAuthRepos()
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      payload: { token: FIXED_TOKEN_HEX },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ ok: true })

    const cookieHeader = r.headers['set-cookie'] as string | undefined
    expect(cookieHeader).toBeDefined()
    expect(cookieHeader).toContain('db_session=')
    expect(cookieHeader).toContain('HttpOnly')
    expect(cookieHeader).toContain('Secure')
    expect(cookieHeader).toContain('SameSite=Lax')
    expect(cookieHeader).toContain('Path=/')

    // Cookie value must be a valid signed session id
    const cookieValue = (cookieHeader as string).split(';')[0].replace('db_session=', '')
    const sessionId = verifyCookie(cookieValue, TEST_SIGNING_KEY)
    expect(sessionId).toBe(fakeSession.id)

    await app.close()
  })

  it('returns 401 when the token is already used or expired', async () => {
    const repos = makeAuthRepos({
      consumeByHash: vi.fn().mockResolvedValue(null),
    })
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      payload: { token: FIXED_TOKEN_HEX },
    })
    expect(r.statusCode).toBe(401)
    await app.close()
  })

  it('returns 400 when token is missing', async () => {
    const repos = makeAuthRepos()
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      payload: {},
    })
    expect(r.statusCode).toBe(400)
    await app.close()
  })
})
