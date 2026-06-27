import type { Status } from '../types'

/**
 * Kulturkoeffizient Hopfen (mittsaisonal). Hopfen hat mit voller Belaubung
 * am Gerüst einen hohen Wasserbedarf; Kc_mid liegt grob bei ~1,0–1,1.
 * Wir nutzen einen festen Mittwert und weisen die Annahme in der UI aus.
 * (Vereinfachung: keine Phasenstaffelung nach BBCH.)
 */
export const KC_HOPS = 1.05

/** Schwellen für die 7-Tage-Bilanz (mm). */
export const WB = { GOOD_MAX: 5, WARN_MAX: 20 }

export interface WaterBalance {
  /** Kulturverdunstung ETc = Σ ET0 · Kc (mm, 7 Tage). */
  etc: number
  /** Niederschlagssumme (mm, 7 Tage). */
  precip: number
  /** Defizit = ETc − Niederschlag (mm). Positiv = Wasserbedarf. */
  deficit: number
  status: Status
  kc: number
}

/**
 * Klimatische Wasserbilanz über die übergebenen Tage.
 * KEIN Bodenmodell (ignoriert Speicherkapazität, Wurzeltiefe, bereits
 * erfolgte Beregnung) — als Orientierung gedacht.
 *
 * @param et0    tägliche ET0 (FAO-56) in mm
 * @param precip tägliche Niederschlagssumme in mm
 * @param kc     Kulturkoeffizient (Default Hopfen)
 */
export function computeWaterBalance(et0: number[], precip: number[], kc: number = KC_HOPS): WaterBalance {
  const etcRaw = sum(et0) * kc
  const precipSum = sum(precip)
  const deficit = etcRaw - precipSum
  let status: Status = 'good'
  if (deficit > WB.WARN_MAX) status = 'alert'
  else if (deficit > WB.GOOD_MAX) status = 'warn'
  return {
    etc: round1(etcRaw),
    precip: round1(precipSum),
    deficit: round1(deficit),
    status,
    kc,
  }
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + (isFinite(b) ? b : 0), 0)
const round1 = (n: number) => Math.round(n * 10) / 10
