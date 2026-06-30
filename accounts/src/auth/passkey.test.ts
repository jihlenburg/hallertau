/**
 * Unit tests for passkey registration routes — all deps injected (no DB, no real WebAuthn).
 *
 * Invariants under test (Task 6 brief):
 *  1. POST /api/auth/passkey/register-options
 *       → persists the challenge server-side via repos.users.setChallenge
 *       → returns the options JSON from generateRegistrationOptions
 *       → passes existing credentials as excludeCredentials
 *  2. POST /api/auth/passkey/register-verify  (stubbed verify: { verified: true })
 *       → stores a passkey_credentials row for the user
 *       → clears the stored challenge
 *       → returns 200 { ok: true }
 *  3. POST /api/auth/passkey/register-verify  (stubbed verify: { verified: false })
 *       → returns 400
 *       → does NOT call passkeys.create
 *  4. POST /api/auth/passkey/register-verify  (no pending challenge)
 *       → returns 400 before calling verifyRegistrationResponse
 *  5. POST /api/auth/passkey/register-verify  (attResp missing)
 *       → returns 400
 */

import { describe, it, expect, vi } from 'vitest'
import Fastify, { type preHandlerHookHandler } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { registerPasskeyRoutes } from './passkey.js'
import type { Repos } from '../db/repos.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fakeUser = {
  id:                'user-pk-1',
  email:             'bauer@hallertau.de',
  email_verified_at: new Date(),
  name:              'Sepp Huber' as string | null,
  last_login_at:     null as Date | null,
  created_at:        new Date(),
}

/** Existing stored credential (used to test excludeCredentials). */
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
  passkeyCreate:      ReturnType<typeof vi.fn>
  passkeyByUserId:    ReturnType<typeof vi.fn>
  usersSetChallenge:  ReturnType<typeof vi.fn>
  usersClearChallenge: ReturnType<typeof vi.fn>
  usersGetChallenge:  ReturnType<typeof vi.fn>
}> = {}): Pick<Repos, 'passkeys' | 'users'> {
  return {
    passkeys: {
      create:        override.passkeyCreate   ?? vi.fn().mockResolvedValue(fakeNewCred),
      findByUserId:  override.passkeyByUserId ?? vi.fn().mockResolvedValue([]),
    } as unknown as Repos['passkeys'],
    users: {
      setChallenge:   override.usersSetChallenge   ?? vi.fn().mockResolvedValue(undefined),
      clearChallenge: override.usersClearChallenge ?? vi.fn().mockResolvedValue(undefined),
      getChallenge:   override.usersGetChallenge   ?? vi.fn().mockResolvedValue('challenge-base64url-abc123'),
    } as unknown as Repos['users'],
  }
}

// ── App builder ───────────────────────────────────────────────────────────────

async function buildTestApp(opts: {
  reposOverride?:  Parameters<typeof makePasskeyRepos>[0]
  stubGenOptions?: ReturnType<typeof vi.fn>
  stubVerify?:     ReturnType<typeof vi.fn>
} = {}) {
  const mockRepos = makePasskeyRepos(opts.reposOverride)

  const app = Fastify({ logger: false })
  await app.register(fastifyCookie)

  registerPasskeyRoutes(app, {
    repos:                      mockRepos as unknown as Repos,
    generateRegistrationOptions: opts.stubGenOptions ?? vi.fn().mockResolvedValue(fakeOptions),
    verifyRegistrationResponse:  opts.stubVerify    ?? vi.fn().mockResolvedValue({
      verified: true,
      registrationInfo: fakeRegistrationInfo,
    }),
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

  it('clears the stored challenge after successful verification', async () => {
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
