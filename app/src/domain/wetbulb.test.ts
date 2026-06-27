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

// Mehr als ein einzelner Stützpunkt: eine kleine Referenztabelle über den
// spritzrelevanten Bereich, damit eine Regression in der Formel auffällt — nicht
// nur am bisherigen 20 °C/50 %-Anker. Werte unabhängig aus der Stull-Formel
// berechnet; Toleranz 0,1 °C (Stull-RMSE ~0,3 °C, Maximalfehler ~1 °C).
describe('stullWetBulb — Referenztabelle (Tw, ΔT)', () => {
  const cases: Array<[number, number, number, number]> = [
    // T,  RH,   Tw,    ΔT
    [20, 50, 13.7, 6.3],
    [18, 55, 12.6, 5.4],
    [15, 70, 11.62, 3.38],
    [22, 45, 14.7, 7.3],
    [25, 40, 16.38, 8.62],
    [30, 30, 18.37, 11.63],
    [28, 35, 17.87, 10.13],
    [12, 85, 10.37, 1.63],
  ]
  for (const [t, rh, tw, dt] of cases) {
    it(`T=${t} °C, RH=${rh} % → Tw≈${tw}, ΔT≈${dt}`, () => {
      expect(stullWetBulb(t, rh)).toBeCloseTo(tw, 1)
      expect(deltaT(t, rh)).toBeCloseTo(dt, 1)
    })
  }

  it('hält die Spritzfenster-Grenze ΔT 2–8 °C an den Rändern ein', () => {
    expect(deltaT(22, 45)).toBeLessThanOrEqual(8) // 7.30 → innerhalb
    expect(deltaT(25, 40)).toBeGreaterThan(8) // 8.62 → außerhalb
    expect(deltaT(15, 70)).toBeGreaterThan(2) // 3.38 → innerhalb
    expect(deltaT(12, 85)).toBeLessThan(2) // 1.63 → außerhalb
  })
})
