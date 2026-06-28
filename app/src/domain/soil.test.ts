import { describe, it, expect } from 'vitest'
import { nfkForSoilType, taw, DEFAULT_SOIL, DEFAULT_ROOT_DEPTH_M, SOIL_TYPES } from './soil'

describe('soil', () => {
  it('liefert nFK je Bodenart (mm/m), Lehm ~180', () => {
    expect(nfkForSoilType('lehm')).toBe(180)
    expect(nfkForSoilType('sand')).toBeLessThan(nfkForSoilType('lehm'))
    expect(nfkForSoilType('lehmiger sand')).toBeGreaterThan(nfkForSoilType('sand'))
  })
  it('TAW = nFK[mm/m] · Zr[m] in mm', () => {
    expect(taw(180, 1.0)).toBe(180)
    expect(taw(180, 1.2)).toBeCloseTo(216, 5)
  })
  it('Defaults: Lehm, 1.0 m; alle Bodenarten haben nFK', () => {
    expect(DEFAULT_SOIL).toBe('lehm')
    expect(DEFAULT_ROOT_DEPTH_M).toBe(1.0)
    for (const t of SOIL_TYPES) expect(nfkForSoilType(t)).toBeGreaterThan(0)
  })
})
