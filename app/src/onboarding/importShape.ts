import shp from 'shpjs'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

/**
 * Liest ein iBALIS-/Schlagkartei-Shape-ZIP (.shp/.dbf/.prj) im Browser.
 * shpjs reprojiziert anhand der .prj nach WGS84 (proj4 intern), erkennt also
 * UTM32 / EPSG:25832 automatisch. Rückgabe: nur Polygon-/MultiPolygon-Features.
 */
export async function importShapeZip(buffer: ArrayBuffer): Promise<Feature<Polygon | MultiPolygon>[]> {
  const result = await shp(buffer)
  const collections = Array.isArray(result) ? result : [result]
  const feats: Feature<Polygon | MultiPolygon>[] = []
  for (const fc of collections) {
    for (const f of fc.features ?? []) {
      if (isPolygonal(f)) feats.push(f as Feature<Polygon | MultiPolygon>)
    }
  }
  if (!feats.length) throw new Error('Keine Flächen (Polygone) im ZIP gefunden.')
  return feats
}

function isPolygonal(f: Feature): boolean {
  return f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
}
