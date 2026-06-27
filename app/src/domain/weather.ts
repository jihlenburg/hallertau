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
}

/**
 * Bewertet die Wetterlage: bevorzugt amtliche DWD-Warnungen (Bright Sky);
 * fehlen sie, wird aus den Wettercodes der nächsten ~48 h abgeleitet.
 */
export function assessWeather(
  data: OpenMeteoData,
  alerts: DwdAlert[] | null,
  now: Date = new Date(),
): WeatherAssessment {
  // 1) Amtliche Warnungen, wenn vorhanden
  if (alerts && alerts.length) {
    const top = [...alerts].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0]
    const rank = severityRank(top.severity)
    return {
      status: rank >= 3 ? 'alert' : 'warn',
      headline: top.event || top.headline || 'Amtliche Warnung',
      detail: shorten(top.headline || top.description || 'Es liegt eine DWD-Warnung vor.'),
      warningSource: 'dwd',
    }
  }

  // 2) Aus der Vorhersage ableiten
  const idxNext = nextDayIndices(data.daily.time, now, 2)
  const codes = idxNext.map((i) => data.daily.weather_code[i])
  const severe = codes.some((c) => wmo(c).severe)
  const thunder = codes.some((c) => wmo(c).thunder)
  const maxProb = Math.max(0, ...idxNext.map((i) => data.daily.precipitation_probability_max[i] ?? 0))
  const cur = wmo(data.current.weather_code).text
  const t = Math.round(data.current.temperature_2m)

  if (thunder) {
    return {
      status: 'warn',
      headline: 'Gewitter möglich',
      detail: `Aktuell ${t}° · ${cur}. In den nächsten Tagen Gewitterneigung (bis ${maxProb}% Niederschlag).`,
      warningSource: 'derived',
    }
  }
  if (severe || maxProb >= 70) {
    return {
      status: 'warn',
      headline: 'Wechselhaft',
      detail: `Aktuell ${t}° · ${cur}. Zeitweise kräftiger Niederschlag möglich (bis ${maxProb}%).`,
      warningSource: 'derived',
    }
  }
  return {
    status: 'good',
    headline: 'Ruhiges Wetter',
    detail: `Aktuell ${t}° · ${cur}. Keine Warnungen, Niederschlag bis ${maxProb}%.`,
    warningSource: 'derived',
  }
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
