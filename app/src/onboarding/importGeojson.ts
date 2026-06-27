import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'

/**
 * Liest eine GeoJSON-Datei (FeatureCollection oder einzelnes Feature).
 * Erwartet WGS84 (lon,lat) — so geben offene InVeKoS-/Export-Daten i. d. R. aus.
 */
export function importGeojsonText(text: string): Feature<Polygon | MultiPolygon>[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Datei ist kein gültiges JSON.')
  }
  const feats: Feature[] = []
  if (isFeatureCollection(data)) feats.push(...data.features)
  else if (isFeature(data)) feats.push(data)
  else throw new Error('Kein GeoJSON Feature/FeatureCollection erkannt.')

  const polys = feats.filter(
    (f): f is Feature<Polygon | MultiPolygon> =>
      f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon',
  )
  if (!polys.length) throw new Error('Keine Flächen (Polygone) im GeoJSON gefunden.')
  return polys
}

function isFeatureCollection(x: unknown): x is FeatureCollection {
  return !!x && typeof x === 'object' && (x as FeatureCollection).type === 'FeatureCollection'
}
function isFeature(x: unknown): x is Feature {
  return !!x && typeof x === 'object' && (x as Feature).type === 'Feature'
}
