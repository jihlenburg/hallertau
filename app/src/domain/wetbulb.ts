/**
 * Feuchtkugeltemperatur nach Stull (2011), empirische Näherung aus
 * Lufttemperatur und relativer Feuchte. Gültig grob für RH 5–99 %,
 * T −20…50 °C, Meereshöhe. Quelle: R. Stull, J. Appl. Meteor. Climatol. 50.
 *
 * Wichtig: Das ist eine NÄHERUNG. Wir runden bewusst grob und framen die
 * Ableitung als Orientierung, nicht als exakte Messung.
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
