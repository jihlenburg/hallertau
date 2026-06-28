import type { FastifyInstance } from 'fastify'
import type { DailySeries } from '../sources/openMeteo.js'
import {
  SOIL_TYPES,
  DEFAULT_SOIL,
  DEFAULT_ROOT_DEPTH_M,
  nfkForSoilType,
  type SoilType,
} from '../domain/soil.js'
import { computeWaterBalanceSeries } from '../domain/waterBalanceSeries.js'
import { API_VERSION } from '../version.js'

export interface WaterBalanceDeps {
  fetchDaily: (lat: number, lon: number, signal?: AbortSignal) => Promise<DailySeries>
}

const isSoilType = (s: string): s is SoilType => (SOIL_TYPES as readonly string[]).includes(s)

/** Heutiges Kalenderdatum in Europe/Berlin als 'YYYY-MM-DD'. */
function todayBerlin(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const CAVEATS = [
  'nFK ist 250-m-grob (ein Pixel ≈ ganzer Schlag) — nicht feldscharf.',
  'Annahmen v1: kein Oberflächenabfluss (RO=0), keine Beregnung geloggt (I=0); Tagesregen voll als effektiv gezählt.',
  'Init am Fensteranfang = Feldkapazität (Dr=0). Orientierung, keine verbindliche Beregnungsanweisung.',
]

/** Registriert GET /api/water-balance (Datenquelle injizierbar → testbar). */
export function registerWaterBalanceRoute(app: FastifyInstance, deps: WaterBalanceDeps): void {
  app.get('/api/water-balance', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>

    // --- Koordinaten ---
    const lat = Number(q.lat)
    const lon = Number(q.lon)
    if (
      q.lat == null ||
      q.lon == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return reply.code(400).send({ error: 'lat/lon erforderlich und plausibel (lat ∈ [-90,90], lon ∈ [-180,180]).' })
    }

    // --- Boden: expliziter nFK-Override > Bodenart > Default ---
    let soilType: SoilType | undefined
    let nfkMmPerM: number
    if (q.nfkMmPerM != null) {
      const n = Number(q.nfkMmPerM)
      if (!Number.isFinite(n) || n <= 0) return reply.code(400).send({ error: 'nfkMmPerM muss eine Zahl > 0 sein.' })
      nfkMmPerM = n
      soilType = q.soilType != null && isSoilType(q.soilType) ? q.soilType : undefined
    } else if (q.soilType != null) {
      if (!isSoilType(q.soilType)) {
        return reply.code(400).send({ error: `soilType muss einer von ${SOIL_TYPES.join(', ')} sein.` })
      }
      soilType = q.soilType
      nfkMmPerM = nfkForSoilType(soilType)
    } else {
      soilType = DEFAULT_SOIL
      nfkMmPerM = nfkForSoilType(DEFAULT_SOIL)
    }

    // --- Wurzeltiefe ---
    let rootDepthM = DEFAULT_ROOT_DEPTH_M
    if (q.rootDepthM != null) {
      const r = Number(q.rootDepthM)
      if (!Number.isFinite(r) || r <= 0) return reply.code(400).send({ error: 'rootDepthM muss eine Zahl > 0 sein.' })
      rootDepthM = r
    }

    // --- Stichtag ---
    const asOf = q.asOf && /^\d{4}-\d{2}-\d{2}$/.test(q.asOf) ? q.asOf : todayBerlin()

    // --- Datenabruf + Compute (BFF) ---
    try {
      const series = await deps.fetchDaily(lat, lon)
      const r = computeWaterBalanceSeries(series, { nfkMmPerM, rootDepthM }, asOf)
      return reply.send({
        apiVersion: API_VERSION,
        card: 'water-balance',
        status: r.status,
        dr: r.dr,
        ks: r.ks,
        deficit: r.deficit,
        recommendMm: r.recommendMm,
        taw: r.taw,
        raw: r.raw,
        window: r.window,
        soil: { soilType, nfkMmPerM, rootDepthM },
        asOf,
        provenance: {
          et0: 'Open-Meteo (FAO-56 ET0)',
          precip: 'Open-Meteo (Niederschlag)',
          soil: soilType ? `Bodenart „${soilType}" → nFK` : 'nFK-Override',
        },
        caveats: CAVEATS,
      })
    } catch (err) {
      req.log.error(err)
      return reply.code(502).send({ error: 'Wasserbilanz nicht abrufbar (Datenquelle/Compute).' })
    }
  })
}
