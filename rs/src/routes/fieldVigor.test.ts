import { describe, it, expect } from 'vitest'
import { buildApp } from '../app.js'
import type { IntervalStat, StatsRequestOpts } from '../cdse/statistical.js'

const GEOM = {
  type: 'Polygon',
  coordinates: [[[11.776, 48.4255], [11.7784, 48.4255], [11.7784, 48.4271], [11.776, 48.4271], [11.776, 48.4255]]],
}
const iv = (from: string, outputs: IntervalStat['outputs']): IntervalStat => ({ from, to: from, outputs })
const out = (mean: number | null, valid: number) => ({ mean, stDev: 0.05, sampleCount: valid + 10, noDataCount: 10 })

const S10 = [iv('2025-06-20', { ndvi: out(0.6, 320), savi: out(0.55, 320) })]
const S20 = [
  iv('2025-05-15', { ndre: out(0.5, 80), cire: out(2.0, 80), ndmi: out(0.3, 80) }),
  iv('2025-06-20', { ndre: out(0.3, 78), cire: out(1.2, 78), ndmi: out(0.2, 78) }),
]

const stubDeps = () => ({
  getToken: async () => 'tok',
  fetchStats: async (opts: StatsRequestOpts) => (opts.resolution === 20 ? S20 : S10),
})

describe('POST /api/field-vigor', () => {
  it('liefert das Vigor-Ergebnis (Status, NDRE, Provenienz, Fenster)', async () => {
    const app = buildApp({ deps: stubDeps() })
    const res = await app.inject({ method: 'POST', url: '/api/field-vigor', payload: { geometry: GEOM, areaHa: 2 } })
    expect(res.statusCode).toBe(200)
    const b = res.json()
    expect(b.apiVersion).toBe(1)
    expect(b.card).toBe('feld-check')
    expect(b.primary).toBe('ndre')
    expect(b.indices.ndre.latest).toBe(0.3)
    expect(b.indices.ndvi.latest).toBe(0.6)
    expect(b.provenance.source).toMatch(/Copernicus|Sentinel/)
    expect(b.window.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Array.isArray(b.caveats)).toBe(true)
    await app.close()
  })

  it('400 ohne gültige Geometrie', async () => {
    const app = buildApp({ deps: stubDeps() })
    const res = await app.inject({ method: 'POST', url: '/api/field-vigor', payload: { areaHa: 2 } })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('502 wenn CDSE scheitert', async () => {
    const app = buildApp({
      deps: {
        getToken: async () => 'tok',
        fetchStats: async () => {
          throw new Error('CDSE statistics: HTTP 503')
        },
      },
    })
    const res = await app.inject({ method: 'POST', url: '/api/field-vigor', payload: { geometry: GEOM } })
    expect(res.statusCode).toBe(502)
    await app.close()
  })

  it('426 bei inkompatibler Client-Version', async () => {
    const app = buildApp({ deps: stubDeps() })
    const res = await app.inject({
      method: 'POST',
      url: '/api/field-vigor',
      headers: { 'x-client-api': '2' },
      payload: { geometry: GEOM },
    })
    expect(res.statusCode).toBe(426)
    await app.close()
  })
})
