import { describe, it, expect } from 'vitest'
import { assessWeather } from './weather'
import type { OpenMeteoData } from '../api/openMeteo'
import type { DwdAlert } from '../api/brightSky'

const NOW = new Date('2026-04-15T20:00:00') // Frühjahr: Spätfrost auf jungem Hopfentrieb plausibel

/** Minimaler OpenMeteoData-Stub; nur die von assessWeather gelesenen Felder zählen. */
function mk(
  mins: number[],
  opts: { codes?: number[]; probs?: number[]; curCode?: number; curT?: number } = {},
): OpenMeteoData {
  const time = ['2026-04-15', '2026-04-16', '2026-04-17']
  return {
    current: { temperature_2m: opts.curT ?? 10, weather_code: opts.curCode ?? 0, wind_speed_10m: 5 },
    hourly: {
      time: [], temperature_2m: [], relative_humidity_2m: [], precipitation: [],
      precipitation_probability: [], wind_speed_10m: [], wind_gusts_10m: [],
    },
    daily: {
      time,
      weather_code: opts.codes ?? [0, 0, 0],
      temperature_2m_max: [12, 12, 12],
      temperature_2m_min: mins,
      precipitation_probability_max: opts.probs ?? [0, 0, 0],
      precipitation_sum: [0, 0, 0],
      et0_fao_evapotranspiration: [3, 3, 3],
    },
  }
}

describe('assessWeather — Frost (abgeleiteter Pfad)', () => {
  it('meldet Frostgefahr bei Tiefstwert unter 0 °C', () => {
    const r = assessWeather(mk([-2, 5, 6]), [], NOW)
    expect(r.status).toBe('alert')
    expect(r.headline).toMatch(/Frost/)
    expect(r.warningSource).toBe('derived')
  })

  it('meldet Bodenfrost (warn) im Bereich 0–2 °C', () => {
    const r = assessWeather(mk([1.5, 6, 6]), [], NOW)
    expect(r.status).toBe('warn')
    expect(r.headline).toMatch(/Bodenfrost/)
  })

  it('bleibt bei milder klarer Nacht „gut“', () => {
    const r = assessWeather(mk([7, 8, 9]), null, NOW)
    expect(r.status).toBe('good')
  })

  it('lässt Frost (<=0) vor Gewitter ranggehen', () => {
    const r = assessWeather(mk([-1, 5, 6], { codes: [95, 0, 0] }), [], NOW)
    expect(r.status).toBe('alert')
    expect(r.headline).toMatch(/Frost/)
  })
})

describe('assessWeather — Quelle/Erreichbarkeit der Warnungen', () => {
  it('nutzt amtliche DWD-Warnung mit Vorrang', () => {
    const alerts: DwdAlert[] = [
      { event: 'Sturm', headline: 'Sturmwarnung', description: null, severity: 'severe' },
    ]
    const r = assessWeather(mk([7, 8, 9]), alerts, NOW)
    expect(r.status).toBe('alert')
    expect(r.warningSource).toBe('dwd')
    expect(r.alertsReachable).toBe(true)
  })

  it('markiert Warnungen als nicht abrufbar bei null (Abruf fehlgeschlagen)', () => {
    const r = assessWeather(mk([7, 8, 9]), null, NOW)
    expect(r.alertsReachable).toBe(false)
  })

  it('markiert Warnungen als abrufbar bei leerer Liste (keine aktiven Warnungen)', () => {
    const r = assessWeather(mk([7, 8, 9]), [], NOW)
    expect(r.alertsReachable).toBe(true)
  })
})
