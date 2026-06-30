/**
 * fieldMap.ts — Feld-Karte zeichnen/tippen + optionaler Shapefile-Import.
 *
 * Öffentliche API:
 *  - importShapefile(file)        ZIP → GeoJSON FeatureCollection (wirft bei Fehler)
 *  - createFieldMap(el, {onChange}) MapLibre-Karte mit Polygon-Zeichenwerkzeug
 *
 * Design: Die Draw-Zustandslogik liegt in reinen Funktionen (gut testbar unter
 * Node/jsdom); die MapLibre-Verdrahtung ist dünn und nur im Browser nötig.
 */

import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { importShapeZip } from './importShape'

// ---------------------------------------------------------------------------
// importShapefile — dünne Hülle um importShapeZip
// ---------------------------------------------------------------------------

/**
 * Liest eine iBALIS-/Schlagkartei-Shape-ZIP-Datei aus dem Browser (File-Objekt)
 * und gibt eine GeoJSON-FeatureCollection mit allen Polygon-Features zurück.
 * Reprojiziert automatisch via .prj (shpjs + proj4).
 * Wirft bei fehlerhafter/leerer Datei, sodass der Wizard auf Zeichnen zurückfallen kann.
 */
export async function importShapefile(file: File): Promise<FeatureCollection<Polygon | MultiPolygon>> {
  const buffer = await file.arrayBuffer()
  const features = await importShapeZip(buffer)
  if (features.length === 0) {
    throw new Error('Keine Feldgeometrien im Import gefunden')
  }
  return { type: 'FeatureCollection', features }
}

// ---------------------------------------------------------------------------
// Draw-Zustand — reine Funktionen (kein DOM, kein MapLibre, gut testbar)
// ---------------------------------------------------------------------------

export interface DrawState {
  /** Stützpunkte des aktuell gezeichneten Rings (noch nicht geschlossen). */
  draft: [number, number][]
  /** Fertige Polygon- und MultiPolygon-Features. */
  features: Feature<Polygon | MultiPolygon>[]
}

/** Leerer Anfangszustand. */
export function emptyDrawState(): DrawState {
  return { draft: [], features: [] }
}

let _idCounter = 0
function makeDrawId(): string {
  _idCounter += 1
  return `draw-${_idCounter}`
}

/**
 * Fügt einen Stützpunkt zum aktuellen Ring hinzu.
 * Doppelklick-Endigung erfolgt über finishPolygon() — hier nur der Klick.
 */
export function addVertex(state: DrawState, lon: number, lat: number): DrawState {
  return { ...state, draft: [...state.draft, [lon, lat]] }
}

/**
 * Schließt den aktuellen Ring und erzeugt ein neues Feature, falls ≥ 3 Punkte
 * vorhanden sind. Sonst: kein neues Feature, Draft wird verworfen.
 */
