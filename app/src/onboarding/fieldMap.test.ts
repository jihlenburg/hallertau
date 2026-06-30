/**
 * fieldMap.test.ts — TDD für importShapefile + Draw-Zustandslogik
 *
 * importShapefile: integrationstest mit echtem fixture-ZIP (WGS84-Polygon in Bayern)
 * Draw-Zustand: reine Einheitentests, kein MapLibre/DOM nötig
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Feature, MultiPolygon } from 'geojson'

import { importShapefile, createFieldMap } from './fieldMap'
import {
  emptyDrawState,
  addVertex,
  finishPolygon,
  cancelDraft,
  removePolygon,
} from './fieldMap'
import { importShapeZip } from './importShape'

// ---------------------------------------------------------------------------
// Modul-Mocks (hoisted)
// ---------------------------------------------------------------------------

// importShapeZip als Spy einwickeln → ermöglicht mockResolvedValueOnce([]) im Empty-Test
vi.mock('./importShape', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./importShape')>()
  return {
    ...actual,
    importShapeZip: vi.fn().mockImplementation(actual.importShapeZip),
  }
})

// MapLibre-Mock für createFieldMap-Tests (kein echtes Browser/WebGL nötig)
vi.mock('maplibre-gl', () => {
  const mockSource = { setData: vi.fn() }
  class MockMap {
    on(event: string, handler: (...args: unknown[]) => void) {
      // load-Event sofort auslösen → await new Promise(...) kann auflösen
      if (event === 'load') handler()
    }
    off() {}
    getCanvas() { return { style: {} as CSSStyleDeclaration } }
    addSource() {}
    addLayer() {}
    getSource() { return mockSource }
    resize() {}
    remove() {}
  }
  return {
    default: { Map: MockMap },
    Map: MockMap,
  }
})

// ResizeObserver-Polyfill für Node-Testumgebung
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    ;(globalThis as unknown as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      disconnect() {}
    }
  }
})

// ---------------------------------------------------------------------------
// Helpers für Fixture-ZIP
// ---------------------------------------------------------------------------

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/** Lädt die base64-kodierte Fixture-ZIP und gibt einen dedizierten ArrayBuffer zurück. */
function loadFixtureArrayBuffer(): ArrayBuffer {
  const b64 = readFileSync(
    resolve(__dirname, '__fixtures__/bavaria-poly-b64.txt'),
    'utf8',
  ).trim()
  const raw = Buffer.from(b64, 'base64')
  // Node.js Buffers teilen einen Pool-ArrayBuffer → Slice erzeugt dedizierten AB
  return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)
}

/** Erstellt ein File-Objekt aus dem fixture-ArrayBuffer. */
function fixtureFile(name = 'bavaria-test.zip'): File {
  const ab = loadFixtureArrayBuffer()
  return new File([ab], name, { type: 'application/zip' })
}

/** Erstellt ein File-Objekt mit zufälligen Binärdaten (kein gültiges ZIP). */
function malformedFile(name = 'bad.zip'): File {
  const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe])
  return new File([garbage], name, { type: 'application/zip' })
}

// ---------------------------------------------------------------------------
// importShapefile
// ---------------------------------------------------------------------------

describe('importShapefile', () => {
  it('verarbeitet eine gültige WGS84-Shape-ZIP und gibt FeatureCollection zurück', async () => {
    const fc = await importShapefile(fixtureFile())
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features.length).toBeGreaterThanOrEqual(1)
    const first = fc.features[0]
    expect(first.geometry.type).toMatch(/Polygon|MultiPolygon/)
  })

  it('polygon-Koordinaten liegen in Bayern (WGS84)', async () => {
    const fc = await importShapefile(fixtureFile())
    const first = fc.features[0]
    const ring = (first.geometry as GeoJSON.Polygon).coordinates[0]
    const [lon] = ring[0]
    expect(lon).toBeGreaterThan(8)
    expect(lon).toBeLessThan(14)
  })

  it('wirft bei fehlerhafter ZIP-Datei', async () => {
    await expect(importShapefile(malformedFile())).rejects.toThrow()
  })

  it('wirft wenn keine Feldgeometrien gefunden (leere FeatureCollection)', async () => {
    // importShapeZip wird gemocked, damit er ein leeres Array liefert (kein Polygon/MultiPolygon)
    vi.mocked(importShapeZip).mockResolvedValueOnce([])
    const file = new File(['dummy'], 'empty.zip', { type: 'application/zip' })
    await expect(importShapefile(file)).rejects.toThrow('Keine Feldgeometrien im Import gefunden')
  })
})

