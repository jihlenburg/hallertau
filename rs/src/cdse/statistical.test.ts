import { describe, it, expect, vi } from 'vitest'
import { buildStatsRequest, parseStatsResponse, fetchFieldStats } from './statistical.js'

const GEOM = {
  type: 'Polygon',
  coordinates: [[[11.776, 48.4255], [11.7784, 48.4255], [11.7784, 48.4271], [11.776, 48.4271], [11.776, 48.4255]]],
}
const OPTS = { geometry: GEOM, from: '2025-04-01', to: '2025-09-30', evalscript: '//VERSION=3\n...', resolution: 10 }

const FIXTURE = {
  status: 'OK',
  data: [
    {
      interval: { from: '2025-06-01T00:00:00Z', to: '2025-06-11T00:00:00Z' },
      outputs: {
        ndvi: { bands: { B0: { stats: { mean: 0.72, stDev: 0.08, sampleCount: 355, noDataCount: 40 } } } },
        ndre: { bands: { B0: { stats: { mean: 0.31, stDev: 0.05, sampleCount: 96, noDataCount: 10 } } } },
      },
    },
    {
      interval: { from: '2025-06-11T00:00:00Z', to: '2025-06-21T00:00:00Z' },
      outputs: {
        ndvi: { bands: { B0: { stats: { mean: 0.75, stDev: 0.07, sampleCount: 350, noDataCount: 45 } } } },
        ndre: { bands: { B0: { stats: { mean: 0.34, stDev: 0.06, sampleCount: 95, noDataCount: 11 } } } },
      },
    },
  ],
}

describe('buildStatsRequest', () => {
  it('baut die Statistical-API-Struktur (AOI, S2-L2A, Zeitraum, Intervall, Evalscript, Auflösung)', () => {
    const r = buildStatsRequest({ ...OPTS, maxCloud: 60, intervalDays: 10 }) as any
    expect(r.input.bounds.geometry).toEqual(GEOM)
    expect(r.input.bounds.properties.crs).toContain('EPSG/0/4326')
    expect(r.input.data[0].type).toBe('sentinel-2-l2a')
    expect(r.input.data[0].dataFilter.maxCloudCoverage).toBe(60)
    expect(r.aggregation.timeRange.from).toBe('2025-04-01T00:00:00Z')
    expect(r.aggregation.timeRange.to).toBe('2025-09-30T23:59:59Z')
    expect(r.aggregation.aggregationInterval.of).toBe('P10D')
    expect(r.aggregation.evalscript).toBe(OPTS.evalscript)
    // resx/resy in EPSG:4326-Graden ≈ 10 m am Schlag-Breitengrad (NICHT 10 = 10°!)
    expect(r.aggregation.resy).toBeCloseTo(10 / 111132, 6) // ~9.0e-5°
    expect(r.aggregation.resx).toBeGreaterThan(r.aggregation.resy) // Längen-Grad kürzer → mehr °/10 m
    expect(r.aggregation.resx).toBeLessThan(0.001)
  })
})

describe('parseStatsResponse', () => {
  it('flacht die Sentinel-Hub-Antwort zu einer Intervall-Reihe ab', () => {
    const series = parseStatsResponse(FIXTURE)
    expect(series).toHaveLength(2)
    expect(series[0].from).toBe('2025-06-01T00:00:00Z')
    expect(series[0].outputs.ndvi.mean).toBeCloseTo(0.72, 5)
    expect(series[0].outputs.ndvi.sampleCount).toBe(355)
    expect(series[0].outputs.ndre.mean).toBeCloseTo(0.31, 5)
    expect(series[1].outputs.ndre.sampleCount).toBe(95)
  })
  it('verträgt fehlende/leere Outputs (Wolken-Intervall)', () => {
    const s = parseStatsResponse({ data: [{ interval: { from: 'a', to: 'b' }, outputs: {} }] })
    expect(s).toHaveLength(1)
    expect(s[0].outputs).toEqual({})
  })
  it('coerced nicht-numerische mean (API liefert "NaN"-String) zu null', () => {
    const s = parseStatsResponse({
      data: [{ interval: { from: 'a', to: 'b' }, outputs: { ndvi: { bands: { B0: { stats: { mean: 'NaN', stDev: 'NaN', sampleCount: 1, noDataCount: 1 } } } } } }],
    })
    expect(s[0].outputs.ndvi.mean).toBeNull()
    expect(s[0].outputs.ndvi.stDev).toBeNull()
    expect(s[0].outputs.ndvi.sampleCount).toBe(1)
  })
})

describe('fetchFieldStats', () => {
  it('POSTet mit Bearer-Token an die Statistics-API und parst die Antwort', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 }))
    const series = await fetchFieldStats(OPTS, 'tok-123', f as unknown as typeof fetch)
    expect(series[0].outputs.ndvi.mean).toBeCloseTo(0.72, 5)
    const call = (f as unknown as { mock: { calls: [RequestInfo | URL, RequestInit?][] } }).mock.calls[0]
    expect(String(call[0])).toContain('/api/v1/statistics')
    expect(call[1]?.method).toBe('POST')
    expect((call[1]?.headers as Record<string, string>).authorization).toBe('Bearer tok-123')
  })
  it('wirft bei non-200', async () => {
    const f = vi.fn(async () => new Response('{"error":"x"}', { status: 400 }))
    await expect(fetchFieldStats(OPTS, 'tok', f as unknown as typeof fetch)).rejects.toThrow(/400/)
  })
})
