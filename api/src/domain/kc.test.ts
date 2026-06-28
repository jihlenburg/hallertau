import { describe, it, expect } from 'vitest'
import { kcForDate, KC } from './kc.js'

const d = (m: number, day: number) => new Date(2026, m - 1, day)

describe('kcForDate (Hallertau-Kalenderphänologie)', () => {
  it('Anker: Initial 0.30, Hochsommer 1.05, Spät 0.85', () => {
    expect(kcForDate(d(4, 15))).toBeCloseTo(KC.INI, 2) // Initialphase
    expect(kcForDate(d(7, 20))).toBeCloseTo(KC.MID, 2) // Hauptwachstum
    expect(kcForDate(d(9, 20))).toBeCloseTo(KC.END, 2) // Erntetermin = Spätphasen-Endwert
  })
  it('nach der Ernte (Ende Sep) kein Vollbedarf mehr (~Initialwert)', () => {
    expect(kcForDate(d(9, 25))).toBeLessThanOrEqual(KC.INI + 0.001)
  })
  it('interpoliert in der Entwicklungsphase zwischen INI und MID', () => {
    const k = kcForDate(d(6, 7)) // Mitte Entwicklung
    expect(k).toBeGreaterThan(KC.INI)
    expect(k).toBeLessThan(KC.MID)
  })
  it('Winter/vegetationslos ~ Initialwert (kein Vollbedarf)', () => {
    expect(kcForDate(d(1, 15))).toBeLessThanOrEqual(KC.INI + 0.001)
  })
})
