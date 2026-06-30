/**
 * TDD tests for onboarding routes — Task 9.
 *
 * Endpoints under test:
 *   POST /api/onboarding/farm    — creates farms + farm_members(owner), behind requireUser
 *   POST /api/onboarding/schlaege — stores GeoJSON Schläge with in_region flag (soft, never rejects)
 *   GET  /api/onboarding/me      — returns { user, farm, schlaege }
 *
 * Invariants:
 *  1. POST /farm: 201 + farm when name provided and user has no farm yet.
 *  2. POST /farm: 409 when user already has a farm.
 *  3. POST /farm: 400 when name is missing.
 *  4. POST /farm: 401 when not authenticated.
 *  5. POST /schlaege: 201 + both Schläge stored (Hallertau in_region:true, Berlin in_region:false).
 *  6. POST /schlaege: NEVER 4xx for out-of-region — the Berlin field must be stored with in_region:false.
 *  7. POST /schlaege: 400 when user has no farm.
 *  8. POST /schlaege: 401 when not authenticated.
 *  9. GET  /me: 200 { user, farm, schlaege } for a user with farm + Schläge.
 * 10. GET  /me: 200 { user, farm:null, schlaege:[] } for a user without farm.
 * 11. GET  /me: 401 when not authenticated.
 * 12. Full integration flow: farm → schlaege → me.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildApp } from '../app.js'
import { signCookie } from '../auth/session.js'
import type { Repos, Farm, Schlag, FarmMember } from '../db/repos.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const TEST_KEY = 'test-signing-key-onboarding-2026'

// Au i.d.Hallertau — confirmed inside Hallertau Anbaugebiet by anbaugebiet.test.ts
const HALLERTAU_FEATURE = {
  type: 'Feature' as const,
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [11.77, 48.42],
        [11.79, 48.42],
        [11.79, 48.44],
        [11.77, 48.44],
        [11.77, 48.42],
      ],
    ],
  },
  properties: { name: 'Attenhofen West' },
}

// Berlin — outside all hop Anbaugebiete
const BERLIN_FEATURE = {
  type: 'Feature' as const,
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [13.39, 52.51],
        [13.41, 52.51],
        [13.41, 52.53],
        [13.39, 52.53],
        [13.39, 52.51],
      ],
    ],
  },
  properties: { name: 'Berlin Schlag' },
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fakeUser = {
  id:                'user-onboarding-1',
  email:             'huber@hallertau.de',
  email_verified_at: null as Date | null,
  name:              'Familie Huber' as string | null,
  last_login_at:     null as Date | null,
  created_at:        new Date(),
}

const fakeSession = {
  id:         'session-onboarding-1',
  user_id:    fakeUser.id,
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  user_agent: null,
  ip:         null,
  created_at: new Date(),
}

const fakeFarm: Farm = {
  id:             'farm-onboarding-1',
  name:           'Familie Huber',
  anbaugebiet:    'unbekannt',
  betriebsnummer: null,
  created_at:     new Date(),
}

const fakeOwnerMember: FarmMember = {
  farm_id:    fakeFarm.id,
  user_id:    fakeUser.id,
  role:       'owner',
  created_at: new Date(),
}

// ── Test-repo factory ─────────────────────────────────────────────────────────

interface ReposOverride {
  sessionFindById?:    ReturnType<typeof vi.fn>
  userFindById?:       ReturnType<typeof vi.fn>
  membersByUserId?:    ReturnType<typeof vi.fn>
  farmFindById?:       ReturnType<typeof vi.fn>
  farmsCreate?:        ReturnType<typeof vi.fn>
  farmMembersCreate?:  ReturnType<typeof vi.fn>
  schlaegeCreate?:     ReturnType<typeof vi.fn>
  schlaegeFindByFarmId?: ReturnType<typeof vi.fn>
}

function makeRepos(override: ReposOverride = {}): Repos {
  return {
    sessions: {
      findById: override.sessionFindById ?? vi.fn().mockResolvedValue(fakeSession),
    },
    users: {
      findById: override.userFindById ?? vi.fn().mockResolvedValue(fakeUser),
    },
    farmMembers: {
      findByUserId: override.membersByUserId ?? vi.fn().mockResolvedValue([]),
      create:       override.farmMembersCreate ?? vi.fn().mockResolvedValue(fakeOwnerMember),
    },
    farms: {
      findById: override.farmFindById ?? vi.fn().mockResolvedValue(fakeFarm),
      create:   override.farmsCreate  ?? vi.fn().mockResolvedValue(fakeFarm),
    },
    schlaege: {
      create:        override.schlaegeCreate      ?? vi.fn().mockResolvedValue({ id: 'schlag-1', farm_id: fakeFarm.id, name: 'Schlag', flik: null, geometry: null, kultur: null, sorte: null, source: 'draw', in_region: false, region: null, created_at: new Date() }),
      findByFarmId:  override.schlaegeFindByFarmId ?? vi.fn().mockResolvedValue([]),
    },
    // Other repos not used by onboarding routes — stubbed to silence TS
    magicTokens: {} as Repos['magicTokens'],
    passkeys:    {} as Repos['passkeys'],
  } as unknown as Repos
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

/** Signed session cookie for fakeSession.id using TEST_KEY. */
let signedCookie: string

