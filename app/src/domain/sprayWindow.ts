import { deltaT } from './wetbulb'
import type { Status } from '../types'

/** Stündliche Eingangsdaten (Open-Meteo, Zeitzone Europe/Berlin). */
export interface HourlySeries {
  time: string[]
  temperature_2m: number[]
  relative_humidity_2m: number[]
  precipitation: number[]
  precipitation_probability: number[]
  wind_speed_10m: number[]
  wind_gusts_10m: number[]
  /** Bewölkungsgrad (%); optional — schärft die Inversionsabschätzung. */
  cloud_cover?: number[]
}

/** Schwellen als dokumentierte Konstanten — bewusst konservativ. */
export const SPRAY = {
  WIND_MAX: 15, // km/h mittlerer Wind
  GUST_MAX: 25, // km/h Böen
  PRECIP_PROB_MAX: 30, // %
  DT_MIN: 2, // °C
  DT_MAX: 8, // °C
  HOUR_START: 5, // frühestens
  HOUR_END: 21, // spätestens
  MIN_HOURS: 2, // Mindestlänge eines Fensters
  HORIZON_H: 48, // Vorausschau
  INVERSION_WIND_MAX: 4, // km/h — darunter in Dämmerungsstunden Inversionsneigung
  INVERSION_CLOUD_MAX: 50, // % — nur bei klarem/teils klarem Himmel (starke Ausstrahlung)
}

/** Dämmerungs-/Nachtstunden mit erhöhter Strahlungsinversions-Neigung. */
const isInversionHour = (hour: number) => hour <= 8 || hour >= 19

export interface SprayHour {
  date: Date
  ok: boolean
  wind: number
  /** Böen (km/h). */
  gust: number
  precip: number
  /** Niederschlagswahrscheinlichkeit (%). */
  prob: number
  dt: number
  /** Bewölkung (%) sofern verfügbar. */
  cloud?: number
}

export interface SprayAssessment {
  status: Status
  headline: string
  detail: string
  window: { start: Date; end: Date } | null
  hours: SprayHour[]
  /**
   * Liegt das gewählte Fenster ganz oder teilweise in Schwachwind-Dämmerungsstunden
   * BEI KLAREM HIMMEL? Dann besteht Strahlungsinversions-Neigung (Abdrift) — als Vorsicht
   * ausgewiesen, NICHT als harte Sperre. Bewölkung (sofern vorhanden) dämpft die Ausstrahlung
   * und entschärft die Inversion; fehlt der Bewölkungswert, greift der reine Schwachwind-Proxy.
   */
  inversion: boolean
}

/**
 * Leitet aus den Stundenwerten das nächste geeignete Spritzfenster ab.
 * `now` ist injizierbar (Tests); im Browser i. d. R. neue Date().
 */
