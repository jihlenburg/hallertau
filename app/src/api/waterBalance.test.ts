import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchWaterBalance, CLIENT_API_VERSION } from './waterBalance'

const okBody = {
  apiVersion: 1,
  card: 'water-balance',
  status: 'warn',
  dr: 76.7,
  ks: 1,
  deficit: 76.7,
  recommendMm: 0,
  taw: 180,
  raw: 90,
  window: { from: '2026-04-29', to: '2026-06-28', days: 61 },
  soil: { soilType: 'lehm', nfkMmPerM: 180, rootDepthM: 1 },
  asOf: '2026-06-28',
  caveats: ['…'],
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchWaterBalance', () => {
  it('ok: parst die Antwort, sendet lat/lon/soilType + X-Client-API-Header', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(okBody), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const r = await fetchWaterBalance({ lat: 48.42, lon: 11.78, soilType: 'lehm' })
    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') {
      expect(r.data.status).toBe('warn')
      expect(r.data.recommendMm).toBe(0)
      expect(r.data.taw).toBe(180)
    }
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/water-balance?')
    expect(String(url)).toContain('lat=48.4200')
    expect(String(url)).toContain('lon=11.7800')
    expect(String(url)).toContain('soilType=lehm')
    expect(init?.headers).toMatchObject({ 'X-Client-API': String(CLIENT_API_VERSION) })
  })

  it('426 → kind incompatible (Client veraltet)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 426 })))
    const r = await fetchWaterBalance({ lat: 48.42, lon: 11.78 })
    expect(r.kind).toBe('incompatible')
  })

  it('HTTP-Fehler → kind error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 502 })))
    const r = await fetchWaterBalance({ lat: 48.42, lon: 11.78 })
    expect(r.kind).toBe('error')
  })

  it('Netzwerkfehler → kind error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const r = await fetchWaterBalance({ lat: 48.42, lon: 11.78 })
    expect(r.kind).toBe('error')
    if (r.kind === 'error') expect(r.message).toContain('network')
  })

  it('optionale Boden-Parameter werden nur bei Angabe gesendet', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(okBody), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await fetchWaterBalance({ lat: 48.42, lon: 11.78, rootDepthM: 1.2, nfkMmPerM: 200 })
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('rootDepthM=1.2')
    expect(url).toContain('nfkMmPerM=200')
    expect(url).not.toContain('soilType=')
  })
})
