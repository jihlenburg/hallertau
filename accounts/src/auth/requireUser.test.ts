/**
 * Unit tests for requireUser preHandler + loadSession — no real DB, no real HTTP.
 *
 * Scenarios:
 *  1. loadSession: valid session → returns { user, farm }
 *  2. loadSession: expired/unknown session (findById→null) → returns null
 *  3. loadSession: user has no farm membership → returns { user, farm: null }
 *  4. loadSession: uses the *owner* membership row to resolve the farm
 *  5. requireUser: valid signed cookie → sets req.user + req.farm, continues
 *  6. requireUser: missing cookie → 401 { error: 'unauthorized' }
 *  7. requireUser: bad/tampered cookie signature → 401
 *  8. requireUser: expired/unknown session → 401
 *  9. requireUser: user with no farm (farm: null) → still 200 (not a 401)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { signCookie } from './session.js'
import { requireUser, loadSession } from './requireUser.js'
import type { Repos } from '../db/repos.js'

const TEST_KEY = 'test-signing-key-requireUser-2026'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fakeUser = {
  id:                'user-ru-1',
  email:             'hopfen@hallertau.de',
  email_verified_at: new Date(),
  name:              null as string | null,
  last_login_at:     null as Date | null,
  created_at:        new Date(),
}

const fakeFarm = {
  id:             'farm-ru-1',
  betriebsnummer: '09123456789',
  name:           'Betrieb Huber',
  anbaugebiet:    'Hallertau',
  created_at:     new Date(),
}

const fakeSession = {
  id:         'session-ru-1',
  user_id:    fakeUser.id,
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  user_agent: null,
  ip:         null,
  created_at: new Date(),
}

const fakeOwnerMember = {
  farm_id:    fakeFarm.id,
  user_id:    fakeUser.id,
  role:       'owner' as const,
  created_at: new Date(),
}

// ── Test-repo factory ─────────────────────────────────────────────────────────

function makeRepos(override: Partial<{
  sessionFindById: ReturnType<typeof vi.fn>
  userFindById:    ReturnType<typeof vi.fn>
  membersByUserId: ReturnType<typeof vi.fn>
  farmFindById:    ReturnType<typeof vi.fn>
}> = {}): Pick<Repos, 'sessions' | 'users' | 'farmMembers' | 'farms'> {
  return {
    sessions: {
      findById: override.sessionFindById ?? vi.fn().mockResolvedValue(fakeSession),
    } as unknown as Repos['sessions'],
    users: {
      findById: override.userFindById ?? vi.fn().mockResolvedValue(fakeUser),
    } as unknown as Repos['users'],
    farmMembers: {
      findByUserId: override.membersByUserId ?? vi.fn().mockResolvedValue([fakeOwnerMember]),
    } as unknown as Repos['farmMembers'],
    farms: {
      findById: override.farmFindById ?? vi.fn().mockResolvedValue(fakeFarm),
    } as unknown as Repos['farms'],
  }
}

// ── loadSession ───────────────────────────────────────────────────────────────

describe('loadSession', () => {
  it('returns { user, farm } when session + user + farm all exist', async () => {
    const r = makeRepos()
    const result = await loadSession(fakeSession.id, { repos: r as unknown as Repos })
    expect(result).not.toBeNull()
    expect(result!.user.id).toBe(fakeUser.id)
    expect(result!.farm?.id).toBe(fakeFarm.id)
  })

  it('returns null when sessions.findById returns null (expired or unknown)', async () => {
    const r = makeRepos({ sessionFindById: vi.fn().mockResolvedValue(null) })
    const result = await loadSession('no-such-session', { repos: r as unknown as Repos })
    expect(result).toBeNull()
  })

  it('returns { user, farm: null } when user has no farm membership', async () => {
    const r = makeRepos({ membersByUserId: vi.fn().mockResolvedValue([]) })
    const result = await loadSession(fakeSession.id, { repos: r as unknown as Repos })
    expect(result).not.toBeNull()
    expect(result!.user.id).toBe(fakeUser.id)
    expect(result!.farm).toBeNull()
  })

  it('resolves the farm via the owner membership row (not a member row)', async () => {
    const memberRow = { ...fakeOwnerMember, farm_id: 'farm-member-only', role: 'member' as const }
    const ownerRow  = { ...fakeOwnerMember, farm_id: 'farm-owner-1', role: 'owner' as const }
    const farmFindById = vi.fn().mockResolvedValue({ ...fakeFarm, id: 'farm-owner-1' })
    const r = makeRepos({
      membersByUserId: vi.fn().mockResolvedValue([memberRow, ownerRow]),
      farmFindById,
    })
    const result = await loadSession(fakeSession.id, { repos: r as unknown as Repos })
    expect(farmFindById).toHaveBeenCalledWith('farm-owner-1')
    expect(result!.farm?.id).toBe('farm-owner-1')
  })
})

// ── requireUser preHandler ────────────────────────────────────────────────────

describe('requireUser', () => {
  beforeEach(() => {
    process.env.SESSION_SIGNING_KEY = TEST_KEY
  })
  afterEach(() => {
    delete process.env.SESSION_SIGNING_KEY
  })

  /** Builds a minimal Fastify app with a test-only GET /me route guarded by requireUser. */
  async function buildTestApp(reposOverride: Parameters<typeof makeRepos>[0] = {}) {
    const r = makeRepos(reposOverride)
    const app = Fastify({ logger: false })
    await app.register(fastifyCookie)

    const handler = requireUser({ repos: r as unknown as Repos, key: TEST_KEY })

    app.get('/me', { preHandler: handler }, async (req, reply) => {
      return reply.code(200).send({
        userId: req.user.id,
        farmId: req.farm?.id ?? null,
      })
    })

    return app
  }

  it('sets req.user and req.farm and continues when cookie is valid', async () => {
    const app = await buildTestApp()
    const signed = signCookie(fakeSession.id, TEST_KEY)
    const r = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: `db_session=${signed}` },
    })
    expect(r.statusCode).toBe(200)
    const body = r.json()
    expect(body.userId).toBe(fakeUser.id)
    expect(body.farmId).toBe(fakeFarm.id)
    await app.close()
  })

  it('returns 401 when no cookie is present', async () => {
    const app = await buildTestApp()
    const r = await app.inject({ method: 'GET', url: '/me' })
    expect(r.statusCode).toBe(401)
    expect(r.json()).toEqual({ error: 'unauthorized' })
    await app.close()
  })

  it('returns 401 when cookie signature is tampered', async () => {
    const app = await buildTestApp()
    const tampered = `db_session=${fakeSession.id}.deadbeefdeadbeefdeadbeefdeadbeef`
    const r = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: tampered },
    })
    expect(r.statusCode).toBe(401)
    expect(r.json()).toEqual({ error: 'unauthorized' })
    await app.close()
  })

  it('returns 401 when the session is expired or unknown', async () => {
    const app = await buildTestApp({ sessionFindById: vi.fn().mockResolvedValue(null) })
    const signed = signCookie(fakeSession.id, TEST_KEY)
    const r = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: `db_session=${signed}` },
    })
    expect(r.statusCode).toBe(401)
    expect(r.json()).toEqual({ error: 'unauthorized' })
    await app.close()
  })

  it('succeeds (200) when user has no farm yet — farm:null is not a 401', async () => {
    const app = await buildTestApp({ membersByUserId: vi.fn().mockResolvedValue([]) })
    const signed = signCookie(fakeSession.id, TEST_KEY)
    const r = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: `db_session=${signed}` },
    })
    expect(r.statusCode).toBe(200)
    const body = r.json()
    expect(body.userId).toBe(fakeUser.id)
    expect(body.farmId).toBeNull()
    await app.close()
  })
})
