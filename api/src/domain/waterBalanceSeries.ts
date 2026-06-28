import type { DailySeries } from '../sources/openMeteo.js'
import { kcForDate } from './kc.js'
import { taw as computeTaw } from './soil.js'
import { computeSoilWaterBalance, WB_P, type SoilWaterBalance } from './waterBalance.js'

export interface SoilInput {
  /** Nutzbare Feldkapazität (mm/m). */
  nfkMmPerM: number
  /** Wurzeltiefe Zr (m). */
  rootDepthM: number
}

export interface WaterBalanceSeriesResult extends SoilWaterBalance {
  /** Tatsächlich gerechnetes Fenster (Tage ≤ asOf). */
  window: { from: string; to: string; days: number }
}

/** 'YYYY-MM-DD' → lokales Date (nur Y/M/D relevant für kcForDate). */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Zustandsloser FAO-56-Warm-up über das verfügbare Open-Meteo-Tagesfenster.
 * Init am Fensteranfang auf Feldkapazität (Dr=0; Hallertau: nasse Winter, plausibel),
 * je vergangenem Tag das HISTORISCHE Kc-Stadium, bis einschließlich `asOf`.
 *
 * @param series Tagesreihen (Datum aufsteindend) inkl. Vorhersage — wird auf ≤ asOf getrimmt.
 * @param soil   nFK[mm/m] + Wurzeltiefe Zr[m].
 * @param asOf   Stichtag 'YYYY-MM-DD' (i. d. R. „heute", Europe/Berlin).
 * @param opts   p = Verarmungsfraktion (Default WB_P = 0.5).
 */
export function computeWaterBalanceSeries(
  series: DailySeries,
  soil: SoilInput,
  asOf: string,
  opts: { p?: number } = {},
): WaterBalanceSeriesResult {
  // 'YYYY-MM-DD' sortiert lexikografisch = chronologisch.
  const keep: number[] = []
  for (let i = 0; i < series.dates.length; i++) {
    if (series.dates[i] <= asOf) keep.push(i)
  }
  if (keep.length === 0) {
    throw new Error(`Keine Tagesdaten ≤ ${asOf} (Fenster leer).`)
  }

  const et0 = keep.map((i) => series.et0[i])
  const precip = keep.map((i) => series.precip[i])
  const kc = keep.map((i) => kcForDate(parseLocalDate(series.dates[i])))

  const taw = computeTaw(soil.nfkMmPerM, soil.rootDepthM)
  const p = opts.p ?? WB_P
  const raw = p * taw

  const balance = computeSoilWaterBalance(et0, precip, kc, { taw, raw }, { dr0: 0 })

  return {
    ...balance,
    window: {
      from: series.dates[keep[0]],
      to: series.dates[keep[keep.length - 1]],
      days: keep.length,
    },
  }
}
