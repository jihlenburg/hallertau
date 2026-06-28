import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import type { SoilType } from './domain/soil'

/** Eigenschaften eines Schlags, wie sie die App intern führt. */
export interface FieldProps {
  id: string
  name: string
  sorte: string
  /** Gemeldete Fläche (z. B. aus iBALIS/Mehrfachantrag), ha. */
  flaeche_ha: number
  /** Aus der Geometrie berechnete Fläche (turf), ha — zur Kontrolle. */
  flaeche_calc_ha?: number
  // ── Wasserbilanz v2 (FAO-56) ──
  /** Bodenart (Onboarding/Override); Default 'lehm'. */
  soilType?: SoilType
  /** Effektive Wurzeltiefe Zr (m); Default 1.0. */
  rootDepthM?: number
  /** Nutzbare Feldkapazität (mm/m); aus `soilType` abgeleitet oder Override. */
  nfkMmPerM?: number
  /** Persistente Wurzelraum-Verarmung Dr (mm). */
  drMm?: number
  /** ISO-Datum des persistierten Dr. */
  drAsOf?: string
}

export type FieldGeometry = Polygon | MultiPolygon
export type FieldFeature = Feature<FieldGeometry, FieldProps>
export type FieldCollection = FeatureCollection<FieldGeometry, FieldProps>

export type Status = 'good' | 'warn' | 'alert' | 'info'
