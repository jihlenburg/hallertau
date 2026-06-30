/**
 * Unit tests for passkey routes — all deps injected (no DB, no real WebAuthn).
 *
 * Invariants under test (Task 6 brief — registration):
 *  1. POST /api/auth/passkey/register-options
 *       → persists the challenge server-side via repos.users.setChallenge
 *       → returns the options JSON from generateRegistrationOptions
 *       → passes existing credentials as excludeCredentials
 *  2. POST /api/auth/passkey/register-verify  (stubbed verify: { verified: true })
 *       → stores a passkey_credentials row for the user
 *       → clears the stored challenge (via finally)
 *       → returns 200 { ok: true }
 *  3. POST /api/auth/passkey/register-verify  (stubbed verify: { verified: false })
 *       → returns 400
 *       → does NOT call passkeys.create
 *  4. POST /api/auth/passkey/register-verify  (no pending challenge)
 *       → returns 400 before calling verifyRegistrationResponse
 *  5. POST /api/auth/passkey/register-verify  (attResp missing)
 *       → returns 400
 *
 * Invariants under test (Task 7 brief — authentication):
 *  6. POST /api/auth/passkey/auth-options  (email provided, user found)
 *       → stores challenge server-side for user
 *       → returns options JSON (allowCredentials from stored creds)
 *  7. POST /api/auth/passkey/auth-options  (no email)
 *       → returns options, does NOT call setChallenge
 *  8. POST /api/auth/passkey/auth-verify  (verified:true, newCounter > stored)
 *       → counter updated, session cookie set, returns 200 { ok: true }
 *  9. POST /api/auth/passkey/auth-verify  (counter regression: newCounter ≤ stored)
 *       → returns 400, no session cookie
 * 10. POST /api/auth/passkey/auth-verify  (verified:false)
 *       → returns 400
 * 11. POST /api/auth/passkey/auth-verify  (no pending challenge)
 *       → returns 400
 * 12. POST /api/auth/passkey/auth-verify  (credential not found)
 *       → returns 400
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type preHandlerHookHandler } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { registerPasskeyRoutes } from './passkey.js'
import { verifyCookie } from './session.js'
import type { Repos } from '../db/repos.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_SIGNING_KEY = 'test-passkey-signing-key'

const fakeUser = {
  id:                'user-pk-1',
  email:             'bauer@hallertau.de',
  email_verified_at: new Date(),
  name:              'Sepp Huber' as string | null,
  last_login_at:     null as Date | null,
  created_at:        new Date(),
}

/** Existing stored credential (used to test excludeCredentials and auth flow). */
const fakeExistingCred = {
  id:             'pk-cred-existing',
  user_id:        fakeUser.id,
  credential_id:  'existing-cred-base64url',
  public_key:     Buffer.from([9, 8, 7]),
  counter:        5,
  transports:     ['internal'] as string[] | null,
  device_name:    null as string | null,
  last_used_at:   null as Date | null,
  created_at:     new Date(),
}

/** Stored credential row returned by repos.passkeys.create on success. */
const fakeNewCred = {
  id:             'pk-cred-new',
  user_id:        fakeUser.id,
  credential_id:  'new-cred-base64url',
  public_key:     Buffer.from([1, 2, 3]),
  counter:        0,
  transports:     null as string[] | null,
  device_name:    null as string | null,
  last_used_at:   null as Date | null,
  created_at:     new Date(),
}

/** Minimal options JSON that generateRegistrationOptions would return. */
const fakeOptions = {
  challenge:        'challenge-base64url-abc123',
  rp:               { id: 'localhost', name: 'DoldenBlick' },
  user:             { id: fakeUser.id, name: fakeUser.email, displayName: fakeUser.name! },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
  timeout:          60000,
  attestation:      'none',
  excludeCredentials: [],
  authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
}

/** Minimal registrationInfo that verifyRegistrationResponse returns on success. */
const fakeRegistrationInfo = {
  credential: {
    id:         'new-cred-base64url',
    publicKey:  new Uint8Array([1, 2, 3]),
    counter:    0,
    transports: ['internal' as const],
  },
}

/** Minimal options JSON returned by generateAuthenticationOptions. */
const fakeAuthOptions = {
  challenge:          'auth-challenge-base64url',
  rpId:               'localhost',
  timeout:            60000,
  userVerification:   'preferred',
  allowCredentials:   [],
}

