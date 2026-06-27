import area from '@turf/area'
import centroid from '@turf/centroid'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { FieldFeature, FieldProps } from '../types'

/** Flächeninhalt einer Geometrie in Hektar (turf rechnet in m²). */
export function areaHa(feature: Feature<Polygon | MultiPolygon>): number {
  return Math.round((area(feature) / 10000) * 100) / 100
}

/** Zentroid als [lon, lat] — Standort für die Wetterabfragen. */
export function centroidLonLat(feature: Feature<Polygon | MultiPolygon>): [number, number] {
  const c = centroid(feature)
  const [lon, lat] = c.geometry.coordinates
  return [lon, lat]
}

let counter = 0
/** Stabile, aber simple ID (kein Date.now nötig). */
export function makeFieldId(name: string): string {
  counter += 1
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return `${slug || 'schlag'}-${counter}`
}

/**
 * Normalisiert beliebige importierte Polygon-Features auf unsere FieldProps:
 * - übernimmt Name/Sorte/Fläche aus gängigen Attributnamen, sonst Defaults
 * - berechnet die Fläche aus der Geometrie zur Kontrolle
 */
export function normalizeField(
  feature: Feature<Polygon | MultiPolygon>,
  index: number,
): FieldFeature {
  const p = (feature.properties ?? {}) as Record<string, unknown>
  const name =
    pickString(p, ['name', 'NAME', 'schlag', 'SCHLAG', 'bezeichnung', 'FELDSTUECK', 'fsnummer', 'FS_NR']) ??
    `Schlag ${index + 1}`
  const sorte = pickString(p, ['sorte', 'SORTE', 'kultur', 'KULTUR', 'frucht', 'nutzung']) ?? 'unbekannt'
  const reported = pickNumber(p, ['flaeche_ha', 'flaeche', 'FLAECHE', 'flaeche_ha', 'groesse', 'area_ha', 'ha'])
  const calc = areaHa(feature)
  const props: FieldProps = {
    id: makeFieldId(name),
    name,
    sorte,
    flaeche_ha: reported ?? calc,
    flaeche_calc_ha: calc,
  }
  return { type: 'Feature', geometry: feature.geometry, properties: props }
}

function pickString(p: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = p[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

function pickNumber(p: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = p[k]
    if (typeof v === 'number' && isFinite(v)) return v
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(',', '.'))
      if (isFinite(n)) return n
    }
  }
  return undefined
}
