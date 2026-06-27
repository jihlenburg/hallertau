import { describe, it, expect } from 'vitest'
import { isInBavaria, assertPlausibleBavaria } from './importShape'
import type { Feature, Polygon } from 'geojson'

const poly = (coords: number[][]): Feature<Polygon> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [coords] },
})

// WGS84-Rechteck in Au i.d.Hallertau
const bavaria = poly([
  [11.77, 48.42], [11.78, 48.42], [11.78, 48.43], [11.77, 48.43], [11.77, 48.42],
])
// NICHT reprojiziert: UTM32-Meter (Easting/Northing) — typischer Fehlerfall ohne .prj
const utm = poly([
  [690000, 5360000], [690100, 5360000], [690100, 5360100], [690000, 5360100], [690000, 5360000],
])

describe('isInBavaria', () => {
  it('akzeptiert einen WGS84-Punkt in Bayern', () => {
    expect(isInBavaria([11.78, 48.42])).toBe(true)
  })
  it('lehnt UTM-Meter-Koordinaten ab', () => {
    expect(isInBavaria([690000, 5360000])).toBe(false)
  })
})

describe('assertPlausibleBavaria', () => {
  it('lässt plausible WGS84-Geometrie durch', () => {
    expect(() => assertPlausibleBavaria([bavaria])).not.toThrow()
  })
  it('wirft einen klaren Fehler bei nicht reprojizierten Koordinaten', () => {
    expect(() => assertPlausibleBavaria([utm])).toThrow(/WGS84|umgerechnet|Projektion/)
  })
})