/** Fake session row returned by repos.sessions.create. */
const fakeSession = {
  id:         'session-auth-1',
  user_id:    fakeUser.id,
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  user_agent: null,
  ip:         null,
  created_at: new Date(),
}

/**
 * Fake preHandler that sets req.user directly, bypassing cookie/session lookup.
 * This lets passkey route tests focus on passkey logic rather than auth machinery.
 */
const fakeAuthGuard: preHandlerHookHandler = async (req, _reply) => {
  req.user = fakeUser
  req.farm = null
}

// ── Test-repo factory ─────────────────────────────────────────────────────────

function makePasskeyRepos(override: Partial<{
  passkeyCreate:         ReturnType<typeof vi.fn>
  passkeyByUserId:       ReturnType<typeof vi.fn>
  passkeyByCredId:       ReturnType<typeof vi.fn>
  passkeyUpdateCounter:  ReturnType<typeof vi.fn>
  usersSetChallenge:     ReturnType<typeof vi.fn>
  usersClearChallenge:   ReturnType<typeof vi.fn>
  usersGetChallenge:     ReturnType<typeof vi.fn>
  usersFindByEmail:      ReturnType<typeof vi.fn>
  sessionsCreate:        ReturnType<typeof vi.fn>
}> = {}): Pick<Repos, 'passkeys' | 'users' | 'sessions'> {
  return {
    passkeys: {
      create:              override.passkeyCreate        ?? vi.fn().mockResolvedValue(fakeNewCred),
      findByUserId:        override.passkeyByUserId      ?? vi.fn().mockResolvedValue([]),
      findByCredentialId:  override.passkeyByCredId      ?? vi.fn().mockResolvedValue(fakeExistingCred),
      updateCounter:       override.passkeyUpdateCounter ?? vi.fn().mockResolvedValue(undefined),
    } as unknown as Repos['passkeys'],
    users: {
      setChallenge:   override.usersSetChallenge   ?? vi.fn().mockResolvedValue(undefined),
      clearChallenge: override.usersClearChallenge ?? vi.fn().mockResolvedValue(undefined),
      getChallenge:   override.usersGetChallenge   ?? vi.fn().mockResolvedValue('challenge-base64url-abc123'),
      findByEmail:    override.usersFindByEmail    ?? vi.fn().mockResolvedValue(fakeUser),
    } as unknown as Repos['users'],
    sessions: {
      create: override.sessionsCreate ?? vi.fn().mockResolvedValue(fakeSession),
    } as unknown as Repos['sessions'],
  }
}

// ── App builder ───────────────────────────────────────────────────────────────

async function buildTestApp(opts: {
  reposOverride?:       Parameters<typeof makePasskeyRepos>[0]
  stubGenOptions?:      ReturnType<typeof vi.fn>
  stubVerify?:          ReturnType<typeof vi.fn>
  stubGenAuthOptions?:  ReturnType<typeof vi.fn>
  stubVerifyAuth?:      ReturnType<typeof vi.fn>
  sessionKey?:          string
} = {}) {
  const mockRepos = makePasskeyRepos(opts.reposOverride)

  const app = Fastify({ logger: false })
  await app.register(fastifyCookie)

  registerPasskeyRoutes(app, {
    repos:                       mockRepos as unknown as Repos,
    generateRegistrationOptions: opts.stubGenOptions    ?? vi.fn().mockResolvedValue(fakeOptions),
    verifyRegistrationResponse:  opts.stubVerify        ?? vi.fn().mockResolvedValue({
      verified: true,
      registrationInfo: fakeRegistrationInfo,
    }),
    generateAuthenticationOptions: opts.stubGenAuthOptions ?? vi.fn().mockResolvedValue(fakeAuthOptions),
    verifyAuthenticationResponse:  opts.stubVerifyAuth     ?? vi.fn().mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 6 },
    }),
    sessionKey:      opts.sessionKey ?? TEST_SIGNING_KEY,
    rpID:            'localhost',
    origin:          'http://localhost',
    authPreHandler:  fakeAuthGuard,
  })

  return { app, repos: mockRepos }
}

// ── register-options ──────────────────────────────────────────────────────────