export function evaluateSprayWindow(h: HourlySeries, now: Date = new Date()): SprayAssessment {
  const hours: SprayHour[] = []
  for (let i = 0; i < h.time.length; i++) {
    const date = new Date(h.time[i])
    if (date.getTime() < now.getTime()) continue
    if (date.getTime() > now.getTime() + SPRAY.HORIZON_H * 3600_000) break
    const wind = h.wind_speed_10m[i]
    const gust = h.wind_gusts_10m[i]
    const precip = h.precipitation[i]
    const prob = h.precipitation_probability[i] ?? 0
    const dt = deltaT(h.temperature_2m[i], h.relative_humidity_2m[i])
    const cloud = h.cloud_cover?.[i]
    const hour = date.getHours()
    const ok =
      hour >= SPRAY.HOUR_START &&
      hour <= SPRAY.HOUR_END &&
      wind <= SPRAY.WIND_MAX &&
      gust <= SPRAY.GUST_MAX &&
      precip <= 0.1 &&
      prob <= SPRAY.PRECIP_PROB_MAX &&
      dt >= SPRAY.DT_MIN &&
      dt <= SPRAY.DT_MAX
    hours.push({ date, ok, wind, gust, precip, prob, dt, cloud })
  }

  const window = firstWindow(hours)

  if (!window) {
    return {
      status: 'alert',
      headline: 'Kein gutes Fenster',
      detail: `In den nächsten ${SPRAY.HORIZON_H} h kein durchgehend günstiger Zeitraum (Wind, Niederschlag oder ΔT ungünstig).`,
      window: null,
      hours,
      inversion: false,
    }
  }

  const within24 = window.start.getTime() <= now.getTime() + 24 * 3600_000
  const start = window.start
  const end = window.end
  const sameDay = isSameDay(start, now) ? 'heute' : isSameDay(start, addDays(now, 1)) ? 'morgen' : weekday(start)
  const headline = `${cap(sameDay)} ${fmtH(start)}–${fmtH(end)} Uhr`
  const windowHours = hours.filter((x) => inRange(x.date, start, end))
  const avgWind = avg(windowHours.map((x) => x.wind))
  const avgDt = avg(windowHours.map((x) => x.dt))
  // Schwachwind in Dämmerungsstunden bei klarem Himmel → mögliche Strahlungsinversion (Abdrift).
  // Bewölkung (sofern vorhanden) dämpft die Ausstrahlung; fehlt sie, greift der Schwachwind-Proxy.
  const inversion = windowHours.some(
    (x) =>
      x.wind < SPRAY.INVERSION_WIND_MAX &&
      isInversionHour(x.date.getHours()) &&
      (x.cloud == null || x.cloud <= SPRAY.INVERSION_CLOUD_MAX),
  )
  const tail = within24
    ? ' — Wetter geeignet; Etikett & Auflagen beachten.'
    : ' — geeignetes Wetter erst später im Vorhersagezeitraum.'
  const invNote = inversion
    ? ' Frühfenster bei Schwachwind — mögliche Inversionslage, Abdrift beachten.'
    : ''
  return {
    status: within24 ? 'good' : 'warn',
    headline,
    detail: `Wind ø ${Math.round(avgWind)} km/h · trocken · ΔT ${avgDt.toFixed(1)} °C${tail}${invNote}`,
    window,
    hours,
    inversion,
  }
}

/**
 * Bindender Grund je Stunde (für die Detailzeile). Prüfreihenfolge spiegelt die `ok`-Bedingung:
 * nass → Nacht → Wind/Böen → ΔT zu hoch → ΔT zu niedrig → geeignet (+ Inversionsvorsicht).
 * „✓ geeignet" genau dann, wenn die Stunde auch `ok` ist.
 */
export function sprayReason(h: SprayHour): string {
  const hour = h.date.getHours()
  if (h.precip > 0.1 || h.prob > SPRAY.PRECIP_PROB_MAX) return '✗ zu nass (Niederschlag)'
  if (hour < SPRAY.HOUR_START || hour > SPRAY.HOUR_END) return '✗ außerhalb 5–21 Uhr (Nacht)'
  if (h.wind > SPRAY.WIND_MAX || h.gust > SPRAY.GUST_MAX) return '✗ Wind/Böen zu stark'
  if (h.dt > SPRAY.DT_MAX) return '✗ ΔT zu hoch (> 8) — zu trocken'
  if (h.dt < SPRAY.DT_MIN) return '✗ ΔT zu niedrig (< 2) — Abdrift'
  const inversion =
    h.wind < SPRAY.INVERSION_WIND_MAX &&
    isInversionHour(hour) &&
    (h.cloud == null || h.cloud <= SPRAY.INVERSION_CLOUD_MAX)
  return inversion ? '✓ geeignet · Inversionsvorsicht' : '✓ geeignet'
}

function firstWindow(hours: SprayHour[]): { start: Date; end: Date } | null {
  let runStart = -1
  for (let i = 0; i < hours.length; i++) {
    if (hours[i].ok) {
      if (runStart < 0) runStart = i
      const len = i - runStart + 1
      if (len >= SPRAY.MIN_HOURS) {
        // bis zum Ende des zusammenhängenden Laufs ausdehnen
        let j = i
        while (j + 1 < hours.length && hours[j + 1].ok) j++
        return { start: hours[runStart].date, end: addHours(hours[j].date, 1) }
      }
    } else {
      runStart = -1
    }
  }
  return null
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const inRange = (d: Date, a: Date, b: Date) => d.getTime() >= a.getTime() && d.getTime() < b.getTime()
const addHours = (d: Date, n: number) => new Date(d.getTime() + n * 3600_000)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000)
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const fmtH = (d: Date) => String(d.getHours()).padStart(2, '0')
const weekday = (d: Date) => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()]
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
