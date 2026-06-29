import type { FastifyInstance } from 'fastify'
import { EVALSCRIPT_10, EVALSCRIPT_20 } from '../domain/indices.js'
import { assembleVigor } from '../domain/vigor.js'
import type { IntervalStat, StatsRequestOpts, GeoJsonGeometry } from '../cdse/statistical.js'
import { API_VERSION } from '../version.js'

export interface VigorDeps {
  getToken: () => Promise<string>
  fetchStats: (opts: StatsRequestOpts, token: string) => Promise<IntervalStat[]>
}

const isGeometry = (g: unknown): g is GeoJsonGeometry => {
  const t = (g as { type?: string } | null)?.type
  return (t === 'Polygon' || t === 'MultiPolygon') && Array.isArray((g as { coordinates?: unknown }).coordinates)
}
const iso = (d: Date) => d.toISOString().slice(0, 10)
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

/** POST /api/field-vigor — Per-Schlag-Vigor (Feld-Check) aus CDSE. Datenzugriff injiziert (testbar). */
export function registerFieldVigorRoute(app: FastifyInstance, deps: VigorDeps): void {
  app.post('/api/field-vigor', async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    if (!isGeometry(body.geometry)) {
      return reply.code(400).send({ error: 'geometry (Polygon/MultiPolygon, EPSG:4326) erforderlich.' })
    }
    const today = new Date()
    const to = isDate(body.to) ? body.to : iso(today)
    const from = isDate(body.from) ? body.from : iso(new Date(today.getTime() - 120 * 86400_000))
    const areaHa = typeof body.areaHa === 'number' ? body.areaHa : undefined
    const geometry = body.geometry

    try {
      const token = await deps.getToken()
      const [s10, s20] = await Promise.all([
        deps.fetchStats({ geometry, from, to, evalscript: EVALSCRIPT_10, resolution: 10, intervalDays: 7 }, token),
        deps.fetchStats({ geometry, from, to, evalscript: EVALSCRIPT_20, resolution: 20, intervalDays: 7 }, token),
      ])
      const vigor = assembleVigor(s10, s20, { areaHa })
      return reply.send({
        apiVersion: API_VERSION,
        card: 'feld-check',
        window: { from, to },
        ...vigor,
        provenance: {
          source: 'Copernicus Data Space (Sentinel-2 L2A) · Sentinel Hub Statistical API',
          indices: 'NDVI/SAVI 10 m · NDRE/CIre/NDMI 20 m',
          mask: 'SCL (wolkenfrei)',
        },
      })
    } catch (err) {
      req.log.error(err)
      return reply.code(502).send({ error: 'Feld-Check nicht abrufbar (CDSE/Compute).' })
    }
  })
}
