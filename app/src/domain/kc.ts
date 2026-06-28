// FAO-56-Kc-Kurve für Hopfen, v1 KALENDERbasiert (Hallertau). Später GTS/NDVI-gestützt.
export const KC = { INI: 0.3, MID: 1.05, END: 0.85 } as const

// Tag im Jahr (DOY). Hallertau: Austrieb ~April, Gerüst Ende Juni,
// Hauptwachstum Juli–Aug, Ernte Ende Aug–Sep.
const doy = (d: Date) => {
  const start = Date.UTC(d.getFullYear(), 0, 0)
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t))

export function kcForDate(d: Date): number {
  const n = doy(d)
  const EMERGE = doy(new Date(d.getFullYear(), 3, 1)) // 1. Apr — Beginn Initialphase
  const INI_END = doy(new Date(d.getFullYear(), 3, 20)) // 20. Apr — Ende flache Initialphase
  const DEV_END = doy(new Date(d.getFullYear(), 6, 1)) // 1. Jul — Voll-Laubwand (Mitte beginnt)
  const MID_END = doy(new Date(d.getFullYear(), 7, 25)) // 25. Aug — Ende Hauptphase
  const HARVEST = doy(new Date(d.getFullYear(), 8, 20)) // 20. Sep — Ernte (Spätphasen-Ende)
  if (n < EMERGE || n > HARVEST) return KC.INI // vegetationslos / nach Ernte: kein Vollbedarf
  if (n <= INI_END) return KC.INI // flache Initialphase
  if (n <= DEV_END) return lerp(KC.INI, KC.MID, (n - INI_END) / (DEV_END - INI_END)) // Entwicklung
  if (n <= MID_END) return KC.MID // Hauptphase
  return lerp(KC.MID, KC.END, (n - MID_END) / (HARVEST - MID_END)) // Spätphase
}
