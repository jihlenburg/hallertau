import type { Status } from './status.js'

// ===== Wasserbilanz v2: FAO-56 Wurzelraum-Tipping-Bucket =====
// Backend-Compute (zustandslos): Init am Fensteranfang auf Feldkapazität (Dr=0),
// Warm-up über das verfügbare Open-Meteo-`past_days`-Fenster bis „heute".

/** Verarmungsfraktion p: bei p·TAW wird bewässert (FAO-56). */
export const WB_P = 0.5

export interface SoilWaterBalance {
  /** Wurzelraum-Verarmung Dr (mm); 0 = Feldkapazität, TAW = Welkepunkt. */
  dr: number
  /** Wasserstress-Koeffizient Ks (0..1) am letzten Tag. */
  ks: number
  /** Defizit (= Dr, mm). */
  deficit: number
  status: Status
  /** Empfohlene Netto-Gabe (mm) zum Auffüllen auf Feldkapazität; 0 wenn nicht nötig. */
  recommendMm: number
  taw: number
  raw: number
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * FAO-56 Wurzelraum-Wasserbilanz über aligned Tagesreihen (Allen et al. 1998).
 * Dr_i = clamp( Dr_{i-1} + Ks·Kc·ET0 − (P − RO) − I , 0, TAW );  v1: RO=0, I=0.
 * Ks = (TAW−Dr)/(TAW−RAW) wenn Dr>RAW (Wasserstress), sonst 1.
 */
export function computeSoilWaterBalance(
  et0: number[],
  precip: number[],
  kc: number[],
  soil: { taw: number; raw: number },
  init: { dr0: number } = { dr0: 0 },
): SoilWaterBalance {
  const taw = soil.taw
  const raw = Math.min(soil.raw, taw)
  let dr = clamp(init.dr0, 0, taw)
  let ks = 1
  const n = Math.min(et0.length, precip.length, kc.length)
  for (let i = 0; i < n; i++) {
    ks = dr > raw && taw > raw ? clamp((taw - dr) / (taw - raw), 0, 1) : 1
    const etc = ks * (kc[i] || 0) * (isFinite(et0[i]) ? et0[i] : 0)
    const p = isFinite(precip[i]) ? precip[i] : 0
    dr = clamp(dr + etc - p, 0, taw) // Überlauf < 0 = Tiefenperkolation
  }
  const status: Status = dr >= raw ? 'alert' : dr >= 0.5 * raw ? 'warn' : 'good'
  return {
    dr: round1(dr),
    ks: round2(ks),
    deficit: round1(dr),
    status,
    recommendMm: dr >= raw ? round1(dr) : 0,
    taw: round1(taw),
    raw: round1(raw),
  }
}
