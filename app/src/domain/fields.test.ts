import { describe, it, expect } from 'vitest'
import { normalizeField, areaHa, centroidLonLat, makeFieldId } from './fields'
import type { Feature, Polygon } from 'geojson'

const poly = (props: Record<string, unknown> = {}): Feature<Polygon> => ({
  type: 'Feature',
  properties: props,
  geometry: {
    type: 'Polygon',
    coordinates: [[[11.78, 48.42], [11.79, 48.42], [11.79, 48.43], [11.78, 48.43], [11.78, 48.42]]],
  },
})

describe('areaHa', () => {
  it('liefert eine positive Hektar-Zahl', () => {
    expect(areaHa(poly())).toBeGreaterThan(0)
  })
})

describe('centroidLonLat', () => {
  it('liegt innerhalb der Bounding-Box', () => {
    const [lon, lat] = centroidLonLat(poly())
    expect(lon).toBeGreaterThan(11.78)
    expect(lon).toBeLessThan(11.79)
    expect(lat).toBeGreaterThan(48.42)
    expect(lat).toBeLessThan(48.43)
  })
})

describe('makeFieldId', () => {
  it('slugifiziert den Namen und ist eindeutig', () => {
    const a = makeFieldId('Attenhofen West')
    const b = makeFieldId('Attenhofen West')
    expect(a).toMatch(/^attenhofen-west-\d+$/)
    expect(a).not.toBe(b)
  })
  it('leerer/sonderzeichen-Name → schlag-Fallback', () => {
    expect(makeFieldId('!!!')).toMatch(/^schlag-\d+$/)
  })
})

describe('normalizeField', () => {
  it('übernimmt Name/Sorte aus gängigen Attributnamen (iBALIS/Schlagkartei)', () => {
    const f = normalizeField(poly({ FELDSTUECK: 'Mitterfeld', KULTUR: 'Hopfen' }), 0)
    expect(f.properties.name).toBe('Mitterfeld')
    expect(f.properties.sorte).toBe('Hopfen')
  })
  it('Default-Name "Schlag N" + Sorte "unbekannt", wenn kein Attribut passt', () => {
    const f = normalizeField(poly({}), 4)
    expect(f.properties.name).toBe('Schlag 5')
    expect(f.properties.sorte).toBe('unbekannt')
  })
  it('liest die gemeldete Fläche aus deutschem Dezimal-String ("3,2")', () => {
    const f = normalizeField(poly({ name: 'X', flaeche_ha: '3,2' }), 0)
    expect(f.properties.flaeche_ha).toBeCloseTo(3.2, 5)
  })
  it('ohne gemeldete Fläche → berechnete Fläche; flaeche_calc_ha immer gesetzt', () => {
    const f = normalizeField(poly({ name: 'X' }), 0)
    expect(f.properties.flaeche_calc_ha).toBeGreaterThan(0)
    expect(f.properties.flaeche_ha).toBe(f.properties.flaeche_calc_ha)
  })
})