describe('POST /api/auth/passkey/register-options', () => {
  it('persists the challenge server-side (tied to the authenticated user)', async () => {
    const usersSetChallenge = vi.fn().mockResolvedValue(undefined)
    const stubGenOptions    = vi.fn().mockResolvedValue(fakeOptions)

    const { app } = await buildTestApp({ reposOverride: { usersSetChallenge }, stubGenOptions })

    const r = await app.inject({ method: 'POST', url: '/api/auth/passkey/register-options' })

    expect(r.statusCode).toBe(200)
    expect(usersSetChallenge).toHaveBeenCalledOnce()
    expect(usersSetChallenge).toHaveBeenCalledWith(fakeUser.id, fakeOptions.challenge)

    await app.close()
  })

  it('returns the registration options JSON from generateRegistrationOptions', async () => {
    const { app } = await buildTestApp()

    const r = await app.inject({ method: 'POST', url: '/api/auth/passkey/register-options' })

    expect(r.statusCode).toBe(200)
    expect(r.json().challenge).toBe(fakeOptions.challenge)

    await app.close()
  })

  it('passes existing credentials as excludeCredentials', async () => {
    const passkeyByUserId = vi.fn().mockResolvedValue([fakeExistingCred])
    const stubGenOptions  = vi.fn().mockResolvedValue(fakeOptions)

    const { app } = await buildTestApp({ reposOverride: { passkeyByUserId }, stubGenOptions })

    await app.inject({ method: 'POST', url: '/api/auth/passkey/register-options' })

    const callArgs = stubGenOptions.mock.calls[0][0] as { excludeCredentials: { id: string }[] }
    expect(callArgs.excludeCredentials).toHaveLength(1)
    expect(callArgs.excludeCredentials[0].id).toBe(fakeExistingCred.credential_id)

    await app.close()
  })
})

// ── register-verify ───────────────────────────────────────────────────────────

describe('POST /api/auth/passkey/register-verify', () => {
  /** Minimal attestation response body (the stub ignores actual values). */
  const attResp = {
    id:       'new-cred-base64url',
    rawId:    'new-cred-base64url',
    response: { clientDataJSON: 'x', attestationObject: 'y', transports: ['internal'] },
    type:     'public-key',
    clientExtensionResults: {},
  }

  it('stores a passkey_credentials row for the user when verified: true', async () => {
    const passkeyCreate = vi.fn().mockResolvedValue(fakeNewCred)
    const stubVerify    = vi.fn().mockResolvedValue({ verified: true, registrationInfo: fakeRegistrationInfo })

    const { app } = await buildTestApp({ reposOverride: { passkeyCreate }, stubVerify })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/register-verify',
      payload: { attResp },
    })

    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ ok: true })
    expect(passkeyCreate).toHaveBeenCalledOnce()
    expect(passkeyCreate).toHaveBeenCalledWith(expect.objectContaining({
      user_id:       fakeUser.id,
      credential_id: fakeRegistrationInfo.credential.id,
    }))

    await app.close()
  })

  it('clears the stored challenge after successful verification (finally block)', async () => {
    const usersClearChallenge = vi.fn().mockResolvedValue(undefined)
    const stubVerify          = vi.fn().mockResolvedValue({ verified: true, registrationInfo: fakeRegistrationInfo })

    const { app } = await buildTestApp({ reposOverride: { usersClearChallenge }, stubVerify })

    await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/register-verify',
      payload: { attResp },
    })

    expect(usersClearChallenge).toHaveBeenCalledOnce()
    expect(usersClearChallenge).toHaveBeenCalledWith(fakeUser.id)

    await app.close()
  })

  it('returns 400 and does NOT store a credential when verified: false', async () => {
    const passkeyCreate = vi.fn()
    const stubVerify    = vi.fn().mockResolvedValue({ verified: false })

    const { app } = await buildTestApp({ reposOverride: { passkeyCreate }, stubVerify })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/register-verify',
      payload: { attResp },
    })

    expect(r.statusCode).toBe(400)
    expect(passkeyCreate).not.toHaveBeenCalled()

    await app.close()
  })

  it('returns 400 when no challenge is pending for the user', async () => {
    const usersGetChallenge = vi.fn().mockResolvedValue(null)

    const { app } = await buildTestApp({ reposOverride: { usersGetChallenge } })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/register-verify',
      payload: { attResp },
    })

    expect(r.statusCode).toBe(400)
    expect(r.json().error).toMatch(/registrierung/i)

    await app.close()
  })

  it('returns 400 when attResp is missing from the request body', async () => {
    const { app } = await buildTestApp()

    const r = await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/register-verify',
      payload: {},
    })

    expect(r.statusCode).toBe(400)

    await app.close()
  })
})