// ---------------------------------------------------------------------------
// createFieldMap — setFeatures mit MultiPolygon
// ---------------------------------------------------------------------------

describe('createFieldMap › setFeatures', () => {
  it('MultiPolygon-Feature wird nicht verworfen (kein Polygon-Filter-Bug)', async () => {
    const emitted: Feature[] = []
    const container = {} as HTMLElement // MapLibre-Mock braucht kein echtes DOM-Element

    const handle = await createFieldMap(container, {
      onChange: (fs) => {
        emitted.length = 0
        emitted.push(...fs)
      },
    })

    const multiPoly: Feature<MultiPolygon> = {
      type: 'Feature',
      properties: { id: 'mp-test' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[11.77, 48.42], [11.78, 48.42], [11.78, 48.43], [11.77, 48.42]]],
        ],
      },
    }

    handle.setFeatures([multiPoly])

    expect(emitted).toHaveLength(1)
    expect(emitted[0].geometry.type).toBe('MultiPolygon')
    expect((emitted[0] as Feature<MultiPolygon>).properties?.id).toBe('mp-test')

    handle.destroy()
  })
})

// ---------------------------------------------------------------------------
// Draw-Zustandslogik — reine Funktionen
// ---------------------------------------------------------------------------

describe('emptyDrawState', () => {
  it('gibt leeres Draft und leere Features zurück', () => {
    const s = emptyDrawState()
    expect(s.draft).toEqual([])
    expect(s.features).toEqual([])
  })
})

describe('addVertex', () => {
  it('fügt Koordinate zum Draft hinzu', () => {
    let s = emptyDrawState()
    s = addVertex(s, 11.77, 48.42)
    expect(s.draft).toHaveLength(1)
    expect(s.draft[0]).toEqual([11.77, 48.42])
  })

  it('akkumuliert mehrere Stützpunkte', () => {
    let s = emptyDrawState()
    s = addVertex(s, 11.77, 48.42)
    s = addVertex(s, 11.78, 48.42)
    s = addVertex(s, 11.78, 48.43)
    expect(s.draft).toHaveLength(3)
  })

  it('verändert existierende Features nicht', () => {
    let s = emptyDrawState()
    s = addVertex(s, 11.77, 48.42)
    s = addVertex(s, 11.78, 48.42)
    s = addVertex(s, 11.78, 48.43)
    s = finishPolygon(s)
    const featuresBefore = s.features.length
    s = addVertex(s, 11.00, 48.00)
    expect(s.features).toHaveLength(featuresBefore) // Features unverändert
    expect(s.draft).toHaveLength(1)
  })
})

