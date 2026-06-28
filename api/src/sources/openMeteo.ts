// Open-Meteo BFF-Quelle (server-seitig). Holt die TÄGLICHEN Reihen (ET0 FAO-56 +
// Niederschlag) über das `past_days`-Fenster + Vorhersage, für den Wasserbilanz-Warm-up.
// Läuft im Backend (kein Browser/CORS); nutzt das globale `fetch` (Node ≥18).

import { createTtlCache } from './cache.js'

const BASE = 'https://api.open-meteo.com/v1/forecast'
const PAST_DAYS = 60
const FORECAST_DAYS = 7
// Open-Meteo aktualisiert die Tageswerte nur einige Male pro Tag → 30-min-TTL ist großzügig
// und entlastet die freie (nicht-kommerzielle) API; Schlüssel auf ~1 km gerundet (regional ohnehin).
const DAILY_TTL_MS = 30 * 60_000

export interface OpenMeteoDailyRaw {
  daily: {
    time: string[]
    et0_fao_evapotranspiration: (number | null)[]
    precipitation_sum: (number | null)[]
  }
}

/** Ausgerichtete Tagesreihen für den Wasserbilanz-Warm-up. */
export interface DailySeries {
  /** 'YYYY-MM-DD' je Tag (aufsteigend, wie von Open-Meteo geliefert). */
  dates: string[]
  /** Tages-ET0 (FAO-56) in mm; null → NaN (Bucket behandelt NaN als 0). */
  et0: number[]
  /** Tages-Niederschlagssumme in mm; null → 0. */
  precip: number[]
}

/** Reine Umformung der Open-Meteo-Antwort in ausgerichtete Tagesreihen. */
export function shapeDaily(raw: OpenMeteoDailyRaw): DailySeries {
  const d = raw.daily
  return {
    dates: [...d.time],
    et0: d.et0_fao_evapotranspiration.map((v) => (v == null ? NaN : v)),
    precip: d.precipitation_sum.map((v) => (v == null ? 0 : v)),
  }
}

/** Baut die Open-Meteo-URL (reine Funktion, separat testbar). */
export function buildOpenMeteoUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    timezone: 'Europe/Berlin',
    daily: 'et0_fao_evapotranspiration,precipitation_sum',
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
  })
  return `${BASE}?${params.toString()}`
}

/** Holt die täglichen Reihen für einen Standort und formt sie um. */
export async function fetchOpenMeteoDaily(lat: number, lon: number, signal?: AbortSignal): Promise<DailySeries> {
  const res = await fetch(buildOpenMeteoUrl(lat, lon), { signal })
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`)
  const raw = (await res.json()) as OpenMeteoDailyRaw
  return shapeDaily(raw)
}

const dailyCache = createTtlCache<DailySeries>({ ttlMs: DAILY_TTL_MS })
const cacheKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`

/**
 * Gecachter Tagesreihen-Abruf: TTL je ~1-km-Zelle + Bündelung gleichzeitiger identischer
 * Anfragen (z. B. Whole-Farm: viele Schläge derselben Zelle teilen einen Abruf). Kein Signal —
 * der geteilte Abruf darf nicht von einer einzelnen Anfrage abgebrochen werden.
 */
export function fetchOpenMeteoDailyCached(lat: number, lon: number): Promise<DailySeries> {
  return dailyCache.get(cacheKey(lat, lon), () => fetchOpenMeteoDaily(lat, lon))
}
