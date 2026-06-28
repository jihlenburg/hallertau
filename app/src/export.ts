import type { FieldFeature } from './types'

/** Serialisiert die Schläge als GeoJSON-FeatureCollection (Backup ohne Backend). */
export function fieldsToGeoJson(fields: FieldFeature[]): string {
  return JSON.stringify({ type: 'FeatureCollection', features: fields }, null, 2)
}

/** Löst einen Datei-Download im Browser aus (kein Server nötig). */
export function downloadText(filename: string, text: string, mime = 'application/geo+json'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
