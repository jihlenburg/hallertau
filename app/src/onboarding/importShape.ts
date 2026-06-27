import shp from 'shpjs'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { centroidLonLat } from '../domain/fields'

/** Großzügige Bounding-Box für Bayern (WGS84) — nur zur Plausibilitätsprüfung. */
const BAVARIA = { lonMin: 8.9, lonMax: 13.9, latMin: 47.2, latMax: 50.6 }

/** Liegt ein [lon, lat] grob in Bayern? (Erkennt nicht reprojizierte UTM-Meter.) */
export function isInBavaria([lon, lat]: [number, number]): boolean {
  return lon >= BAVARIA.lonMin && lon <= BAVARIA.lonMax && lat >= BAVARIA.latMin && lat <= BAVARIA.latMax
}

/**
 * Sicherheitsnetz nach dem Import: liegt der Schwerpunkt jeder Fläche plausibel in
 * Bayern? Fehlt/zerbricht die `.prj`, bleiben die Koordinaten in UTM32-Metern und
 * würden sonst stumm „im Ozean" landen. Statt falscher Geometrie ein klarer Fehler.
 */
export function assertPlausibleBavaria(features: Feature<Polygon | MultiPolygon>[]): void {
  for (const f of features) {
    if (!isInBavaria(centroidLonLat(f))) {
      throw new Error(
        'Koordinaten konnten nicht nach WGS84 umgerechnet werden (Projektion/.prj prüfen) — ' +
          'die Flächen liegen außerhalb Bayerns. Bitte iBALIS-Export inkl. .prj hochladen.',
      )
    }
  }
}

/**
 * Liest ein iBALIS-/Schlagkartei-Shape-ZIP (.shp/.dbf/.prj) im Browser.
 * shpjs reprojiziert anhand der .prj nach WGS84 (proj4 intern), erkennt also
 * UTM32 / EPSG:25832 automatisch. Rückgabe: nur Polygon-/MultiPolygon-Features.
 * Hinweis: DBF-Encoding (cp1252/.cpg, Umlaute in Namen) ist noch nicht gehärtet
 * (betrifft nur Attribut-Texte, im Review korrigierbar) — siehe TODO.md.
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
  assertPlausibleBavaria(feats) // reprojizierte Koordinaten sanity-checken
  return feats
}

function isPolygonal(f: Feature): boolean {
  return f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
}
