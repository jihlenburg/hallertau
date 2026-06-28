import { describe, it, expect } from 'vitest'
import { evaluateSprayWindow, type HourlySeries } from './sprayWindow'

function buildSeries(
  now: Date,
  good: (d: Date) => boolean,
  opts: { goodWind?: number; goodGust?: number; cloud?: number } = {},
): HourlySeries {
  const gw = opts.goodWind ?? 5
  const gg = opts.goodGust ?? 10
  const time: string[] = []
  const temperature_2m: number[] = []
  const relative_humidity_2m: number[] = []
  const precipitation: number[] = []
  const precipitation_probability: number[] = []
  const wind_speed_10m: number[] = []
  const wind_gusts_10m: number[] = []
  const cloud_cover: number[] = []
  for (let i = 0; i < 48; i++) {
    const d = new Date(now.getTime() + i * 3600_000)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    time.push(`${yyyy}-${mm}-${dd}T${hh}:00`)
    const g = good(d)
    temperature_2m.push(18)
    relative_humidity_2m.push(g ? 55 : 80)
    precipitation.push(0)
    precipitation_probability.push(0)
    wind_speed_10m.push(g ? gw : 30)
    wind_gusts_10m.push(g ? gg : 45)
    if (opts.cloud !== undefined) cloud_cover.push(opts.cloud)
  }
  const series: HourlySeries = { time, temperature_2m, relative_humidity_2m, precipitation, precipitation_probability, wind_speed_10m, wind_gusts_10m }
  if (opts.cloud !== undefined) series.cloud_cover = cloud_cover
  return series
}

describe('evaluateSprayWindow', () => {
  it('findet das erste günstige Morgenfenster', () => {
    const now = new Date('2026-06-28T20:00:00')
    const tomorrow = now.getDate() + 1
    const series = buildSeries(now, (d) => d.getDate() === tomorrow && d.getHours() >= 6 && d.getHours() <= 9)
    const r = evaluateSprayWindow(series, now)
    expect(r.status).toBe('good')
    expect(r.window).not.toBeNull()
    expect(r.window!.start.getHours()).toBe(6)
    expect(r.window!.end.getHours()).toBe(10)
    expect(r.headline).toMatch(/06.*10/)
  })

  it('meldet kein Fenster bei dauerhaft zu viel Wind', () => {
    const now = new Date('2026-06-28T20:00:00')
    const series = buildSeries(now, () => false)
    const r = evaluateSprayWindow(series, now)
    expect(r.status).toBe('alert')
    expect(r.window).toBeNull()
    expect(r.inversion).toBe(false)
  })

  it('warnt bei Schwachwind-Frühfenster vor möglicher Inversionslage', () => {
    const now = new Date('2026-06-28T20:00:00')
    const tomorrow = now.getDate() + 1
    // Frühfenster 6–9 Uhr bei sehr schwachem Wind (2 km/h) → klassische Strahlungsinversion.
    const series = buildSeries(
      now,
      (d) => d.getDate() === tomorrow && d.getHours() >= 6 && d.getHours() <= 9,
      { goodWind: 2, goodGust: 6 },
    )
    const r = evaluateSprayWindow(series, now)
    expect(r.window).not.toBeNull()
    expect(r.inversion).toBe(true)
    expect(r.detail).toMatch(/Inversion/)
  })

  it('bedeckter Himmel dämpft die Strahlungsinversion: Schwachwind-Frühfenster ohne Warnung', () => {
    const now = new Date('2026-06-28T20:00:00')
    const tomorrow = now.getDate() + 1
    const series = buildSeries(
      now,
      (d) => d.getDate() === tomorrow && d.getHours() >= 6 && d.getHours() <= 9,
      { goodWind: 2, goodGust: 6, cloud: 90 }, // bedeckt → kaum Ausstrahlung → keine Inversion
    )
    const r = evaluateSprayWindow(series, now)
    expect(r.window).not.toBeNull()
    expect(r.inversion).toBe(false)
    expect(r.detail).not.toMatch(/Inversion/)
  })

  it('klarer Himmel + Schwachwind im Frühfenster → Inversionswarnung', () => {
    const now = new Date('2026-06-28T20:00:00')
    const tomorrow = now.getDate() + 1
    const series = buildSeries(
      now,
      (d) => d.getDate() === tomorrow && d.getHours() >= 6 && d.getHours() <= 9,
      { goodWind: 2, goodGust: 6, cloud: 10 }, // klar → starke Ausstrahlung → Inversion
    )
    const r = evaluateSprayWindow(series, now)
    expect(r.inversion).toBe(true)
    expect(r.detail).toMatch(/Inversion/)
  })

  it('keine Inversionswarnung bei windigem Mittagsfenster', () => {
    const now = new Date('2026-06-28T20:00:00')
    const tomorrow = now.getDate() + 1
    // Mittagsfenster 12–15 Uhr, mäßiger Wind (8 km/h) → keine Inversionsneigung.
    const series = buildSeries(
      now,
      (d) => d.getDate() === tomorrow && d.getHours() >= 12 && d.getHours() <= 15,
      { goodWind: 8, goodGust: 14 },
    )
    const r = evaluateSprayWindow(series, now)
    expect(r.window).not.toBeNull()
    expect(r.inversion).toBe(false)
    expect(r.detail).not.toMatch(/Inversion/)
  })
})