describe('finishPolygon', () => {
  it('erstellt ein Feature wenn ≥ 3 Stützpunkte vorhanden', () => {
    let s = emptyDrawState()
    s = addVertex(s, 11.77, 48.42)
    s = addVertex(s, 11.78, 48.42)
    s = addVertex(s, 11.78, 48.43)
    s = finishPolygon(s)
    expect(s.features).toHaveLength(1)
    expect(s.features[0].geometry.type).toBe('Polygon')
    expect(s.draft).toEqual([]) // Draft geleert
  })

  it('schließt den Ring automatisch (letzter Punkt = erster)', () => {
    let s = emptyDrawState()
    s = addVertex(s, 11.77, 48.42)
    s = addVertex(s, 11.78, 48.42)
    s = addVertex(s, 11.78, 48.43)
    s = finishPolygon(s)
    const ring = s.features[0].geometry.coordinates[0]
    expect(ring[0]).toEqual(ring[ring.length - 1]) // geschlossener Ring
  })

  it('legt eine eindeutige ID als Feature-Property an', () => {
    let s = emptyDrawState()
    s = addVertex(s, 11.77, 48.42)
    s = addVertex(s, 11.78, 48.42)
    s = addVertex(s, 11.78, 48.43)
    s = finishPolygon(s)
    const id1 = s.features[0].properties?.id as string
    // zweites Polygon
    s = addVertex(s, 11.60, 48.30)
    s = addVertex(s, 11.61, 48.30)
    s = addVertex(s, 11.61, 48.31)
    s = finishPolygon(s)
    const id2 = s.features[1].properties?.id as string
    expect(id1).toBeTruthy()
    expect(id2).toBeTruthy()
    expect(id1).not.toBe(id2)
  })

  it('löscht den Draft und erzeugt kein Feature bei < 3 Punkten', () => {
    let s = emptyDrawState()
    s = addVertex(s, 11.77, 48.42)
    s = addVertex(s, 11.78, 48.42)
    s = finishPolygon(s) // nur 2 Punkte
    expect(s.features).toHaveLength(0)
    expect(s.draft).toEqual([])
  })

  it('akkumuliert mehrere fertige Features', () => {
    let s = emptyDrawState()
    // Polygon 1
    s = addVertex(s, 11.77, 48.42)
    s = addVertex(s, 11.78, 48.42)
    s = addVertex(s, 11.78, 48.43)
    s = finishPolygon(s)
    // Polygon 2
    s = addVertex(s, 11.60, 48.30)
    s = addVertex(s, 11.61, 48.30)
    s = addVertex(s, 11.61, 48.31)
    s = finishPolygon(s)
    expect(s.features).toHaveLength(2)
  })
})

describe('cancelDraft', () => {
  it('löscht den Draft ohne Features zu ändern', () => {
    let s = emptyDrawState()
    s = addVertex(s, 11.77, 48.42)
    s = addVertex(s, 11.78, 48.42)
    s = cancelDraft(s)
    expect(s.draft).toEqual([])
    expect(s.features).toEqual([])
  })
})

describe('removePolygon', () => {
  it('entfernt ein Feature nach ID', () => {
    let s = emptyDrawState()
    s = addVertex(s, 11.77, 48.42)
    s = addVertex(s, 11.78, 48.42)
    s = addVertex(s, 11.78, 48.43)
    s = finishPolygon(s)
    const id = s.features[0].properties!.id as string
    s = removePolygon(s, id)
    expect(s.features).toHaveLength(0)
  })

  it('lässt andere Features unverändert', () => {
    let s = emptyDrawState()
    // zwei Polygone anlegen
    s = addVertex(s, 11.77, 48.42)
    s = addVertex(s, 11.78, 48.42)
    s = addVertex(s, 11.78, 48.43)
    s = finishPolygon(s)
    const id1 = s.features[0].properties!.id as string
    s = addVertex(s, 11.60, 48.30)
    s = addVertex(s, 11.61, 48.30)
    s = addVertex(s, 11.61, 48.31)
    s = finishPolygon(s)
    // Erstes entfernen
    s = removePolygon(s, id1)
    expect(s.features).toHaveLength(1)
    expect(s.features[0].properties?.id).not.toBe(id1)
  })

  it('ignoriert unbekannte IDs', () => {
    let s = emptyDrawState()
    s = addVertex(s, 11.77, 48.42)
    s = addVertex(s, 11.78, 48.42)
    s = addVertex(s, 11.78, 48.43)
    s = finishPolygon(s)
    s = removePolygon(s, 'nonexistent-id')
    expect(s.features).toHaveLength(1)
  })
})
