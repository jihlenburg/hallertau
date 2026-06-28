import { describe, it, expect } from 'vitest'
import { soilBalanceLabel, soilWaterViz, roadmapStrip, countHints, forecastStrip } from './cards'

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

describe('forecastStrip', () => {
  const daily = {
    time: ['2026-06-27', '2026-06-28', '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'],
    weather_code: [0, 2, 61, 3, 95, 0, 1, 2],
    temperature_2m_max: [28, 30, 24, 26, 22, 29, 31, 30],
    temperature_2m_min: [14, 15, 13, 12, 11, 14, 16, 15],
    precipitation_probability_max: [0, 10, 80, 40, 60, 0, 5, 10],
  }
  it('zeigt 7 Tage ab heute, erste Zelle „Heute", mit Max-Temperatur', () => {
    const html = forecastStrip(daily, new Date(2026, 5, 28, 18, 0))
    expect((html.match(/class="fc"/g) || []).length).toBe(7)
    expect(html).toContain('Heute')
    expect(html).toContain('30°') // Max heute (28.6.)
    expect(html).toContain('80 %') // Regenwahrscheinlichkeit 29.6.
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
