import { describe, it, expect } from 'vitest'
import { assessConfidence } from './confidence.js'

describe('assessConfidence', () => {
  it('zu wenige Pixel (<9) → nicht nutzbar, Tier none', () => {
    const c = assessConfidence(5, { res: 10, areaHa: 2 })
    expect(c.usable).toBe(false)
    expect(c.tier).toBe('none')
  })
  it('9..29 → niedrig + nutzbar', () => {
    const c = assessConfidence(20, { res: 10, areaHa: 2 })
    expect(c.tier).toBe('niedrig')
    expect(c.usable).toBe(true)
    expect(c.note).toMatch(/20/)
  })
  it('>=30 → ok', () => {
    expect(assessConfidence(120, { res: 10, areaHa: 3 }).tier).toBe('ok')
  })
  it('20-m-Index auf <1 ha → unterdrückt (nicht belastbar)', () => {
    const c = assessConfidence(40, { res: 20, areaHa: 0.5 })
    expect(c.usable).toBe(false)
    expect(c.note).toMatch(/< ?1 ?ha|Red-Edge|SWIR/i)
  })
  it('20-m-Index auf ausreichend großem Schlag → ok', () => {
    expect(assessConfidence(60, { res: 20, areaHa: 3 }).usable).toBe(true)
  })
  it('Label nennt NIE „teilflächengenau" (Satellit = Screening)', () => {
    for (const px of [5, 20, 200]) {
      expect(assessConfidence(px, { res: 20, areaHa: 3 }).label).not.toMatch(/teilflächengenau/i)
      expect(assessConfidence(px, { res: 20, areaHa: 3 }).label).toMatch(/Screening/i)
    }
  })
})
