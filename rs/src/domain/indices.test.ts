import { describe, it, expect } from 'vitest'
import { EVALSCRIPT_10, EVALSCRIPT_20, INDEX_RES } from './indices.js'

describe('Evalscripts', () => {
  it('10-m-Script: NDVI + SAVI, SCL-Maske, 10-m-Bänder', () => {
    for (const tok of ['ndvi', 'savi', 'dataMask', 'SCL', 'B04', 'B08', 'VERSION=3']) {
      expect(EVALSCRIPT_10).toContain(tok)
    }
  })
  it('20-m-Script: NDRE + CIre + NDMI, Red-Edge/SWIR-Bänder', () => {
    for (const tok of ['ndre', 'cire', 'ndmi', 'dataMask', 'SCL', 'B05', 'B11']) {
      expect(EVALSCRIPT_20).toContain(tok)
    }
  })
  it('INDEX_RES bildet Index → native Auflösung ab', () => {
    expect(INDEX_RES.ndvi).toBe(10)
    expect(INDEX_RES.savi).toBe(10)
    expect(INDEX_RES.ndre).toBe(20)
    expect(INDEX_RES.cire).toBe(20)
    expect(INDEX_RES.ndmi).toBe(20)
  })
})
