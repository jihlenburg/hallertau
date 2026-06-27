// Open-Meteo/ICON-D2 löst um Au i.d.Hallertau grob auf (~2 km Raster). Eng
// benachbarte Schläge fallen daher in dieselbe Modellzelle und liefern praktisch
// identische Wetter-/Spritz-/Bewässerungswerte. Mit diesem Zellschlüssel kann die
// Übersicht ehrlich kennzeichnen, dass ein angezeigter Wert „regional" gilt und
// nicht feldspezifisch ist (siehe overview).

// Kantenlänge ~2,2 km bei 48,4° N: ~0,02° Breite, ~0,03° Länge.
const LAT_STEP = 0.02
const LON_STEP = 0.03

/** Snappt [lon, lat] auf eine ~2-km-Rasterzelle und gibt einen stabilen Schlüssel zurück. */
export function gridCellKey([lon, lat]: [number, number]): string {
  const latIdx = Math.round(lat / LAT_STEP)
  const lonIdx = Math.round(lon / LON_STEP)
  return `${latIdx}:${lonIdx}`
}
