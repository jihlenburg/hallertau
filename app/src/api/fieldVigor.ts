// Client-Anbindung an den Satelliten-Feld-Check (rs/-Dienst). Der Client RECHNET NICHT —
// er POSTet die Schlag-Geometrie an /api/field-vigor und rendert das Ergebnis (Screening).
import type { Status } from '../types'

export const CLIENT_API_VERSION = 1

export interface IndexVigor {
  index: string
  latest: number | null
  latestDate: string | null
  seasonMean: number | null
  trend: 'steigend' | 'fallend' | 'stabil' | 'unbekannt'
  anomaly: number | null
  confidence: { validPixels: number; tier: 'none' | 'niedrig' | 'ok'; usable: boolean; label: string; note: string }
}

export interface FieldVigorData {
  apiVersion: number
  card: string
  status: Status
  primary: string
  asOf: string | null
  window: { from: string; to: string }
  indices: Record<string, IndexVigor>
  caveats: string[]
  provenance?: { source?: string; indices?: string; mask?: string }
}

export type FieldVigorResult =
  | { kind: 'ok'; data: FieldVigorData }
  | { kind: 'incompatible' }
  | { kind: 'error'; message: string }

export interface GeoJsonGeometry {
  type: string
  coordinates: unknown
}

export async function fetchFieldVigor(
  geometry: GeoJsonGeometry,
  opts: { areaHa?: number; from?: string; to?: string },
  signal?: AbortSignal,
): Promise<FieldVigorResult> {
  try {
    const res = await fetch('/api/field-vigor', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'X-Client-API': String(CLIENT_API_VERSION) },
      body: JSON.stringify({ geometry, areaHa: opts.areaHa, from: opts.from, to: opts.to }),
    })
    if (res.status === 426) return { kind: 'incompatible' }
    if (!res.ok) return { kind: 'error', message: `HTTP ${res.status}` }
    return { kind: 'ok', data: (await res.json()) as FieldVigorData }
  } catch (err) {
    return { kind: 'error', message: (err as Error).message }
  }
}