beforeEach(() => {
  process.env.SESSION_SIGNING_KEY = TEST_KEY
  signedCookie = signCookie(fakeSession.id, TEST_KEY)
})

afterEach(() => {
  delete process.env.SESSION_SIGNING_KEY
})

// ── POST /api/onboarding/farm ─────────────────────────────────────────────────

describe('POST /api/onboarding/farm', () => {
  it('returns 201 + farm when name is provided and user has no farm', async () => {
    const farmsCreate = vi.fn().mockResolvedValue({
      ...fakeFarm,
      betriebsnummer: '09123456789',
    })
    const farmMembersCreate = vi.fn().mockResolvedValue(fakeOwnerMember)

    const repos = makeRepos({
      membersByUserId: vi.fn().mockResolvedValue([]), // no farm yet
      farmsCreate,
      farmMembersCreate,
    })
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/onboarding/farm',
      headers: { cookie: `db_session=${signedCookie}` },
      payload: { name: 'Familie Huber', betriebsnummer: '09123456789' },
    })

    expect(r.statusCode).toBe(201)
    const body = r.json()
    expect(body.id).toBe(fakeFarm.id)
    expect(body.betriebsnummer).toBe('09123456789')

    expect(farmsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Familie Huber', betriebsnummer: '09123456789' }),
    )
    expect(farmMembersCreate).toHaveBeenCalledWith({
      farm_id: fakeFarm.id,
      user_id: fakeUser.id,
      role:    'owner',
    })

    await app.close()
  })

  it('returns 409 when user already has a farm', async () => {
    const repos = makeRepos({
      membersByUserId: vi.fn().mockResolvedValue([fakeOwnerMember]),
      farmFindById:    vi.fn().mockResolvedValue(fakeFarm),
    })
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/onboarding/farm',
      headers: { cookie: `db_session=${signedCookie}` },
      payload: { name: 'Familie Huber' },
    })

    expect(r.statusCode).toBe(409)
    await app.close()
  })

  it('returns 400 when name is missing', async () => {
    const repos = makeRepos({ membersByUserId: vi.fn().mockResolvedValue([]) })
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/onboarding/farm',
      headers: { cookie: `db_session=${signedCookie}` },
      payload: {},
    })

    expect(r.statusCode).toBe(400)
    await app.close()
  })

  it('returns 401 when not authenticated', async () => {
    const repos = makeRepos()
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/onboarding/farm',
      payload: { name: 'Familie Huber' },
    })

    expect(r.statusCode).toBe(401)
    await app.close()
  })
})

// ── POST /api/onboarding/schlaege ─────────────────────────────────────────────

