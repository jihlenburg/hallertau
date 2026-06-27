import { describe, it, expect } from 'vitest'
import { evaluateSprayWindow, type HourlySeries } from './sprayWindow'

function buildSeries(now: Date, good: (d: Date) => boolean): HourlySeries {
  const time: string[] = []
  const temperature_2m: number[] = []
  const relative_humidity_2m: number[] = []
  const precipitation: number[] = []
  const precipitation_probability: number[] = []
  const wind_speed_10m: number[] = []
  const wind_gusts_10m: number[] = []
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
    wind_speed_10m.push(g ? 5 : 30)
    wind_gusts_10m.push(g ? 10 : 45)
  }
  return { time, temperature_2m, relative_humidity_2m, precipitation, precipitation_probability, wind_speed_10m, wind_gusts_10m }
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
  })
})
