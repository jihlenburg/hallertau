import { describe, it, expect } from 'vitest'
import { fieldsToGeoJson } from './export'
import type { FieldFeature } from './types'

const field = (id: string, name: string): FieldFeature => ({
  type: 'Feature',
  properties: { id, name, sorte: 'Herkules', flaeche_ha: 3.2, soilType: 'lehm' },
  geometry: { type: 'Polygon', coordinates: [[[11.7, 48.4], [11.71, 48.4], [11.71, 48.41], [11.7, 48.4]]] },
})

describe('fieldsToGeoJson', () => {
  it('erzeugt eine gültige FeatureCollection mit allen Schlägen', () => {
    const json = fieldsToGeoJson([field('a', 'Attenhofen West'), field('b', 'Mitterfeld')])
    const parsed = JSON.parse(json)
    expect(parsed.type).toBe('FeatureCollection')
    expect(parsed.features).toHaveLength(2)
    expect(parsed.features[0].properties.name).toBe('Attenhofen West')
    expect(parsed.features[0].properties.soilType).toBe('lehm')
    expect(parsed.features[0].geometry.type).toBe('Polygon')
  })
  it('leere Liste → leere FeatureCollection', () => {
    const parsed = JSON.parse(fieldsToGeoJson([]))
    expect(parsed.type).toBe('FeatureCollection')
    expect(parsed.features).toEqual([])
  })
})