// ── auth-options ──────────────────────────────────────────────────────────────

describe('POST /api/auth/passkey/auth-options', () => {
  it('stores the challenge server-side when a known email is provided', async () => {
    const usersSetChallenge  = vi.fn().mockResolvedValue(undefined)
    const usersFindByEmail   = vi.fn().mockResolvedValue(fakeUser)
    const passkeyByUserId    = vi.fn().mockResolvedValue([fakeExistingCred])
    const stubGenAuthOptions = vi.fn().mockResolvedValue(fakeAuthOptions)

    const { app } = await buildTestApp({
      reposOverride:      { usersSetChallenge, usersFindByEmail, passkeyByUserId },
      stubGenAuthOptions,
    })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/auth-options',
      payload: { email: fakeUser.email },
    })

    expect(r.statusCode).toBe(200)
    expect(r.json().challenge).toBe(fakeAuthOptions.challenge)
    expect(usersSetChallenge).toHaveBeenCalledOnce()
    expect(usersSetChallenge).toHaveBeenCalledWith(fakeUser.id, fakeAuthOptions.challenge)

    await app.close()
  })

  it('passes stored credentials as allowCredentials when email is provided', async () => {
    const passkeyByUserId    = vi.fn().mockResolvedValue([fakeExistingCred])
    const stubGenAuthOptions = vi.fn().mockResolvedValue(fakeAuthOptions)

    const { app } = await buildTestApp({ reposOverride: { passkeyByUserId }, stubGenAuthOptions })

    await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/auth-options',
      payload: { email: fakeUser.email },
    })

    const callArgs = stubGenAuthOptions.mock.calls[0][0] as { allowCredentials: { id: string }[] }
    expect(callArgs.allowCredentials).toHaveLength(1)
    expect(callArgs.allowCredentials[0].id).toBe(fakeExistingCred.credential_id)

    await app.close()
  })

  it('returns options without storing a challenge when no email is provided', async () => {
    const usersSetChallenge  = vi.fn()
    const stubGenAuthOptions = vi.fn().mockResolvedValue(fakeAuthOptions)

    const { app } = await buildTestApp({
      reposOverride:      { usersSetChallenge },
      stubGenAuthOptions,
    })

    const r = await app.inject({ method: 'POST', url: '/api/auth/passkey/auth-options', payload: {} })

    expect(r.statusCode).toBe(200)
    expect(r.json().challenge).toBe(fakeAuthOptions.challenge)
    expect(usersSetChallenge).not.toHaveBeenCalled()

    await app.close()
  })
})

// ── auth-verify ───────────────────────────────────────────────────────────────

