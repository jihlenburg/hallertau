import { describe, it, expect } from 'vitest'
import { computeSoilWaterBalance } from './waterBalance.js'

const arr = (v: number, n: number) => Array.from({ length: n }, () => v)
const SOIL = { taw: 180, raw: 90 } // Lehm, Zr 1.0 m, p 0.5

describe('computeSoilWaterBalance (FAO-56 Tipping-Bucket)', () => {
  it('Carry-over: 40 mm Regen Tag 0 hält den Eimer 8 Tage danach im grünen Bereich', () => {
    const et0 = arr(4, 9),
      precip = [40, 0, 0, 0, 0, 0, 0, 0, 0],
      kc = arr(1, 9)
    const r = computeSoilWaterBalance(et0, precip, kc, SOIL, { dr0: 0 })
    expect(r.dr).toBeCloseTo(32, 0) // Tag0 Überlauf=Perkolation, danach +4/Tag
    expect(r.status).toBe('good')
  })
  it('Ks bremst die Verarmung, sobald Dr > RAW', () => {
    const r = computeSoilWaterBalance(arr(10, 2), arr(0, 2), arr(1, 2), SOIL, { dr0: 90 })
    expect(r.ks).toBeLessThan(1)
    expect(r.dr).toBeCloseTo(108.9, 0)
  })
  it('Überlauf wird zu Perkolation: Dr nie negativ', () => {
    const r = computeSoilWaterBalance([2], [50], [1], SOIL, { dr0: 10 })
    expect(r.dr).toBe(0)
  })
  it('Status-Bänder good/warn/alert + Auffüll-Empfehlung', () => {
    expect(computeSoilWaterBalance([0], [0], [0], SOIL, { dr0: 30 }).status).toBe('good')
    expect(computeSoilWaterBalance([0], [0], [0], SOIL, { dr0: 60 }).status).toBe('warn')
    const alert = computeSoilWaterBalance([0], [0], [0], SOIL, { dr0: 120 })
    expect(alert.status).toBe('alert')
    expect(alert.recommendMm).toBeCloseTo(120, 0)
  })
  it('clamp auf TAW (Eimer nicht über Welkepunkt hinaus)', () => {
    const r = computeSoilWaterBalance(arr(20, 20), arr(0, 20), arr(1, 20), SOIL, { dr0: 0 })
    expect(r.dr).toBeLessThanOrEqual(SOIL.taw)
  })
})