export function finishPolygon(state: DrawState): DrawState {
  if (state.draft.length < 3) {
    return { ...state, draft: [] }
  }
  const ring: [number, number][] = [...state.draft, state.draft[0]] // schließen
  const feature: Feature<Polygon> = {
    type: 'Feature',
    properties: { id: makeDrawId() },
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
  return { draft: [], features: [...state.features, feature] }
}

/** Bricht den aktuellen Ring ab (z. B. Escape-Taste). */
export function cancelDraft(state: DrawState): DrawState {
  return { ...state, draft: [] }
}

/** Entfernt ein fertiges Feature nach ID. */
export function removePolygon(state: DrawState, id: string): DrawState {
  return {
    ...state,
    features: state.features.filter((f) => f.properties?.id !== id),
  }
}

// ---------------------------------------------------------------------------
// createFieldMap — MapLibre-Verdrahtung (Browser-only; dünn gehalten)
// ---------------------------------------------------------------------------

// Dynamischer Import von MapLibre vermeidet SSR-/Test-Probleme.
export interface FieldMapHandle {
  /** Setzt die angezeigten Features programmatisch (z. B. nach Shapefile-Import). */
  setFeatures(features: Feature[]): void
  /** Beendet den aktuellen Draft programmatisch (z. B. über UI-Button). */
  finishCurrent(): void
  /** Bricht den aktuellen Draft ab. */
  cancelCurrent(): void
  /** Gibt Ressourcen frei (MapLibre-Map + Event-Listener). */
  destroy(): void
}

export interface FieldMapOptions {
  onChange: (features: Feature[]) => void
}

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

/**
 * Erstellt eine MapLibre-Karte im `container`-Element mit eingebautem Polygon-Zeichenmodus:
 * - Klick: Stützpunkt hinzufügen
 * - Doppelklick: Polygon abschließen
 * - `onChange` wird bei jeder Änderung der fertigen Features aufgerufen
 */
export async function createFieldMap(
  container: HTMLElement,
  opts: FieldMapOptions,
): Promise<FieldMapHandle> {
  // Dynamischer Import — damit Node-Tests dieses Modul importieren können ohne
  // echtes DOM/WebGL (die Tests testen nur die reinen State-Funktionen).
  const maplibre = await import('maplibre-gl')
  const Map = maplibre.default?.Map ?? (maplibre as unknown as { Map: typeof import('maplibre-gl').Map }).Map

  let state = emptyDrawState()
  const COMPLETED_SRC = 'fm-completed'
  const DRAFT_SRC = 'fm-draft'

  const map = new Map({
    container,
    style: STYLE_URL,
    center: [11.7847, 48.4283],
    zoom: 13,
    doubleClickZoom: false, // wir handhaben Doppelklick selbst
    attributionControl: { compact: true },
  })

  const ro = new ResizeObserver(() => map.resize())
  ro.observe(container)

  await new Promise<void>((resolve) => map.on('load', resolve))

  // --- Quellen & Ebenen einrichten ---
  map.addSource(COMPLETED_SRC, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addSource(DRAFT_SRC, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })

  map.addLayer({
    id: 'fm-completed-fill',
    type: 'fill',
    source: COMPLETED_SRC,
    paint: { 'fill-color': '#2f6b4a', 'fill-opacity': 0.22 },
  })
  map.addLayer({
    id: 'fm-completed-line',
    type: 'line',
    source: COMPLETED_SRC,
    paint: { 'line-color': '#2f6b4a', 'line-width': 2 },
  })
  map.addLayer({
    id: 'fm-draft-line',
    type: 'line',
    source: DRAFT_SRC,
    paint: { 'line-color': '#c8902a', 'line-width': 2, 'line-dasharray': [3, 2] },
  })
  map.addLayer({
    id: 'fm-draft-points',
    type: 'circle',
    source: DRAFT_SRC,
    paint: { 'circle-radius': 5, 'circle-color': '#c8902a', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
  })

  map.getCanvas().style.cursor = 'crosshair'

  // --- Hilfsfunktionen ---
  function render() {
    // Fertige Polygone
    const completedSrc = map.getSource(COMPLETED_SRC) as import('maplibre-gl').GeoJSONSource
    completedSrc.setData({ type: 'FeatureCollection', features: state.features })

    // Draft-Ring als LineString + Punkte
    const draftFeatures: Feature[] = []
    if (state.draft.length > 0) {
      const coords = [...state.draft]
      if (coords.length >= 2) {
        draftFeatures.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        })
      }
      for (const [lon, lat] of coords) {
        draftFeatures.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [lon, lat] },
        })
      }
    }
    const draftSrc = map.getSource(DRAFT_SRC) as import('maplibre-gl').GeoJSONSource
    draftSrc.setData({ type: 'FeatureCollection', features: draftFeatures })
  }

  function emitChange() {
    opts.onChange([...state.features])
  }

  // --- Klick: Stützpunkt hinzufügen ---
  const handleClick = (e: import('maplibre-gl').MapMouseEvent) => {
    // dblclick fires click twice — debounce with timestamp
    state = addVertex(state, e.lngLat.lng, e.lngLat.lat)
    render()
  }

  // --- Doppelklick: Polygon abschließen ---
  const handleDblClick = (e: import('maplibre-gl').MapMouseEvent) => {
    e.preventDefault?.()
    // Letzten durch dblclick hinzugefügten Vertex entfernen (click+dblclick feuern beide)
    // Wenn ≥ 4 Punkte vorhanden (3 echte + 1 doppelter), letzten abschneiden
    if (state.draft.length > 3) {
      state = { ...state, draft: state.draft.slice(0, -1) }
    }
    state = finishPolygon(state)
    render()
    emitChange()
  }

  map.on('click', handleClick)
  map.on('dblclick', handleDblClick)

  return {
    setFeatures(features: Feature[]) {
      const polys = features.filter(
        (f): f is Feature<Polygon | MultiPolygon> =>
          f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon',
      )
      state = { draft: [], features: polys }
      render()
      emitChange()
    },
    finishCurrent() {
      state = finishPolygon(state)
      render()
      emitChange()
    },
    cancelCurrent() {
      state = cancelDraft(state)
      render()
    },
    destroy() {
      map.off('click', handleClick)
      map.off('dblclick', handleDblClick)
      ro.disconnect()
      map.remove()
    },
  }
}
