// Setzt aus den CDSE-Zeitreihen (10 m + 20 m) das Per-Schlag-Vigor-Ergebnis zusammen.
// Primärindex = NDRE (Red-Edge) — bei Hopfen der direkteste Vigor/N-Proxy. Ehrlich: Screening.
// Satellit triggert NIE roten Alarm — eine Vigor-Delle ist ein „Geh-Kontrollieren"-Hinweis (warn).
import { INDEX_RES } from './indices.js'
import { assessConfidence, type FieldConfidence } from './confidence.js'
import type { IntervalStat } from '../cdse/statistical.js'

export type Status = 'good' | 'warn' | 'alert' | 'info'
export type Trend = 'steigend' | 'fallend' | 'stabil' | 'unbekannt'

export interface IndexVigor {
  index: string
  latest: number | null
  latestDate: string | null
  seasonMean: number | null
  trend: Trend
  anomaly: number | null // z-Score des letzten Werts ggü. Saison
  confidence: FieldConfidence
}

export interface FieldVigor {
  status: Status
  primary: string
  asOf: string | null
  indices: Record<string, IndexVigor>
  caveats: string[]
}

const INDICES_10 = ['ndvi', 'savi']
const INDICES_20 = ['ndre', 'cire', 'ndmi']

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const stdev = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = avg(xs)
  return Math.sqrt(avg(xs.map((x) => (x - m) ** 2)))
}
const r3 = (n: number) => Math.round(n * 1000) / 1000
const r2 = (n: number) => Math.round(n * 100) / 100

function indexVigor(index: string, series: IntervalStat[], areaHa?: number): IndexVigor {
  const res = INDEX_RES[index] ?? 10
  const valid = series
    .filter((s) => s.outputs[index] && s.outputs[index].mean != null)
    .map((s) => ({
      date: s.from,
      mean: s.outputs[index].mean as number,
      n: Math.max(0, s.outputs[index].sampleCount - s.outputs[index].noDataCount),
    }))
  if (valid.length === 0) {
    return { index, latest: null, latestDate: null, seasonMean: null, trend: 'unbekannt', anomaly: null, confidence: assessConfidence(0, { res, areaHa }) }
  }
  const last = valid[valid.length - 1]
  const means = valid.map((v) => v.mean)
  const seasonMean = avg(means)
  const sd = stdev(means)
  const prior = means.slice(0, -1)
  let trend: Trend = 'unbekannt'
  if (prior.length) {
    const pm = avg(prior)
    trend = last.mean > pm * 1.05 ? 'steigend' : last.mean < pm * 0.95 ? 'fallend' : 'stabil'
  }
  const anomaly = valid.length >= 2 && sd > 0 ? (last.mean - seasonMean) / sd : null
  return {
    index,
    latest: r3(last.mean),
    latestDate: last.date,
    seasonMean: r3(seasonMean),
    trend,
    anomaly: anomaly == null ? null : r2(anomaly),
    confidence: assessConfidence(last.n, { res, areaHa }),
  }
}

export function assembleVigor(series10: IntervalStat[], series20: IntervalStat[], opts: { areaHa?: number } = {}): FieldVigor {
  const indices: Record<string, IndexVigor> = {}
  for (const idx of INDICES_10) indices[idx] = indexVigor(idx, series10, opts.areaHa)
  for (const idx of INDICES_20) indices[idx] = indexVigor(idx, series20, opts.areaHa)

  const ndre = indices.ndre
  let status: Status = 'info'
  if (ndre.confidence.usable) {
    // Vigor-Delle (NDRE deutlich unter Saisonmittel) = „Geh-Kontrollieren"; sonst nominal. Nie 'alert'.
    status = ndre.anomaly != null && ndre.anomaly < -1 ? 'warn' : 'good'
  }

  return {
    status,
    primary: 'ndre',
    asOf: ndre.latestDate,
    indices,
    caveats: [
      'Satellit = regionales Screening (Feldmittel), nicht teilflächengenau.',
      'NDRE/Red-Edge ist nativ 20 m → wenige Pixel je Schlag; nur als Tendenz lesen.',
      'Keine Brauqualitäts-/Alpha-Aussage; keine Krankheitsdiagnose (→ LfL/ISIP-Warndienst).',
      'Wolken begrenzen die Verfügbarkeit — gezeigt wird das jüngste wolkenfreie Feldmittel.',
    ],
  }
}
