// DWD-Warnungen über Bright Sky. Im Dev-Server via Vite-Proxy (/api/brightsky),
// damit CORS keine Rolle spielt. Schlägt der Abruf fehl, liefern wir null und
// die Wetterkarte fällt auf die aus der Vorhersage abgeleitete Einschätzung zurück.

export interface DwdAlert {
  event: string | null
  headline: string | null
  description: string | null
  severity: string | null // 'minor' | 'moderate' | 'severe' | 'extreme'
}

interface BrightSkyAlertsResponse {
  alerts: Array<{
    event_de?: string | null
    headline_de?: string | null
    description_de?: string | null
    severity?: string | null
  }>
}

export async function fetchDwdAlerts(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<DwdAlert[] | null> {
  try {
    const url = `/api/brightsky/alerts?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as BrightSkyAlertsResponse
    return (data.alerts ?? []).map((a) => ({
      event: a.event_de ?? null,
      headline: a.headline_de ?? null,
      description: a.description_de ?? null,
      severity: a.severity ?? null,
    }))
  } catch {
    return null
  }
}

export function severityRank(sev: string | null): number {
  switch ((sev ?? '').toLowerCase()) {
    case 'extreme': return 4
    case 'severe': return 3
    case 'moderate': return 2
    case 'minor': return 1
    default: return 0
  }
}
