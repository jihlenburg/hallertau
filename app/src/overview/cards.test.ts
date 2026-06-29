import { describe, it, expect } from 'vitest'
import { soilBalanceLabel, soilWaterViz, roadmapStrip, countHints, forecastStrip, sprayHourDetail, sprayStrip } from './cards'
import type { SprayHour, SprayAssessment } from '../domain/sprayWindow'

describe('sprayHourDetail', () => {
  it('enthält Uhrzeit, ΔT, Wind, Böen und den Grund', () => {
    const h: SprayHour = { date: new Date(2026, 5, 28, 14, 0), ok: false, wind: 16, gust: 22, precip: 0, prob: 3, dt: 13, cloud: 18 }
    const html = sprayHourDetail(h)
    expect(html).toContain('14:00')
    expect(html).toMatch(/ΔT\s*13/)
    expect(html).toMatch(/Wind\s*16/)
    expect(html).toMatch(/Böen\s*22/)
    expect(html).toMatch(/zu stark/) // bindender Grund: Wind 16 > 15 schlägt vor ΔT zu (Priorität)
  })
})

describe('sprayStrip', () => {
  const base = new Date(2026, 5, 28, 9, 0)
  const mk = (i: number, ok: boolean): SprayHour => ({
    date: new Date(base.getTime() + i * 3600_000), ok, wind: 3, gust: 8, precip: 0, prob: 0, dt: ok ? 4 : 12, cloud: 80,
  })
  const hours = Array.from({ length: 30 }, (_, i) => mk(i, i >= 2 && i <= 4))
  const a: SprayAssessment = {
    status: 'good', headline: 'x', detail: 'y', inversion: false,
    window: { start: hours[2].date, end: new Date(hours[4].date.getTime() + 3600_000) }, hours,
  }
  it('zeigt mind. 24 Balken, markiert das Fenster und hat eine Detailzeile', () => {
    const html = sprayStrip(a, base)
    expect((html.match(/data-idx=/g) || []).length).toBe(24)
    expect(html).toMatch(/Fenster\s*11.?14/) // 11–14 Uhr
    expect(html).toContain('spray-detail')
    expect(html).toMatch(/geeignet/) // Legende
  })
})

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
  it('nennt die künftigen Quellen (Feld-Check ist jetzt live → nicht mehr im Streifen)', () => {
    const html = roadmapStrip()
    expect(html).toMatch(/Peronospora|Krankheitsdruck/i)
    expect(html).toMatch(/Wachstum|Phänologie/i)
    expect(html).not.toMatch(/Feld-Check/i)
  })
})

describe('countHints', () => {
  it('zählt warn und alert, ignoriert good/info/loading', () => {
    expect(countHints(['good', 'good', 'good'])).toBe(0)
    expect(countHints(['warn', 'good', 'alert'])).toBe(2)
    expect(countHints(['info', 'good'])).toBe(0)
  })
})
