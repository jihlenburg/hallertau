import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchFieldVigor, CLIENT_API_VERSION } from './fieldVigor'

const GEOM = { type: 'Polygon', coordinates: [[[11.776, 48.4255], [11.7784, 48.4255], [11.7784, 48.4271], [11.776, 48.4271], [11.776, 48.4255]]] }
const okBody = {
  apiVersion: 1,
  card: 'feld-check',
  status: 'warn',
  primary: 'ndre',
  asOf: '2025-08-07T00:00:00Z',
  window: { from: '2025-05-01', to: '2025-08-31' },
  indices: { ndre: { index: 'ndre', latest: 0.194, trend: 'fallend', anomaly: -1.18, confidence: { validPixels: 81, tier: 'ok', usable: true, label: 'regionales Screening (Feldmittel)', note: '…' } } },
  caveats: ['…'],
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchFieldVigor', () => {
  it('ok: parst die Antwort, POSTet Geometrie + X-Client-API', async () => {
    const f = vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) => new Response(JSON.stringify(okBody), { status: 200 }))
    vi.stubGlobal('fetch', f)
    const r = await fetchFieldVigor(GEOM, { areaHa: 3.2 })
    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') expect(r.data.indices.ndre.latest).toBe(0.194)
    const [url, init] = f.mock.calls[0]
    expect(String(url)).toContain('/api/field-vigor')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['X-Client-API']).toBe(String(CLIENT_API_VERSION))
    expect(String(init?.body)).toContain('Polygon')
    expect(String(init?.body)).toContain('areaHa')
  })
  it('426 → incompatible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 426 })))
    expect((await fetchFieldVigor(GEOM, {})).kind).toBe('incompatible')
  })
  it('HTTP-Fehler → error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 502 })))
    expect((await fetchFieldVigor(GEOM, {})).kind).toBe('error')
  })
  it('Netzwerkfehler → error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net') }))
    const r = await fetchFieldVigor(GEOM, {})
    expect(r.kind).toBe('error')
  })
})
