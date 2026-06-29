import { describe, it, expect } from 'vitest'
import { assembleVigor } from './vigor.js'
import type { IntervalStat } from '../cdse/statistical.js'

const iv = (from: string, outputs: IntervalStat['outputs']): IntervalStat => ({ from, to: from, outputs })
// valid pixels = sampleCount − noDataCount
const out = (mean: number | null, valid: number) => ({ mean, stDev: 0.05, sampleCount: valid + 10, noDataCount: 10 })

describe('assembleVigor', () => {
  it('NDRE-Verfall → Status warn, Trend fallend, negative Anomalie, Konfidenz ok', () => {
    const s20 = [
      iv('2025-05-05', { ndre: out(0.5, 80), cire: out(2.0, 80), ndmi: out(0.3, 80) }),
      iv('2025-05-15', { ndre: out(0.48, 82), cire: out(1.9, 82), ndmi: out(0.3, 82) }),
      iv('2025-06-01', { ndre: out(0.45, 79), cire: out(1.8, 79), ndmi: out(0.28, 79) }),
      iv('2025-06-20', { ndre: out(0.3, 78), cire: out(1.2, 78), ndmi: out(0.2, 78) }),
    ]
    const s10 = [
      iv('2025-05-05', { ndvi: out(0.6, 320), savi: out(0.55, 320) }),
      iv('2025-06-20', { ndvi: out(0.55, 318), savi: out(0.5, 318) }),
    ]
    const v = assembleVigor(s10, s20, { areaHa: 2 })
    expect(v.primary).toBe('ndre')
    expect(v.indices.ndre.latest).toBe(0.3)
    expect(v.indices.ndre.trend).toBe('fallend')
    expect(v.indices.ndre.anomaly).toBeLessThan(-1)
    expect(v.indices.ndre.confidence.usable).toBe(true)
    expect(v.indices.ndre.confidence.tier).toBe('ok')
    expect(v.indices.ndvi.latest).toBe(0.55)
    expect(v.status).toBe('warn')
    expect(v.status).not.toBe('alert') // Satellit triggert nie roten Alarm
    expect(v.caveats.length).toBeGreaterThanOrEqual(3)
  })

  it('alles bewölkt (NDRE null) → Status info, NDRE nicht nutzbar', () => {
    const cloud = [iv('2025-05-05', { ndre: { mean: null, stDev: null, sampleCount: 0, noDataCount: 0 } })]
    const v = assembleVigor([], cloud, { areaHa: 2 })
    expect(v.indices.ndre.confidence.usable).toBe(false)
    expect(v.status).toBe('info')
  })

  it('stabil-hohes NDRE → Status good', () => {
    const s20 = [
      iv('a', { ndre: out(0.5, 80) }),
      iv('b', { ndre: out(0.51, 80) }),
      iv('c', { ndre: out(0.52, 80) }),
    ]
    expect(assembleVigor([], s20, { areaHa: 2 }).status).toBe('good')
  })
})