describe('POST /api/onboarding/schlaege', () => {
  it('stores both features and sets in_region correctly — never rejects out-of-region', async () => {
    const schlaegeStore: Schlag[] = []
    let idCounter = 0
    const schlaegeCreate = vi.fn().mockImplementation(async (input: Schlag) => {
      const s: Schlag = {
        id:         `schlag-${++idCounter}`,
        flik:       null,
        kultur:     null,
        sorte:      null,
        created_at: new Date(),
        ...input,
      }
      schlaegeStore.push(s)
      return s
    })

    const repos = makeRepos({
      membersByUserId: vi.fn().mockResolvedValue([fakeOwnerMember]),
      farmFindById:    vi.fn().mockResolvedValue(fakeFarm),
      schlaegeCreate,
    })
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/onboarding/schlaege',
      headers: { cookie: `db_session=${signedCookie}` },
      payload: { features: [HALLERTAU_FEATURE, BERLIN_FEATURE], source: 'draw' },
    })

    // Both features MUST be stored — never 4xx for out-of-region
    expect(r.statusCode).toBe(201)
    const result: Schlag[] = r.json()
    expect(result).toHaveLength(2)

    // Hallertau field: in_region true
    expect(result[0].in_region).toBe(true)
    expect(result[0].region).toBe('Hallertau')

    // Berlin field: in_region false — stored, not rejected
    expect(result[1].in_region).toBe(false)
    expect(result[1].region).toBeNull()

    expect(schlaegeCreate).toHaveBeenCalledTimes(2)

    await app.close()
  })

  it('defaults source to "draw" when not provided', async () => {
    const schlaegeCreate = vi.fn().mockImplementation(async (input: Schlag) => ({
      id: 'schlag-default', flik: null, kultur: null, sorte: null, created_at: new Date(), ...input,
    }))

    const repos = makeRepos({
      membersByUserId: vi.fn().mockResolvedValue([fakeOwnerMember]),
      farmFindById:    vi.fn().mockResolvedValue(fakeFarm),
      schlaegeCreate,
    })
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    await app.inject({
      method:  'POST',
      url:     '/api/onboarding/schlaege',
      headers: { cookie: `db_session=${signedCookie}` },
      payload: { features: [HALLERTAU_FEATURE] }, // no source
    })

    expect(schlaegeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'draw' }),
    )
    await app.close()
  })

  it('returns 400 when user has no farm', async () => {
    const repos = makeRepos({ membersByUserId: vi.fn().mockResolvedValue([]) })
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/onboarding/schlaege',
      headers: { cookie: `db_session=${signedCookie}` },
      payload: { features: [HALLERTAU_FEATURE] },
    })

    expect(r.statusCode).toBe(400)
    await app.close()
  })

  it('returns 400 when features is missing or empty', async () => {
    const repos = makeRepos({
      membersByUserId: vi.fn().mockResolvedValue([fakeOwnerMember]),
      farmFindById:    vi.fn().mockResolvedValue(fakeFarm),
    })
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/onboarding/schlaege',
      headers: { cookie: `db_session=${signedCookie}` },
      payload: { features: [] },
    })

    expect(r.statusCode).toBe(400)
    await app.close()
  })

  it('returns 401 when not authenticated', async () => {
    const repos = makeRepos()
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    const r = await app.inject({
      method:  'POST',
      url:     '/api/onboarding/schlaege',
      payload: { features: [HALLERTAU_FEATURE] },
    })

    expect(r.statusCode).toBe(401)
    await app.close()
  })
})

// ── GET /api/onboarding/me ────────────────────────────────────────────────────

describe('GET /api/onboarding/me', () => {
  it('returns user, farm, and schlaege for an authenticated user with farm', async () => {
    const schlag1: Schlag = {
      id: 'schlag-me-1', farm_id: fakeFarm.id, name: 'Attenhofen West',
      flik: null, geometry: HALLERTAU_FEATURE, kultur: null, sorte: null,
      source: 'draw', in_region: true, region: 'Hallertau', created_at: new Date(),
    }
    const schlag2: Schlag = {
      id: 'schlag-me-2', farm_id: fakeFarm.id, name: 'Berlin Schlag',
      flik: null, geometry: BERLIN_FEATURE, kultur: null, sorte: null,
      source: 'draw', in_region: false, region: null, created_at: new Date(),
    }

    const repos = makeRepos({
      membersByUserId:     vi.fn().mockResolvedValue([fakeOwnerMember]),
      farmFindById:        vi.fn().mockResolvedValue(fakeFarm),
      schlaegeFindByFarmId: vi.fn().mockResolvedValue([schlag1, schlag2]),
    })
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    const r = await app.inject({
      method:  'GET',
      url:     '/api/onboarding/me',
      headers: { cookie: `db_session=${signedCookie}` },
    })

    expect(r.statusCode).toBe(200)
    const me = r.json()
    expect(me.user.id).toBe(fakeUser.id)
    expect(me.farm.id).toBe(fakeFarm.id)
    expect(me.schlaege).toHaveLength(2)
    expect(me.schlaege[0].in_region).toBe(true)
    expect(me.schlaege[0].region).toBe('Hallertau')
    expect(me.schlaege[1].in_region).toBe(false)
    expect(me.schlaege[1].region).toBeNull()

    await app.close()
  })

  it('returns user, null farm, empty schlaege for a user without farm', async () => {
    const repos = makeRepos({ membersByUserId: vi.fn().mockResolvedValue([]) })
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    const r = await app.inject({
      method:  'GET',
      url:     '/api/onboarding/me',
      headers: { cookie: `db_session=${signedCookie}` },
    })

    expect(r.statusCode).toBe(200)
    const me = r.json()
    expect(me.user.id).toBe(fakeUser.id)
    expect(me.farm).toBeNull()
    expect(me.schlaege).toHaveLength(0)

    await app.close()
  })

  it('returns 401 when not authenticated', async () => {
    const repos = makeRepos()
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    const r = await app.inject({
      method: 'GET',
      url:    '/api/onboarding/me',
    })

    expect(r.statusCode).toBe(401)
    await app.close()
  })
})

