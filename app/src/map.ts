import maplibregl from 'maplibre-gl'
import type { FieldCollection } from './types'

// OpenFreeMap: keyless gehostete Vektortiles (OpenMapTiles-Schema).
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

// Bayern DOP40 — offenes Luftbild-WMS (Open Data, © Bayerische Vermessungsverwaltung).
const DOP_WMS =
  'https://geoservices.bayern.de/od/wms/dop/v1/dop40?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap' +
  '&FORMAT=image/jpeg&TRANSPARENT=false&LAYERS=by_dop40c&STYLES=&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'

const SRC = 'fields'
const SRC_DOP = 'dop40'

export interface MapOptions {
  container: string | HTMLElement
  onSelect?: (id: string) => void
  withDop?: boolean
}

export class FieldMap {
  private map: maplibregl.Map
  private ready = false
  private pending: (() => void)[] = []
  private onSelect?: (id: string) => void

  constructor(opts: MapOptions) {
    this.onSelect = opts.onSelect
    this.map = new maplibregl.Map({
      container: opts.container,
      style: STYLE_URL,
      center: [11.7847, 48.4283],
      zoom: 13,
      attributionControl: { compact: false },
    })
    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    this.map.on('load', () => {
      this.addDopLayer(opts.withDop ?? false)
      this.addFieldLayers()
      this.ready = true
      this.pending.forEach((fn) => fn())
      this.pending = []
    })
  }

  private whenReady(fn: () => void) {
    if (this.ready) fn()
    else this.pending.push(fn)
  }

  private addDopLayer(visible: boolean) {
    this.map.addSource(SRC_DOP, {
      type: 'raster',
      tiles: [DOP_WMS],
      tileSize: 256,
      attribution: '© Bayerische Vermessungsverwaltung (DOP40)',
    })
    // unter die Beschriftungen legen, sofern eine Label-Ebene existiert
    const firstSymbol = this.map.getStyle().layers?.find((l) => l.type === 'symbol')?.id
    this.map.addLayer(
      {
        id: SRC_DOP,
        type: 'raster',
        source: SRC_DOP,
        layout: { visibility: visible ? 'visible' : 'none' },
        paint: { 'raster-opacity': 0.92 },
      },
      firstSymbol,
    )
  }

  private addFieldLayers() {
    this.map.addSource(SRC, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      promoteId: 'id',
    })
    this.map.addLayer({
      id: 'fields-fill',
      type: 'fill',
      source: SRC,
      paint: {
        'fill-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#d9962a', '#2f6b4a'],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.35, 0.18],
      },
    })
    this.map.addLayer({
      id: 'fields-line',
      type: 'line',
      source: SRC,
      paint: {
        'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#c8902a', '#2f6b4a'],
        'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 1.6],
      },
    })
    this.map.addLayer({
      id: 'fields-label',
      type: 'symbol',
      source: SRC,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 13,
        'text-offset': [0, 0.4],
      },
      paint: { 'text-color': '#234f37', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
    })

    this.map.on('click', 'fields-fill', (e) => {
      const f = e.features?.[0]
      const id = f?.properties?.id as string | undefined
      if (id && this.onSelect) this.onSelect(id)
    })
    this.map.on('mouseenter', 'fields-fill', () => (this.map.getCanvas().style.cursor = 'pointer'))
    this.map.on('mouseleave', 'fields-fill', () => (this.map.getCanvas().style.cursor = ''))
  }

  private currentSelected: string | null = null

  setData(fc: FieldCollection, selectedId: string | null, fit = true) {
    this.whenReady(() => {
      const src = this.map.getSource(SRC) as maplibregl.GeoJSONSource | undefined
      src?.setData(fc as never)
      this.setSelected(selectedId)
      if (fit && fc.features.length) this.fit(fc)
    })
  }

  setSelected(selectedId: string | null) {
    this.whenReady(() => {
      if (this.currentSelected) {
        this.map.setFeatureState({ source: SRC, id: this.currentSelected }, { selected: false })
      }
      if (selectedId) {
        this.map.setFeatureState({ source: SRC, id: selectedId }, { selected: true })
      }
      this.currentSelected = selectedId
    })
  }

  setDop(visible: boolean) {
    this.whenReady(() => {
      if (this.map.getLayer(SRC_DOP)) {
        this.map.setLayoutProperty(SRC_DOP, 'visibility', visible ? 'visible' : 'none')
      }
    })
  }

  private fit(fc: FieldCollection) {
    const b = new maplibregl.LngLatBounds()
    for (const f of fc.features) {
      walkCoords(f.geometry, (lon, lat) => b.extend([lon, lat]))
    }
    if (!b.isEmpty()) this.map.fitBounds(b, { padding: 60, maxZoom: 15.5, duration: 600 })
  }

  resize() {
    this.whenReady(() => this.map.resize())
  }

  destroy() {
    this.map.remove()
  }
}

function walkCoords(geom: GeoJSON.Geometry, cb: (lon: number, lat: number) => void) {
  if (geom.type === 'Polygon') geom.coordinates.flat().forEach(([lon, lat]) => cb(lon, lat))
  else if (geom.type === 'MultiPolygon') geom.coordinates.flat(2).forEach(([lon, lat]) => cb(lon, lat))
}
