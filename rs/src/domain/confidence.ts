// Pixel-Purity-/Konfidenz-Schicht (die Ehrlichkeits-Regel). Aus den Backtests:
// Satellit ist auf 0,5–2 ha Hopfen-Gerüst NIE teilflächengenau → immer „regionales Screening".
// Wenige wolkenfreie Pixel → Feldmittel unsicher; 20-m-Index (Red-Edge/SWIR) auf <1 ha → nicht belastbar.
export type ConfidenceTier = 'none' | 'niedrig' | 'ok'

export interface FieldConfidence {
  validPixels: number
  tier: ConfidenceTier
  usable: boolean
  /** Ehrliche Skalen-Einstufung — bei Satellit NIE „teilflächengenau". */
  label: string
  note: string
}

const MIN_PIXELS = 9 // unter ~9 inneren Pixeln ist das Feldmittel nicht belastbar (Backtest)

export function assessConfidence(validPixels: number, opts: { res?: number; areaHa?: number } = {}): FieldConfidence {
  const res = opts.res ?? 10
  const area = opts.areaHa
  const SCREENING = 'regionales Screening'

  if (res >= 20 && area != null && area < 1) {
    return {
      validPixels,
      tier: 'none',
      usable: false,
      label: SCREENING,
      note: `Schlag < 1 ha — ${res}-m-Index (Red-Edge/SWIR) nicht belastbar.`,
    }
  }
  if (validPixels < MIN_PIXELS) {
    return {
      validPixels,
      tier: 'none',
      usable: false,
      label: SCREENING,
      note: 'Zu wenige wolkenfreie Pixel für ein belastbares Feldmittel.',
    }
  }
  const tier: ConfidenceTier = validPixels >= 30 ? 'ok' : 'niedrig'
  return {
    validPixels,
    tier,
    usable: true,
    label: `${SCREENING} (Feldmittel)`,
    note: `${validPixels} wolkenfreie ${res}-m-Pixel — Feldmittel, nicht teilflächengenau.`,
  }
}
