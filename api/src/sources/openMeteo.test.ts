import { describe, it, expect } from 'vitest'
import { shapeDaily, buildOpenMeteoUrl, type OpenMeteoDailyRaw } from './openMeteo.js'

const RAW: OpenMeteoDailyRaw = {
  daily: {
    time: ['2026-06-25', '2026-06-26', '2026-06-27'],
    et0_fao_evapotranspiration: [4.1, 5.0, null],
    precipitation_sum: [0, null, 12.3],
  },
}

describe('shapeDaily', () => {
  it('richtet die Tagesreihen zu gleich langen Arrays aus, Reihenfolge bleibt', () => {
    const s = shapeDaily(RAW)
    expect(s.dates).toEqual(['2026-06-25', '2026-06-26', '2026-06-27'])
    expect(s.et0.length).toBe(3)
    expect(s.precip.length).toBe(3)
    expect(s.et0[0]).toBeCloseTo(4.1, 5)
    expect(s.precip[2]).toBeCloseTo(12.3, 5)
  })
  it('null-Niederschlag → 0; null-ET0 → NaN (Bucket behandelt NaN als 0)', () => {
    const s = shapeDaily(RAW)
    expect(s.precip[1]).toBe(0)
    expect(Number.isNaN(s.et0[2])).toBe(true)
  })
})

describe('buildOpenMeteoUrl', () => {
  it('enthält ET0 + Niederschlag, past_days=60, forecast_days=7, Europe/Berlin', () => {
    const url = buildOpenMeteoUrl(48.42, 11.78)
    expect(url).toContain('latitude=48.4200')
    expect(url).toContain('longitude=11.7800')
    expect(url).toContain('et0_fao_evapotranspiration')
    expect(url).toContain('precipitation_sum')
    expect(url).toContain('past_days=60')
    expect(url).toContain('forecast_days=7')
    expect(url).toContain(encodeURIComponent('Europe/Berlin'))
  })
})
