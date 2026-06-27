import { describe, it, expect } from 'vitest'
import { stullWetBulb, deltaT } from './wetbulb'

describe('stullWetBulb', () => {
  it('trifft den Referenzwert T=20°C, RH=50% (~13,7°C)', () => {
    expect(stullWetBulb(20, 50)).toBeCloseTo(13.7, 1)
  })
  it('liefert bei 100% Feuchte ungefähr die Lufttemperatur', () => {
    expect(stullWetBulb(20, 100)).toBeGreaterThan(19)
    expect(stullWetBulb(20, 100)).toBeLessThanOrEqual(20.5)
  })
})

describe('deltaT', () => {
  it('ist positiv bei trockener Luft', () => {
    expect(deltaT(25, 40)).toBeGreaterThan(8)
  })
  it('liegt im günstigen Bereich bei mäßiger Feuchte', () => {
    const dt = deltaT(18, 55)
    expect(dt).toBeGreaterThan(2)
    expect(dt).toBeLessThan(8)
  })
})
