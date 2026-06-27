/**
 * Feuchtkugeltemperatur nach Stull (2011), empirische Näherung aus
 * Lufttemperatur und relativer Feuchte. Gültig grob für RH 5–99 %,
 * T −20…50 °C, Meereshöhe. Quelle: R. Stull, J. Appl. Meteor. Climatol. 50.
 *
 * Wichtig: Das ist eine NÄHERUNG. Wir runden bewusst grob und framen die
 * Ableitung als Orientierung, nicht als exakte Messung.
 *
 * Gültigkeits-Annahme: Die Formel ist auf **Meereshöhe-Druck** kalibriert
 * (RMSE ~0,3 °C, Maximalfehler ~1 °C über RH 5–99 %, T −20…50 °C). Die
 * Hallertau liegt bei ~400–500 m; der daraus folgende Druckeinfluss auf Tw ist
 * klein (sub-°C) und für die grobe ΔT-Orientierung vernachlässigbar. Nahe der
 * Spritzfenster-Grenzen (ΔT 2 bzw. 8 °C) kann ein Fehler dieser Größenordnung
 * eine einzelne Stunde kippen — das geforderte 2-h-Fenster (siehe sprayWindow)
 * glättet solche Einzelausreißer. Referenz-Stützpunkte: siehe wetbulb.test.ts.
 *
 * @param tC  Lufttemperatur in °C
 * @param rh  relative Feuchte in % (0–100)
 * @returns   Feuchtkugeltemperatur in °C
 */
export function stullWetBulb(tC: number, rh: number): number {
  const r = Math.min(99, Math.max(5, rh)) // außerhalb des Gültigkeitsbereichs klemmen
  return (
    tC * Math.atan(0.151977 * Math.sqrt(r + 8.313659)) +
    Math.atan(tC + r) -
    Math.atan(r - 1.676331) +
    0.00391838 * Math.pow(r, 1.5) * Math.atan(0.023101 * r) -
    4.686035
  )
}

/**
 * Delta T (Feuchtkugeldepression) = T − Tw. Standard-Spritzkennzahl:
 * günstig ~2–8 °C, darunter Abdrift/lange Antrocknung, darüber zu schnelle
 * Verdunstung. Quelle: u. a. dt./austral. Pflanzenschutz-Empfehlungen.
 */
export function deltaT(tC: number, rh: number): number {
  return tC - stullWetBulb(tC, rh)
}