// ── Full integration flow ─────────────────────────────────────────────────────

describe('onboarding integration flow', () => {
  it('farm → schlaege → me: stores both Schläge (one in Hallertau, one in Berlin) and returns them', async () => {
    // Mutable state that the stubs close over
    let farmStore:       Farm | null    = null
    const memberStore:   FarmMember[]   = []
    const schlaegeStore: Schlag[]       = []
    let schlagCounter = 0

    const farmsCreate = vi.fn().mockImplementation(async (input: { name: string; anbaugebiet: string; betriebsnummer?: string }) => {
      farmStore = { id: 'farm-flow-1', created_at: new Date(), betriebsnummer: null, ...input }
      return farmStore
    })

    const farmMembersCreate = vi.fn().mockImplementation(async (input: { farm_id: string; user_id: string; role: 'owner' | 'member' }) => {
      const m: FarmMember = { ...input, created_at: new Date() }
      memberStore.push(m)
      return m
    })

    const membersByUserId = vi.fn().mockImplementation(async () => [...memberStore])
    const farmFindById    = vi.fn().mockImplementation(async () => farmStore)

    const schlaegeCreate = vi.fn().mockImplementation(async (input: Schlag) => {
      const s: Schlag = {
        id: `schlag-flow-${++schlagCounter}`,
        flik: null, kultur: null, sorte: null,
        created_at: new Date(),
        ...input,
      }
      schlaegeStore.push(s)
      return s
    })

    const schlaegeFindByFarmId = vi.fn().mockImplementation(async () => [...schlaegeStore])

    const repos = makeRepos({
      membersByUserId,
      farmFindById,
      farmsCreate,
      farmMembersCreate,
      schlaegeCreate,
      schlaegeFindByFarmId,
    })
    const app = buildApp({ deps: { repos }, sendMagicLinkEmail: async () => undefined })

    // Step 1: Create farm
    const r1 = await app.inject({
      method:  'POST',
      url:     '/api/onboarding/farm',
      headers: { cookie: `db_session=${signedCookie}` },
      payload: { name: 'Familie Huber', betriebsnummer: '09123456789' },
    })
    expect(r1.statusCode).toBe(201)
    expect(r1.json().name).toBe('Familie Huber')

    // Step 2: POST schlaege — one Hallertau, one Berlin
    const r2 = await app.inject({
      method:  'POST',
      url:     '/api/onboarding/schlaege',
      headers: { cookie: `db_session=${signedCookie}` },
      payload: { features: [HALLERTAU_FEATURE, BERLIN_FEATURE] },
    })
    expect(r2.statusCode).toBe(201)
    const stored: Schlag[] = r2.json()
    expect(stored).toHaveLength(2)

    // Hallertau → in_region:true
    expect(stored[0].in_region).toBe(true)
    expect(stored[0].region).toBe('Hallertau')

    // Berlin → in_region:false — NEVER rejected
    expect(stored[1].in_region).toBe(false)
    expect(stored[1].region).toBeNull()

    // Step 3: GET /me returns user + farm + both Schläge
    const r3 = await app.inject({
      method:  'GET',
      url:     '/api/onboarding/me',
      headers: { cookie: `db_session=${signedCookie}` },
    })
    expect(r3.statusCode).toBe(200)
    const me = r3.json()
    expect(me.user.id).toBe(fakeUser.id)
    expect(me.farm.id).toBe('farm-flow-1')
    expect(me.schlaege).toHaveLength(2)
    expect(me.schlaege[0].in_region).toBe(true)
    expect(me.schlaege[1].in_region).toBe(false)

    await app.close()
  })
})
