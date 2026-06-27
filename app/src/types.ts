import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'

/** Eigenschaften eines Schlags, wie sie die App intern führt. */
export interface FieldProps {
  id: string
  name: string
  sorte: string
  /** Gemeldete Fläche (z. B. aus iBALIS/Mehrfachantrag), ha. */
  flaeche_ha: number
  /** Aus der Geometrie berechnete Fläche (turf), ha — zur Kontrolle. */
  flaeche_calc_ha?: number
}

export type FieldGeometry = Polygon | MultiPolygon
export type FieldFeature = Feature<FieldGeometry, FieldProps>
export type FieldCollection = FeatureCollection<FieldGeometry, FieldProps>

export type Status = 'good' | 'warn' | 'alert' | 'info'
