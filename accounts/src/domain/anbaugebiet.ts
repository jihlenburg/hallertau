/**
 * Anbaugebiet sanity validator — pure, no I/O.
 *
 * Used during onboarding as a SOFT check: flags whether a field geometry
 * lies in a German hop Anbaugebiet.  Never hard-rejects; callers should
 * treat a negative result as a warning, not an error.
 *
 * Exports:
 *   pointInPolygon(point, ring) → boolean   — ray-casting, handles open rings
 *   isInHopRegion(geometry)    → { inRegion, region? }
 */

import anbaugebiete from './anbaugebiete.geojson'

// ── Types ─────────────────────────────────────────────────────────────────────

/** [longitude, latitude] */
export type Point = [number, number]

/** An ordered array of [lng, lat] pairs forming a ring.
 *  May be open (first ≠ last) or closed (first === last). */
export type Ring = [number, number][]

export type GeoPolygon = {
  type: 'Polygon'
  coordinates: [number, number][][]
}

export type GeoMultiPolygon = {
  type: 'MultiPolygon'
  coordinates: [number, number][][][]
}

export type GeoGeometry = GeoPolygon | GeoMultiPolygon

export type GeoFeature = {
  type: 'Feature'
  geometry: GeoGeometry
  properties: Record<string, unknown>
}

export type HopRegionName = 'Hallertau' | 'Spalt' | 'Tettnang' | 'Elbe-Saale'

export type HopRegionResult =
  | { inRegion: true; region: HopRegionName }
  | { inRegion: false }

// ── pointInPolygon ─────────────────────────────────────────────────────────────

/**
 * Ray-casting test: does `point` lie inside the polygon `ring`?
 *
 * The ring is treated as a closed loop regardless of whether the last vertex
 * repeats the first.  Points exactly on an edge have implementation-defined
 * behaviour (consistent with other ray-casting implementations).
 *
 * @param point  [lng, lat] — the point to test
 * @param ring   Sequence of [lng, lat] vertices forming the polygon boundary
 */
export function pointInPolygon(point: Point, ring: Ring): boolean {
  const [px, py] = point
  let inside = false
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    // Crosses a horizontal ray from point to +∞ only if the edge straddles py
    const straddles = yi > py !== yj > py
    if (straddles) {
      // x-coordinate of the intersection of the edge with the horizontal ray
      const xIntersect = ((xj - xi) * (py - yi)) / (yj - yi) + xi
      if (px < xIntersect) {
        inside = !inside
      }
    }
  }
  return inside
}

// ── centroid ───────────────────────────────────────────────────────────────────

/**
 * Arithmetic centroid of a ring (mean of all vertices).
 * Good enough as a representative point for the soft sanity check.
 */
function centroidOfRing(ring: Ring): Point {
  let sumX = 0
  let sumY = 0
  const n = ring.length
  for (let i = 0; i < n; i++) {
    sumX += ring[i][0]
    sumY += ring[i][1]
  }
  return [sumX / n, sumY / n]
}

// ── Region data ────────────────────────────────────────────────────────────────

type RegionFeature = {
  type: 'Feature'
  properties: { name: string }
  geometry: {
    type: string
    coordinates: unknown
  }
}

const regions = (anbaugebiete as { features: RegionFeature[] }).features

// ── isInHopRegion ─────────────────────────────────────────────────────────────

/**
 * Soft sanity check: is the representative point of `input` inside a known
 * German hop Anbaugebiet?
 *
 * @param input  A GeoJSON Polygon, MultiPolygon, or Feature wrapping either.
 */
export function isInHopRegion(input: GeoGeometry | GeoFeature): HopRegionResult {
  // Unwrap Feature
  const geometry: GeoGeometry =
    input.type === 'Feature' ? input.geometry : input

  // Extract the first ring to derive the representative point
  let firstRing: Ring
  if (geometry.type === 'Polygon') {
    firstRing = geometry.coordinates[0] as Ring
  } else {
    // MultiPolygon: first polygon → first ring
    firstRing = geometry.coordinates[0][0] as Ring
  }

  const point = centroidOfRing(firstRing)

  for (const feature of regions) {
    const name = feature.properties.name as HopRegionName
    const geom = feature.geometry

    if (geom.type === 'Polygon') {
      const ring = (geom.coordinates as [number, number][][])[0] as Ring
      if (pointInPolygon(point, ring)) {
        return { inRegion: true, region: name }
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates as [number, number][][][]) {
        if (pointInPolygon(point, polygon[0] as Ring)) {
          return { inRegion: true, region: name }
        }
      }
    }
  }

  return { inRegion: false }
}
