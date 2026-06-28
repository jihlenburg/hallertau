import type { HourlySeries } from '../domain/sprayWindow'

const BASE = 'https://api.open-meteo.com/v1/forecast'

export interface OpenMeteoData {
  current: {
    temperature_2m: number
    weather_code: number
    wind_speed_10m: number
  }
  hourly: HourlySeries
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: number[]
    precipitation_sum: number[]
    et0_fao_evapotranspiration: number[]
  }
}

/**
 * Holt Vorhersage inkl. ET0 (FAO-56) für einen Standort.
 * Open-Meteo ist CORS-fähig — kein Backend nötig.
 * past_days=60 liefert die Historie für den Warm-up der FAO-56-Wasserbilanz.
 */
export async function fetchOpenMeteo(lat: number, lon: number, signal?: AbortSignal): Promise<OpenMeteoData> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    timezone: 'Europe/Berlin',
    current: 'temperature_2m,weather_code,wind_speed_10m',
    hourly:
      'temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,cloud_cover,et0_fao_evapotranspiration',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,et0_fao_evapotranspiration',
    past_days: '60',
    forecast_days: '7',
    wind_speed_unit: 'kmh',
  })
  const res = await fetch(`${BASE}?${params.toString()}`, { signal })
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`)
  return (await res.json()) as OpenMeteoData
}

/** Indizes der Tage, die in [von, bis) liegen (für die 7-Tage-Bilanz). */
export function lastNDaysIndices(times: string[], n: number, now: Date = new Date()): number[] {
  const out: number[] = []
  const startMs = now.getTime() - n * 86400_000
  for (let i = 0; i < times.length; i++) {
    const d = new Date(times[i] + 'T12:00')
    if (d.getTime() >= startMs && d.getTime() <= now.getTime()) out.push(i)
  }
  return out
}
