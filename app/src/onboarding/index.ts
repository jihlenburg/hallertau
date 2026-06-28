import { icons } from '../ui/icons'
import { importShapeZip } from './importShape'
import { importGeojsonText } from './importGeojson'
import demoGeojson from '../../data/demo-fields.geojson?raw'
import { normalizeField } from '../domain/fields'
import { setFields } from '../state'
import { FieldMap } from '../map'
import { SOIL_TYPES, DEFAULT_SOIL, type SoilType } from '../domain/soil'
import type { FieldFeature } from '../types'

const SORTEN = ['Herkules', 'Perle', 'Hallertauer Tradition', 'Saphir', 'Hallertauer Mittelfrüh', 'Spalter Select', 'unbekannt']
const titleCase = (s: string) => s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export function mountOnboarding(root: HTMLElement, onDone: () => void): void {
  let draft: FieldFeature[] = []
  let previewMap: FieldMap | null = null

  function renderChoose(message?: { kind: 'err' | 'ok'; text: string }) {
    previewMap?.destroy()
    previewMap = null
    root.innerHTML = `
      <div class="onb">
        <h1>Ihre Schläge anlegen</h1>
        <p class="lead">Am einfachsten: die Flächen importieren, die Sie für den Mehrfachantrag ohnehin schon pflegen.</p>
        <div class="onb-grid">
          <div class="methods">
            <button class="mcard active" data-m="upload">
              <span class="mchip">${icons.upload()}</span>
              <span class="badge">EMPFOHLEN</span>
              <span class="mt">iBALIS-Export hochladen</span>
              <span class="md">Ihre Feldstücke aus dem Mehrfachantrag als Shape-ZIP (UTM32). Exakt, aktuell, Ihre eigenen Daten.</span>
            </button>
            <button class="mcard" data-m="upload">
              <span class="mchip">${icons.file()}</span>
              <span class="mt">Aus Schlagkartei / GeoJSON</span>
              <span class="md">Shape-ZIP aus 365FarmNet, NEXT, FARMDOK … oder eine GeoJSON-Datei (WGS84).</span>
            </button>
            <button class="mcard" data-m="soon" disabled>
              <span class="mchip">${icons.file('#9aa9a0')}</span>
              <span class="mt">Auf der Karte antippen</span>
              <span class="md">Offene InVeKoS-Feldstücke über DOP40 wählen — <em>kommt noch</em>.</span>
            </button>
            <button class="mcard" data-m="soon" disabled>
              <span class="mchip">${icons.pencil('#9aa9a0')}</span>
              <span class="mt">Manuell zeichnen / GPS</span>
              <span class="md">Neuanlagen selbst einzeichnen — <em>kommt noch</em>.</span>
            </button>
          </div>

          <div class="guide">
            <h2>So exportieren Sie aus iBALIS</h2>
            <p class="gsub">Einmalig – dauert rund zwei Minuten. UTM32 wird automatisch erkannt.</p>
            ${step(1, 'Anmelden', 'Bei iBALIS einloggen (Betriebsnummer + PIN) · <code class="k">stmelf.bayern.de/ibalis</code>')}
            ${step(2, 'Menü öffnen', '<code class="k">Betriebsinformationen</code> → <code class="k">Datenexport</code>')}
            ${step(3, 'Export wählen', '<code class="k">Eigene Flächendaten exportieren</code> → alle Feldstücke')}
            ${step(4, 'ZIP herunterladen', '<code class="k">Ergebnisse</code> → <code class="k">ZIP</code> · diese Datei hier ablegen')}

            <div class="drop" id="drop">
              <span>${icons.upload()}</span>
              <div>
                <div class="dt">Shape-ZIP oder GeoJSON hier ablegen</div>
                <div class="dd">.zip mit .shp/.dbf/.prj · oder .geojson / .json (WGS84)</div>
              </div>
              <div class="spacer"></div>
              <button class="btn-sec" id="pick">Datei auswählen</button>
              <input type="file" id="file" accept=".zip,.geojson,.json" hidden />
            </div>
            ${message ? `<div class="msg ${message.kind}">${message.text}</div>` : ''}
            <div class="rowbtns">
              <button class="btn-ghost" id="demo">Demo-Betrieb laden</button>
              <div class="spacer"></div>
            </div>
          </div>
        </div>
      </div>`

    const fileInput = root.querySelector<HTMLInputElement>('#file')!
    const drop = root.querySelector<HTMLDivElement>('#drop')!
    root.querySelector('#pick')!.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', () => {
      if (fileInput.files?.[0]) handleFile(fileInput.files[0])
    })
    root.querySelectorAll<HTMLButtonElement>('.mcard[data-m="upload"]').forEach((b) =>
      b.addEventListener('click', () => fileInput.click()),
    )
    drop.addEventListener('dragover', (e) => {
      e.preventDefault()
      drop.classList.add('over')
    })
    drop.addEventListener('dragleave', () => drop.classList.remove('over'))
    drop.addEventListener('drop', (e) => {
      e.preventDefault()
      drop.classList.remove('over')
      const f = e.dataTransfer?.files?.[0]
      if (f) handleFile(f)
    })
    root.querySelector('#demo')!.addEventListener('click', loadDemo)
  }

  async function handleFile(file: File) {
    try {
      let raw: ReturnType<typeof normalizeField>[] = []
      const name = file.name.toLowerCase()
      if (name.endsWith('.zip')) {
        const feats = await importShapeZip(await file.arrayBuffer())
        raw = feats.map((f, i) => normalizeField(f, i))
      } else if (name.endsWith('.geojson') || name.endsWith('.json')) {
        const feats = importGeojsonText(await file.text())
        raw = feats.map((f, i) => normalizeField(f, i))
      } else {
        throw new Error('Bitte eine .zip (Shape) oder .geojson/.json Datei wählen.')
      }
      draft = raw
      renderReview()
    } catch (err) {
      renderChoose({ kind: 'err', text: `Import fehlgeschlagen: ${(err as Error).message}` })
    }
  }

  function loadDemo() {
    try {
      const feats = importGeojsonText(demoGeojson)
      draft = feats.map((f, i) => normalizeField(f, i))
      renderReview()
    } catch (err) {
      renderChoose({ kind: 'err', text: `Demo konnte nicht geladen werden: ${(err as Error).message}` })
    }
  }

  function renderReview() {
    const totalReported = draft.reduce((s, f) => s + (f.properties.flaeche_ha || 0), 0)
    root.innerHTML = `
      <div class="onb">
        <h1>Erkannte Schläge prüfen</h1>
        <p class="lead">${draft.length} Schläge · ${totalReported.toFixed(1)} ha gemeldet. Namen, Sorte, Boden und Fläche bei Bedarf anpassen. Der Boden bestimmt die Wasserbilanz je Schlag.</p>
        <div class="review">
          <h2>Schläge</h2>
          <table>
            <thead><tr><th>Name</th><th>Sorte</th><th>Boden</th><th>Fläche (ha, gemeldet)</th><th>aus Geometrie</th></tr></thead>
            <tbody>
              ${draft
                .map(
                  (f, i) => `<tr>
                    <td><input data-i="${i}" data-k="name" value="${esc(f.properties.name)}" /></td>
                    <td><select data-i="${i}" data-k="sorte">${(SORTEN.includes(f.properties.sorte)
                      ? SORTEN
                      : [f.properties.sorte, ...SORTEN]
                    )
                      .map((s) => `<option ${s === f.properties.sorte ? 'selected' : ''}>${esc(s)}</option>`)
                      .join('')}</select></td>
                    <td><select data-i="${i}" data-k="soilType" aria-label="Bodenart">${SOIL_TYPES.map(
                      (t) => `<option value="${t}" ${t === (f.properties.soilType ?? DEFAULT_SOIL) ? 'selected' : ''}>${titleCase(t)}</option>`,
                    ).join('')}</select></td>
                    <td><input data-i="${i}" data-k="flaeche_ha" type="number" step="0.1" value="${f.properties.flaeche_ha}" /></td>
                    <td>${f.properties.flaeche_calc_ha ?? '—'} ha</td>
                  </tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <div class="onb-map" id="prevmap"></div>
          <div class="hintline">${infoIcon()} Tipp: für die spätere Satelliten-Auswertung auf die Gerüstfläche zuschneiden (Vorgewende &amp; Wege ausnehmen) – kommt in einem späteren Schritt.</div>
          <div class="rowbtns">
            <button class="btn-ghost" id="back">‹ Zurück</button>
            <div class="spacer"></div>
            <button class="btn" id="commit">${draft.length} Schläge übernehmen ›</button>
          </div>
        </div>
      </div>`

    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-i]').forEach((el) => {
      el.addEventListener('input', () => {
        const i = Number(el.dataset.i)
        const k = el.dataset.k as 'name' | 'sorte' | 'flaeche_ha' | 'soilType'
        if (k === 'flaeche_ha') draft[i].properties.flaeche_ha = parseFloat(el.value) || 0
        else if (k === 'soilType') draft[i].properties.soilType = el.value as SoilType
        else draft[i].properties[k] = el.value
      })
    })
    root.querySelector('#back')!.addEventListener('click', () => renderChoose())
    root.querySelector('#commit')!.addEventListener('click', () => {
      // Boden explizit setzen (Default Lehm), damit jeder Schlag die Wasserbilanz-Query trägt.
      draft.forEach((f) => {
        if (!f.properties.soilType) f.properties.soilType = DEFAULT_SOIL
      })
      setFields(draft)
      onDone()
    })

    previewMap = new FieldMap({ container: 'prevmap', withDop: true })
    previewMap.setData({ type: 'FeatureCollection', features: draft }, draft[0]?.properties.id ?? null)
  }

  renderChoose()
}

const step = (n: number, title: string, dd: string) =>
  `<div class="step"><div class="snum">${n}</div><div><div class="stt">${title}</div><div class="sdd">${dd}</div></div></div>`

const infoIcon = () =>
  `<svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true" style="flex:none"><circle cx="8.5" cy="8.5" r="7.5" fill="none" stroke="#d9962a" stroke-width="1.6"/><path d="M8.5 7.5v4M8.5 4.8v.2" stroke="#d9962a" stroke-width="1.8" stroke-linecap="round"/></svg>`

const esc = (s: string) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;')
