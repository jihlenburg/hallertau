// CDSE Sentinel Hub Statistical API: server-seitige Per-Schlag-Zonalstatistik.
// Liefert je Aggregations-Intervall mean/stdDev/sampleCount je Index-Output — kein Raster-Download.
const STATS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics'

export interface GeoJsonGeometry {
  type: string
  coordinates: unknown
}

export interface StatsRequestOpts {
  geometry: GeoJsonGeometry
  from: string // ISO-Datum 'YYYY-MM-DD'
  to: string
  evalscript: string
  resolution?: number // m (Default 10)
  maxCloud?: number // % (Default 60)
  intervalDays?: number // Aggregations-Intervall (Default 10)
}

export interface OutputStat {
  mean: number | null
  stDev: number | null
  sampleCount: number
  noDataCount: number
}
export interface IntervalStat {
  from: string
  to: string
  outputs: Record<string, OutputStat>
}

/** Repräsentativer Breitengrad der Geometrie (Mittel der äußeren Ring-Punkte). */
function repLat(geom: GeoJsonGeometry): number {
  let ring: unknown = geom.coordinates
  while (Array.isArray(ring) && Array.isArray(ring[0]) && Array.isArray((ring[0] as unknown[])[0])) {
    ring = ring[0]
  }
  const pts = ring as number[][]
  const lats = pts.map((p) => p[1])
  return lats.reduce((a, b) => a + b, 0) / lats.length
}

/**
 * Baut den Statistical-API-Request (reine Funktion). WICHTIG: resx/resy sind in den Einheiten
 * der bounds-CRS (hier EPSG:4326 = GRAD). Daher die gewünschte Meter-Auflösung in Grad am
 * Schlag-Breitengrad umrechnen — sonst kollabiert der Schlag auf ~1 Pixel (resx=10 ⇒ 10°!).
 */
export function buildStatsRequest(o: StatsRequestOpts): object {
  const m = o.resolution ?? 10
  const lat = repLat(o.geometry)
  const resy = m / 111132 // m → ° Breite
  const resx = m / (111320 * Math.cos((lat * Math.PI) / 180)) // m → ° Länge (am Breitengrad)
  return {
    input: {
      bounds: {
        geometry: o.geometry,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { maxCloudCoverage: o.maxCloud ?? 60 } }],
    },
    aggregation: {
      timeRange: { from: `${o.from}T00:00:00Z`, to: `${o.to}T23:59:59Z` },
      aggregationInterval: { of: `P${o.intervalDays ?? 10}D` },
      evalscript: o.evalscript,
      resx,
      resy,
    },
  }
}

/** Flacht die Sentinel-Hub-Antwort zu einer Intervall-Reihe ab (rein, robust gegen leere Outputs). */
export function parseStatsResponse(json: unknown): IntervalStat[] {
  const data = (json as { data?: unknown[] } | null)?.data ?? []
  return (data as Array<Record<string, unknown>>).map((d) => {
    const interval = (d.interval ?? {}) as { from?: string; to?: string }
    const outputs: Record<string, OutputStat> = {}
    for (const [name, out] of Object.entries((d.outputs ?? {}) as Record<string, unknown>)) {
      const stats = ((out as { bands?: { B0?: { stats?: Record<string, unknown> } } }).bands?.B0?.stats ?? {}) as Record<string, unknown>
      // API liefert bei leeren Intervallen "NaN"-Strings → zu null coercieren.
      const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
      const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
      outputs[name] = {
        mean: num(stats.mean),
        stDev: num(stats.stDev),
        sampleCount: int(stats.sampleCount),
        noDataCount: int(stats.noDataCount),
      }
    }
    return { from: interval.from ?? '', to: interval.to ?? '', outputs }
  })
}

/** Holt die Per-Schlag-Statistik (Bearer-Token injiziert; Auth-Modul liefert ihn). */
export async function fetchFieldStats(
  opts: StatsRequestOpts,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<IntervalStat[]> {
  const res = await fetchImpl(STATS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(buildStatsRequest(opts)),
  })
  if (!res.ok) throw new Error(`CDSE statistics: HTTP ${res.status}`)
  return parseStatsResponse(await res.json())
}
