import { describe, it, expect } from 'vitest'
import { soilBalanceLabel, soilWaterViz, roadmapStrip, countHints } from './cards'

describe('soilBalanceLabel — FAO-56 Wurzelraum-Bilanz (echte Empfehlung)', () => {
  it('good/warn: qualitative Überschrift', () => {
    expect(soilBalanceLabel('good', 0)).toMatch(/grün|versorgt|ausgeglichen/i)
    expect(soilBalanceLabel('warn', 0)).toMatch(/trocknet/i)
  })
  it('alert mit Empfehlung: nennt die mm-Gabe (jetzt eine echte Dosis)', () => {
    expect(soilBalanceLabel('alert', 24)).toMatch(/24\s*mm/i)
    expect(soilBalanceLabel('alert', 24)).toMatch(/bewässern/i)
  })
  it('alert ohne Empfehlung: Trockenstress-Hinweis', () => {
    expect(soilBalanceLabel('alert', 0)).toMatch(/Trockenstress/i)
  })
})

describe('soilWaterViz', () => {
  it('zeigt Dr, TAW, RAW als Zahlen und füllt anteilig (Dr/TAW)', () => {
    const html = soilWaterViz({ dr: 90, raw: 90, taw: 180, ks: 1, days: 61 })
    expect(html).toMatch(/90/) // Dr/RAW
    expect(html).toMatch(/180/) // TAW
    expect(html).toMatch(/width:\s*50%/) // 90/180
  })
  it('weist aktiven Wasserstress aus, wenn Ks < 1', () => {
    expect(soilWaterViz({ dr: 130, raw: 90, taw: 180, ks: 0.56, days: 61 })).toMatch(/0\.56|Ks/i)
  })
})

describe('roadmapStrip', () => {
  it('nennt alle drei künftigen Quellen', () => {
    const html = roadmapStrip()
    expect(html).toMatch(/Peronospora|Krankheitsdruck/i)
    expect(html).toMatch(/Sentinel|Feld-Check/i)
    expect(html).toMatch(/Wachstum|Phänologie/i)
  })
})

describe('countHints', () => {
  it('zählt warn und alert, ignoriert good/info/loading', () => {
    expect(countHints(['good', 'good', 'good'])).toBe(0)
    expect(countHints(['warn', 'good', 'alert'])).toBe(2)
    expect(countHints(['info', 'good'])).toBe(0)
  })
})