describe('POST /api/auth/passkey/auth-verify', () => {
  beforeEach(() => {
    process.env.SESSION_SIGNING_KEY = TEST_SIGNING_KEY
  })
  afterEach(() => {
    delete process.env.SESSION_SIGNING_KEY
  })

  /** Minimal assertion body — stub ignores actual values, uses credential id for DB lookup. */
  const assertion = {
    id:       fakeExistingCred.credential_id,
    rawId:    fakeExistingCred.credential_id,
    response: {
      clientDataJSON:    'x',
      authenticatorData: 'y',
      signature:         'z',
    },
    type: 'public-key',
    clientExtensionResults: {},
  }

  it('returns 200, updates counter, and sets a signed db_session cookie on success', async () => {
    const passkeyUpdateCounter = vi.fn().mockResolvedValue(undefined)
    const sessionsCreate       = vi.fn().mockResolvedValue(fakeSession)
    const stubVerifyAuth       = vi.fn().mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 6 },  // > stored counter (5)
    })

    const { app } = await buildTestApp({
      reposOverride: { passkeyUpdateCounter, sessionsCreate },
      stubVerifyAuth,
    })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/auth-verify',
      payload: { assertion },
    })

    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ ok: true })

    // Counter must be updated to the new value
    expect(passkeyUpdateCounter).toHaveBeenCalledOnce()
    expect(passkeyUpdateCounter).toHaveBeenCalledWith(fakeExistingCred.id, 6)

    // Session must be created for the credential's user
    expect(sessionsCreate).toHaveBeenCalledOnce()
    expect(sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      user_id: fakeExistingCred.user_id,
    }))

    // Cookie must be set with correct flags
    const cookieHeader = r.headers['set-cookie'] as string | undefined
    expect(cookieHeader).toBeDefined()
    expect(cookieHeader).toContain('db_session=')
    expect(cookieHeader).toContain('HttpOnly')
    expect(cookieHeader).toContain('Secure')
    expect(cookieHeader).toContain('SameSite=Lax')
    expect(cookieHeader).toContain('Path=/')

    // Cookie value must be a validly-signed session id
    const rawVal = (cookieHeader as string).split(';')[0].replace('db_session=', '')
    const sessionId = verifyCookie(rawVal, TEST_SIGNING_KEY)
    expect(sessionId).toBe(fakeSession.id)

    await app.close()
  })

  it('returns 400 and no session cookie when newCounter ≤ stored counter (counter regression)', async () => {
    const passkeyUpdateCounter = vi.fn()
    const sessionsCreate       = vi.fn()
    const stubVerifyAuth       = vi.fn().mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 5 },  // == stored counter (5) → regression
    })

    const { app } = await buildTestApp({
      reposOverride: { passkeyUpdateCounter, sessionsCreate },
      stubVerifyAuth,
    })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/auth-verify',
      payload: { assertion },
    })

    expect(r.statusCode).toBe(400)
    expect(r.headers['set-cookie']).toBeUndefined()
    expect(passkeyUpdateCounter).not.toHaveBeenCalled()
    expect(sessionsCreate).not.toHaveBeenCalled()

    await app.close()
  })

  it('returns 400 when verifyAuthenticationResponse returns verified: false', async () => {
    const sessionsCreate = vi.fn()
    const stubVerifyAuth = vi.fn().mockResolvedValue({ verified: false })

    const { app } = await buildTestApp({
      reposOverride: { sessionsCreate },
      stubVerifyAuth,
    })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/auth-verify',
      payload: { assertion },
    })

    expect(r.statusCode).toBe(400)
    expect(r.headers['set-cookie']).toBeUndefined()
    expect(sessionsCreate).not.toHaveBeenCalled()

    await app.close()
  })

  it('returns 400 when no pending challenge exists for the user', async () => {
    const usersGetChallenge = vi.fn().mockResolvedValue(null)

    const { app } = await buildTestApp({ reposOverride: { usersGetChallenge } })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/auth-verify',
      payload: { assertion },
    })

    expect(r.statusCode).toBe(400)
    expect(r.headers['set-cookie']).toBeUndefined()

    await app.close()
  })

  it('returns 400 when the credential id is not found in the database', async () => {
    const passkeyByCredId = vi.fn().mockResolvedValue(null)

    const { app } = await buildTestApp({ reposOverride: { passkeyByCredId } })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/auth-verify',
      payload: { assertion },
    })

    expect(r.statusCode).toBe(400)
    expect(r.headers['set-cookie']).toBeUndefined()

    await app.close()
  })

  it('clears the challenge in the finally block even when updateCounter throws', async () => {
    const usersClearChallenge  = vi.fn().mockResolvedValue(undefined)
    const passkeyUpdateCounter = vi.fn().mockRejectedValue(new Error('DB explodiert'))
    const stubVerifyAuth       = vi.fn().mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 6 },
    })

    const { app } = await buildTestApp({
      reposOverride: { usersClearChallenge, passkeyUpdateCounter },
      stubVerifyAuth,
    })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/auth/passkey/auth-verify',
      payload: { assertion },
    })

    // Route should propagate the error (500) but challenge must be cleared
    expect([400, 500]).toContain(r.statusCode)
    expect(usersClearChallenge).toHaveBeenCalledOnce()
    expect(usersClearChallenge).toHaveBeenCalledWith(fakeExistingCred.user_id)

    await app.close()
  })
})
