import type { OpenMeteoData } from '../api/openMeteo'
import type { DwdAlert } from '../api/brightSky'
import { severityRank } from '../api/brightSky'
import { wmo } from './wmo'
import type { Status } from '../types'

export interface WeatherAssessment {
  status: Status
  headline: string
  detail: string
  /** Quelle der Warnaussage: amtlich (Bright Sky/DWD) oder abgeleitet. */
  warningSource: 'dwd' | 'derived'
  /**
   * Waren amtliche Warnungen abrufbar? false = Abruf fehlgeschlagen (alerts === null);
   * true = erreichbar (amtliche Warnung vorhanden ODER nachweislich keine aktive Warnung).
   * Erlaubt der UI, „nicht abrufbar" ehrlich von „keine Warnung" zu unterscheiden.
   */
  alertsReachable: boolean
}

/** Schwellen für die aus der Vorhersage abgeleitete Frost-Einschätzung (°C). */
export const FROST = { ALERT_MAX: 0, WARN_MAX: 2 }

/**
 * Bewertet die Wetterlage: bevorzugt amtliche DWD-Warnungen (Bright Sky);
 * fehlen sie, wird aus Vorhersage-Tiefstwerten und Wettercodes der nächsten
 * ~48 h abgeleitet. Der abgeleitete Pfad erkennt insbesondere Nachtfrost
 * (Spätfrost-Risiko am jungen Hopfentrieb), den die reine Code-Auswertung sonst
 * übersieht. `alertsReachable` trennt „Warnungen nicht abrufbar" von „keine Warnung".
 */
export function assessWeather(
  data: OpenMeteoData,
  alerts: DwdAlert[] | null,
  now: Date = new Date(),
): WeatherAssessment {
  const alertsReachable = alerts !== null

  // 1) Amtliche Warnungen, wenn vorhanden
  if (alerts && alerts.length) {
    const top = [...alerts].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0]
    const rank = severityRank(top.severity)
    return {
      status: rank >= 3 ? 'alert' : 'warn',
      headline: top.event || top.headline || 'Amtliche Warnung',
      detail: shorten(top.headline || top.description || 'Es liegt eine DWD-Warnung vor.'),
      warningSource: 'dwd',
      alertsReachable: true,
    }
  }

  // 2) Aus der Vorhersage ableiten
  const idxNext = nextDayIndices(data.daily.time, now, 2)
  const codes = idxNext.map((i) => data.daily.weather_code[i])
  const severe = codes.some((c) => wmo(c).severe)
  const thunder = codes.some((c) => wmo(c).thunder)
  const maxProb = Math.max(0, ...idxNext.map((i) => data.daily.precipitation_probability_max[i] ?? 0))
  const mins = idxNext
    .map((i) => data.daily.temperature_2m_min[i])
    .filter((x): x is number => typeof x === 'number' && isFinite(x))
  const minNext = mins.length ? Math.min(...mins) : Infinity
  const cur = wmo(data.current.weather_code).text
  const t = Math.round(data.current.temperature_2m)
  // Abgeleitete Einschätzung kann amtliche Warnungen nicht ersetzen — Quelle kennzeichnen.
  const reachNote = alertsReachable ? '' : ' Amtliche Warnungen derzeit nicht abrufbar.'
  const derived = (status: Status, headline: string, detail: string): WeatherAssessment => ({
    status, headline, detail: detail + reachNote, warningSource: 'derived', alertsReachable,
  })

  // Frost zuerst: am gefährlichsten und von Wettercodes nicht abgedeckt.
  if (minNext <= FROST.ALERT_MAX) {
    return derived('alert', 'Frostgefahr heute Nacht',
      `Aktuell ${t}° · ${cur}. Tiefstwert bis ${Math.round(minNext)}° — Frostschutz prüfen.`)
  }
  if (thunder) {
    return derived('warn', 'Gewitter möglich',
      `Aktuell ${t}° · ${cur}. In den nächsten Tagen Gewitterneigung (bis ${maxProb}% Niederschlag).`)
  }
  if (severe || maxProb >= 70) {
    return derived('warn', 'Wechselhaft',
      `Aktuell ${t}° · ${cur}. Zeitweise kräftiger Niederschlag möglich (bis ${maxProb}%).`)
  }
  if (minNext <= FROST.WARN_MAX) {
    return derived('warn', 'Bodenfrost möglich',
      `Aktuell ${t}° · ${cur}. Tiefstwert bis ${Math.round(minNext)}° — bodennah Frost möglich.`)
  }
  return derived('good', 'Ruhiges Wetter',
    `Aktuell ${t}° · ${cur}. Keine Warnungen, Niederschlag bis ${maxProb}%.`)
}

function nextDayIndices(times: string[], now: Date, n: number): number[] {
  const out: number[] = []
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  for (let i = 0; i < times.length; i++) {
    const d = new Date(times[i] + 'T12:00')
    if (d.getTime() >= today.getTime()) out.push(i)
    if (out.length >= n + 1) break
  }
  return out
}

const shorten = (s: string) => (s.length > 110 ? s.slice(0, 107) + '…' : s)
