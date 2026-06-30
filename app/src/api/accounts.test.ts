/**
 * Test-Suite für app/src/api/accounts.ts
 *
 * Testet die Client-API für Auth (Magic-Link, Passkey) und Onboarding (Me, Farm, Schläge).
 * Fetch wird per vi.stubGlobal gemockt; @simplewebauthn/browser wird per vi.mock gemockt.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  requestMagicLink,
  verifyToken,
  getMe,
  saveFarm,
  saveSchlaege,
  registerPasskey,
  authPasskey,
  CLIENT_API_VERSION,
} from './accounts'

// Mock @simplewebauthn/browser so browser-native WebAuthn APIs are not needed in test environment
vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}))

import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

const mockStartRegistration = vi.mocked(startRegistration)
const mockStartAuthentication = vi.mocked(startAuthentication)

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  const f = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status }),
  )
  vi.stubGlobal('fetch', f)
  return f
}

function mockFetchError(msg: string): void {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error(msg) }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ── requestMagicLink ─────────────────────────────────────────────────────────

describe('requestMagicLink', () => {
  it('POSTet an /api/auth/magic-link mit der E-Mail-Adresse', async () => {
    const f = mockFetch({ ok: true })
    const r = await requestMagicLink('bauer@example.de')
    expect(r.kind).toBe('ok')
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/auth/magic-link')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect((init.headers as Record<string, string>)['X-Client-API']).toBe(String(CLIENT_API_VERSION))
    const reqBody = JSON.parse(String(init.body))
    expect(reqBody.email).toBe('bauer@example.de')
  })

  it('HTTP-Fehler → kind error, kein throw', async () => {
    mockFetch({ error: 'not found' }, 404)
    const r = await requestMagicLink('x@y.de')
    expect(r.kind).toBe('error')
    if (r.kind === 'error') expect(r.message).toContain('404')
  })

  it('Netzwerkfehler → kind error', async () => {
    mockFetchError('network fail')
    const r = await requestMagicLink('x@y.de')
    expect(r.kind).toBe('error')
    if (r.kind === 'error') expect(r.message).toContain('network')
  })
})

// ── verifyToken ───────────────────────────────────────────────────────────────

describe('verifyToken', () => {
  it('POSTet Token an /api/auth/verify und gibt User zurück', async () => {
    const user = { id: 'u1', email: 'bauer@example.de', createdAt: '2026-06-28T00:00:00Z' }
    const f = mockFetch(user)
    const r = await verifyToken('abc123')
    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') {
      expect(r.user.id).toBe('u1')
      expect(r.user.email).toBe('bauer@example.de')
    }
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/auth/verify')
    expect(init.credentials).toBe('include')
    const reqBody = JSON.parse(String(init.body))
    expect(reqBody.token).toBe('abc123')
  })

  it('HTTP-Fehler → kind error', async () => {
    mockFetch({}, 401)
    const r = await verifyToken('bad-token')
    expect(r.kind).toBe('error')
  })
})

// ── getMe ─────────────────────────────────────────────────────────────────────

describe('getMe', () => {
  const meBody = {
    user: { id: 'u1', email: 'bauer@example.de', createdAt: '2026-06-28T00:00:00Z' },
    farm: { id: 'f1', name: 'Familie Huber', betriebsnummer: '09184' },
    schlaege: [{ id: 's1', name: 'Attenhofen West' }],
  }

  it('GETtet /api/onboarding/me und parst {user,farm,schlaege}', async () => {
    const f = mockFetch(meBody)
    const r = await getMe()
    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') {
      expect(r.data.user.email).toBe('bauer@example.de')
      expect(r.data.farm?.name).toBe('Familie Huber')
      expect(r.data.schlaege).toHaveLength(1)
    }
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/onboarding/me')
    expect((init as RequestInit).method).toBeUndefined() // GET ist Default
    expect(init.credentials).toBe('include')
    expect((init.headers as Record<string, string>)['X-Client-API']).toBe(String(CLIENT_API_VERSION))
  })

  it('farm kann null sein (Onboarding noch nicht abgeschlossen)', async () => {
    mockFetch({ ...meBody, farm: null, schlaege: [] })
    const r = await getMe()
    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') {
      expect(r.data.farm).toBeNull()
      expect(r.data.schlaege).toHaveLength(0)
    }
  })

  it('401 → kind error', async () => {
    mockFetch({}, 401)
    const r = await getMe()
    expect(r.kind).toBe('error')
    if (r.kind === 'error') expect(r.message).toContain('401')
  })

  it('Netzwerkfehler → kind error', async () => {
    mockFetchError('net down')
    const r = await getMe()
    expect(r.kind).toBe('error')
  })
})

// ── saveFarm ──────────────────────────────────────────────────────────────────

describe('saveFarm', () => {
  const savedFarm = { id: 'f1', name: 'Familie Huber', betriebsnummer: '09184' }

  it('POSTet {name,betriebsnummer} an /api/onboarding/farm', async () => {
    const f = mockFetch(savedFarm)
    const r = await saveFarm({ name: 'Familie Huber', betriebsnummer: '09184' })
    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') expect(r.farm.name).toBe('Familie Huber')
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/onboarding/farm')
    const reqBody = JSON.parse(String(init.body))
    expect(reqBody.name).toBe('Familie Huber')
    expect(reqBody.betriebsnummer).toBe('09184')
  })

  it('POSTet auch ohne optionale betriebsnummer', async () => {
    const f = mockFetch({ id: 'f2', name: 'Musterhof' })
    const r = await saveFarm({ name: 'Musterhof' })
    expect(r.kind).toBe('ok')
    const reqBody = JSON.parse(String((f.mock.calls[0] as [string, RequestInit])[1].body))
    expect(reqBody.betriebsnummer).toBeUndefined()
  })

  it('HTTP-Fehler → kind error', async () => {
    mockFetch({}, 422)
    expect((await saveFarm({ name: 'x' })).kind).toBe('error')
  })
})

// ── saveSchlaege ──────────────────────────────────────────────────────────────

describe('saveSchlaege', () => {
  const features = [
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: { name: 'Schlag A' } },
  ]

  it('POSTet {features} an /api/onboarding/schlaege', async () => {
    const f = mockFetch({ saved: 1 })
    const r = await saveSchlaege(features)
    expect(r.kind).toBe('ok')
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/onboarding/schlaege')
    const reqBody = JSON.parse(String(init.body))
    expect(Array.isArray(reqBody.features)).toBe(true)
    expect(reqBody.features).toHaveLength(1)
  })

  it('HTTP-Fehler → kind error', async () => {
    mockFetch({}, 500)
    expect((await saveSchlaege([])).kind).toBe('error')
  })
})

// ── registerPasskey ───────────────────────────────────────────────────────────

describe('registerPasskey', () => {
  const fakeOptions = { challenge: 'ch1', rp: { name: 'DoldenBlick' }, user: { id: 'u1', name: 'x', displayName: 'x' }, pubKeyCredParams: [] }
  const fakeCredential = { id: 'cred1', rawId: 'cred1', type: 'public-key', response: {} }

  beforeEach(() => {
    mockStartRegistration.mockResolvedValue(fakeCredential as unknown as Awaited<ReturnType<typeof startRegistration>>)
  })

  it('holt Optionen, führt Zeremonie durch, verifiziert Ergebnis', async () => {
    // Two sequential fetches: options → verify
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      call++
      if (call === 1) return new Response(JSON.stringify(fakeOptions), { status: 200 })
      return new Response(JSON.stringify({ verified: true }), { status: 200 })
    }))

    const r = await registerPasskey()
    expect(r.kind).toBe('ok')
    expect(mockStartRegistration).toHaveBeenCalledOnce()
    expect(mockStartRegistration).toHaveBeenCalledWith({ optionsJSON: fakeOptions })
  })

  it('options-Fehler → kind error', async () => {
    mockFetch({}, 500)
    const r = await registerPasskey()
    expect(r.kind).toBe('error')
    expect(mockStartRegistration).not.toHaveBeenCalled()
  })

  it('verify-Fehler → kind error', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++
      return new Response('{}', { status: call === 1 ? 200 : 400 })
    }))
    const r = await registerPasskey()
    expect(r.kind).toBe('error')
  })

  it('Browser-Abbruch (NotAllowedError) → kind aborted', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++
      return new Response(JSON.stringify(fakeOptions), { status: 200 })
    }))
    const err = new Error('NotAllowedError: user cancelled')
    mockStartRegistration.mockRejectedValue(err)
    const r = await registerPasskey()
    expect(r.kind).toBe('aborted')
  })
})

// ── authPasskey ───────────────────────────────────────────────────────────────

describe('authPasskey', () => {
  const fakeOptions = { challenge: 'ch2', timeout: 60000, rpId: 'doldenblick.de', allowCredentials: [] }
  const fakeAssertion = { id: 'cred1', rawId: 'cred1', type: 'public-key', response: {} }

  beforeEach(() => {
    mockStartAuthentication.mockResolvedValue(fakeAssertion as unknown as Awaited<ReturnType<typeof startAuthentication>>)
  })

  it('holt Optionen mit E-Mail, führt Zeremonie durch, verifiziert Ergebnis', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      call++
      if (call === 1) {
        const body = JSON.parse(String(init?.body))
        expect(body.email).toBe('bauer@example.de')
        return new Response(JSON.stringify(fakeOptions), { status: 200 })
      }
      return new Response(JSON.stringify({ verified: true }), { status: 200 })
    }))

    const r = await authPasskey('bauer@example.de')
    expect(r.kind).toBe('ok')
    expect(mockStartAuthentication).toHaveBeenCalledOnce()
    expect(mockStartAuthentication).toHaveBeenCalledWith({ optionsJSON: fakeOptions })
  })

  it('ohne E-Mail sendet leeres Objekt an auth-options', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      call++
      if (call === 1) {
        const body = JSON.parse(String(init?.body))
        expect(body.email).toBeUndefined()
        return new Response(JSON.stringify(fakeOptions), { status: 200 })
      }
      return new Response(JSON.stringify({ verified: true }), { status: 200 })
    }))
    const r = await authPasskey()
    expect(r.kind).toBe('ok')
  })

  it('options-Fehler → kind error', async () => {
    mockFetch({}, 401)
    const r = await authPasskey()
    expect(r.kind).toBe('error')
    expect(mockStartAuthentication).not.toHaveBeenCalled()
  })

  it('Browser-Abbruch → kind aborted', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fakeOptions), { status: 200 })))
    mockStartAuthentication.mockRejectedValue(new Error('NotAllowedError: cancelled'))
    const r = await authPasskey()
    expect(r.kind).toBe('aborted')
  })
})
