import { describe, it, expect } from 'vitest'
import { computeWaterBalanceSeries } from './waterBalanceSeries.js'
import type { DailySeries } from '../sources/openMeteo.js'

const days = (from: string, n: number): string[] => {
  const [y, m, d] = from.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const dt = new Date(y, m - 1, d + i)
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    return `${dt.getFullYear()}-${mm}-${dd}`
  })
}
const SOIL = { nfkMmPerM: 180, rootDepthM: 1.0 } // Lehm → taw 180, raw 90

describe('computeWaterBalanceSeries (zustandsloser Warm-up)', () => {
  it('nutzt historisches Kc je Tag: Juli (Kc=1.05) · 5 mm ET0 → 5.25 mm/Tag Verarmung', () => {
    const dates = days('2026-07-10', 10)
    const series: DailySeries = { dates, et0: dates.map(() => 5), precip: dates.map(() => 0) }
    const r = computeWaterBalanceSeries(series, SOIL, '2026-07-19')
    expect(r.dr).toBeCloseTo(52.5, 1) // 10 × 1.05 × 5, ks=1 (dr<raw)
    expect(r.ks).toBe(1)
    expect(r.status).toBe('warn') // 45 ≤ 52.5 < 90
    expect(r.window).toEqual({ from: '2026-07-10', to: '2026-07-19', days: 10 })
    expect(r.taw).toBe(180)
    expect(r.raw).toBe(90)
  })

  it('schneidet Tage NACH asOf (Vorhersage) ab', () => {
    const dates = days('2026-07-10', 6) // …-07-10 … -07-15
    const series: DailySeries = { dates, et0: dates.map(() => 5), precip: dates.map(() => 0) }
    const r = computeWaterBalanceSeries(series, SOIL, '2026-07-12')
    expect(r.window).toEqual({ from: '2026-07-10', to: '2026-07-12', days: 3 })
    expect(r.dr).toBe(15.8) // nur 3 Tage × 5.25 = 15.75, auf 1 Dezimale gerundet
  })

  it('Init am Fensteranfang = Feldkapazität (Dr=0); Regen früh trägt durch', () => {
    const dates = days('2026-07-10', 5)
    const series: DailySeries = { dates, et0: dates.map(() => 4), precip: [40, 0, 0, 0, 0] }
    const r = computeWaterBalanceSeries(series, SOIL, '2026-07-14')
    // Tag0: dr0=0 + 1.05·4 − 40 → clamp 0 (Überlauf=Perkolation); danach 4×(1.05·4)=16.8
    expect(r.dr).toBeCloseTo(16.8, 1)
    expect(r.status).toBe('good')
  })

  it('wirft, wenn keine Tagesdaten ≤ asOf vorliegen', () => {
    const dates = days('2026-07-10', 3)
    const series: DailySeries = { dates, et0: dates.map(() => 5), precip: dates.map(() => 0) }
    expect(() => computeWaterBalanceSeries(series, SOIL, '2026-07-01')).toThrow()
  })
})
