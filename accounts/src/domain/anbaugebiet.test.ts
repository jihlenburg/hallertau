/**
 * TDD tests for anbaugebiet.ts (Anbaugebiet sanity validator).
 *
 * Invariants under test:
 *  1. pointInPolygon — closed ring, point inside → true.
 *  2. pointInPolygon — closed ring, point outside → false.
 *  3. pointInPolygon — open ring (first ≠ last, treated as closed loop) → correct.
 *  4. isInHopRegion — Polygon input with centroid in Hallertau → {inRegion:true,region:'Hallertau'}.
 *  5. isInHopRegion — Polygon input with centroid in Berlin → {inRegion:false}.
 *  6. isInHopRegion — Feature wrapper → unwrapped and tested.
 *  7. isInHopRegion — MultiPolygon input in Tettnang → {inRegion:true,region:'Tettnang'}.
 *  8. isInHopRegion — Elbe-Saale centroid → {inRegion:true,region:'Elbe-Saale'}.
 *  9. isInHopRegion — Spalt centroid → {inRegion:true,region:'Spalt'}.
 */

import { describe, it, expect } from 'vitest'
import { pointInPolygon, isInHopRegion } from './anbaugebiet.js'

// ── pointInPolygon ────────────────────────────────────────────────────────────

describe('pointInPolygon', () => {
  // Unit square: (0,0)–(1,0)–(1,1)–(0,1)–(0,0)
  const closedSquare: [number, number][] = [
    [0, 0], [1, 0], [1, 1], [0, 1], [0, 0],
  ]

  // Same square without explicit closing vertex (open ring)
  const openSquare: [number, number][] = [
    [0, 0], [1, 0], [1, 1], [0, 1],
  ]

  it('returns true for a point clearly inside a closed ring', () => {
    expect(pointInPolygon([0.5, 0.5], closedSquare)).toBe(true)
  })

  it('returns false for a point clearly outside a closed ring', () => {
    expect(pointInPolygon([2, 2], closedSquare)).toBe(false)
  })

  it('returns false for a point to the left of the ring', () => {
    expect(pointInPolygon([-0.5, 0.5], closedSquare)).toBe(false)
  })

  it('handles an open ring (no closing vertex) as a closed loop — inside', () => {
    // The algorithm must implicitly close from last to first vertex
    expect(pointInPolygon([0.5, 0.5], openSquare)).toBe(true)
  })

  it('handles an open ring — outside', () => {
    expect(pointInPolygon([1.5, 0.5], openSquare)).toBe(false)
  })

  it('returns false for a point at the same y as a horizontal edge but clearly outside x range', () => {
    // y=1 is the top edge of the square; point at x=2 is clearly outside
    expect(pointInPolygon([2, 1], closedSquare)).toBe(false)
  })
})

// ── isInHopRegion — helper geometries ────────────────────────────────────────

/** Builds a tiny Polygon that has the given [lng,lat] as its centroid. */
function tinyPolygonAt(lng: number, lat: number) {
  const d = 0.01 // ~1 km half-size — small enough to stay in any single region
  return {
    type: 'Polygon' as const,
    coordinates: [
      [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
      ],
    ],
  }
}

// ── isInHopRegion ─────────────────────────────────────────────────────────────

describe('isInHopRegion', () => {
  // ── Hallertau ──────────────────────────────────────────────────────────────

  it('Au i.d.Hallertau (lng=11.78, lat=48.43) → Hallertau', () => {
    const result = isInHopRegion(tinyPolygonAt(11.78, 48.43))
    expect(result).toEqual({ inRegion: true, region: 'Hallertau' })
  })

  // ── Berlin — outside all regions ──────────────────────────────────────────

  it('Berlin (lng=13.40, lat=52.52) → inRegion:false', () => {
    const result = isInHopRegion(tinyPolygonAt(13.40, 52.52))
    expect(result).toEqual({ inRegion: false })
  })

  // ── Feature wrapper ───────────────────────────────────────────────────────

  it('accepts a GeoJSON Feature wrapping a Hallertau Polygon', () => {
    const feature = {
      type: 'Feature' as const,
      geometry: tinyPolygonAt(11.78, 48.43),
      properties: { name: 'Testfläche' },
    }
    const result = isInHopRegion(feature)
    expect(result).toEqual({ inRegion: true, region: 'Hallertau' })
  })

  // ── Other hop regions ─────────────────────────────────────────────────────

  it('Spalt (lng=10.93, lat=49.17) → Spalt', () => {
    const result = isInHopRegion(tinyPolygonAt(10.93, 49.17))
    expect(result).toEqual({ inRegion: true, region: 'Spalt' })
  })

  it('Tettnang (lng=9.59, lat=47.67) → Tettnang', () => {
    const result = isInHopRegion(tinyPolygonAt(9.59, 47.67))
    expect(result).toEqual({ inRegion: true, region: 'Tettnang' })
  })

  it('Elbe-Saale (lng=12.10, lat=51.50) → Elbe-Saale', () => {
    const result = isInHopRegion(tinyPolygonAt(12.10, 51.50))
    expect(result).toEqual({ inRegion: true, region: 'Elbe-Saale' })
  })

  // ── MultiPolygon input ────────────────────────────────────────────────────

  it('accepts a MultiPolygon whose first polygon is in Hallertau', () => {
    const d = 0.01
    const lng = 11.78
    const lat = 48.43
    const multiPolygon = {
      type: 'MultiPolygon' as const,
      coordinates: [
        [
          [
            [lng - d, lat - d],
            [lng + d, lat - d],
            [lng + d, lat + d],
            [lng - d, lat + d],
            [lng - d, lat - d],
          ],
        ],
      ],
    }
    const result = isInHopRegion(multiPolygon)
    expect(result).toEqual({ inRegion: true, region: 'Hallertau' })
  })
})
