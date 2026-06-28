import { FieldMap } from '../map'
import { asCollection, getFields, getSelected, selectField, subscribe } from '../state'
import { centroidLonLat } from '../domain/fields'
import { gridCellKey } from '../domain/grid'
import { fetchOpenMeteo, type OpenMeteoData } from '../api/openMeteo'
import { fetchDwdAlerts, type DwdAlert } from '../api/brightSky'
import { fetchWaterBalance, type WaterBalanceResult, type WbQuery } from '../api/waterBalance'
import { assessWeather } from '../domain/weather'
import { evaluateSprayWindow } from '../domain/sprayWindow'
import { cardHtml, barsViz, soilBalanceLabel, soilWaterViz, roadmapStrip, countHints, forecastStrip, type CardSpec } from './cards'
import { fieldsToGeoJson, downloadText } from '../export'
import { icons } from '../ui/icons'
import type { FieldFeature, Status } from '../types'

export function mountOverview(root: HTMLElement): void {
  const fields = getFields()
  const total = fields.reduce((s, f) => s + (f.properties.flaeche_ha || 0), 0)

  root.innerHTML = `
    <div class="hello">Guten Abend, Familie Huber</div>
    <div class="subhead" id="subhead">${fields.length} Schläge · ${total.toFixed(1)} ha · abendlicher Feld-Check</div>
    <div class="summary" id="summary"><span class="d"></span>Daten werden geladen …</div>
    <div class="gridhint" id="gridhint"></div>
    <div class="layout">
      <div class="cards" id="cards"></div>
      <div class="panel">
        <div class="ptitle">
          <h2>Meine Schläge</h2>
          <div class="toggles"><button class="tg" id="tg-dop">Luftbild</button><button class="tg" id="tg-export" title="Schläge als GeoJSON sichern">Export</button></div>
        </div>
        <div id="map"></div>
        <div class="fc7-wrap" id="fc7"></div>
        <ul class="fieldlist" id="flist"></ul>
        <div class="maphint">© OpenFreeMap · OpenMapTiles · DOP40: © Bayerische Vermessungsverwaltung</div>
      </div>
    </div>
    <div class="roadmap" id="roadmap">${roadmapStrip()}</div>`

  const map = new FieldMap({ container: 'map', onSelect: (id) => selectField(id) })
  map.setData(asCollection(), getSelected()?.properties.id ?? null)

  let dop = false
  const tgDop = root.querySelector<HTMLButtonElement>('#tg-dop')!
  tgDop.addEventListener('click', () => {
    dop = !dop
    tgDop.classList.toggle('on', dop)
    map.setDop(dop)
  })
  root.querySelector<HTMLButtonElement>('#tg-export')!.addEventListener('click', () => {
    downloadText('doldenblick-schlaege.geojson', fieldsToGeoJson(getFields()))
  })

  renderFieldList()
  let controller: AbortController | null = null
  let farmController: AbortController | null = null

  function renderFieldList() {
    const sel = getSelected()?.properties.id
    const list = root.querySelector<HTMLUListElement>('#flist')!
    list.innerHTML = getFields()
      .map(
        (f) => `<li data-id="${f.properties.id}" class="${f.properties.id === sel ? 'sel' : ''}"
          tabindex="0" role="button"${f.properties.id === sel ? ' aria-current="true"' : ''}
          aria-label="Schlag ${f.properties.name}, ${f.properties.sorte}, ${f.properties.flaeche_ha.toFixed(1)} ha">
          <span class="fn">${f.properties.name}</span>
          <span class="fm">${f.properties.sorte} · ${f.properties.flaeche_ha.toFixed(1)} ha</span>
        </li>`,
      )
      .join('')
    list.querySelectorAll<HTMLLIElement>('li').forEach((li) => {
      const pick = () => selectField(li.dataset.id!)
      li.addEventListener('click', pick)
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          pick()
        }
      })
    })
  }

  function renderLoading() {
    const cards = root.querySelector<HTMLDivElement>('#cards')!
    cards.innerHTML = [
      cardHtml({ status: 'loading', eyebrow: 'Wetter & Warnungen', icon: icons.weather('#6b7d72'), stat: 'lädt …', rec: 'Vorhersage wird abgerufen.', src: 'Open-Meteo · DWD' }),
      cardHtml({ status: 'loading', eyebrow: 'Spritzfenster', icon: icons.spray('#6b7d72'), stat: 'lädt …', rec: 'Stundenwerte werden ausgewertet.', src: 'Open-Meteo' }),
      cardHtml({ status: 'loading', eyebrow: 'Bewässerung · Wasserbilanz', icon: icons.water('#6b7d72'), stat: 'lädt …', rec: 'FAO-56-Wasserbilanz wird berechnet.', src: 'DoldenBlick-API · Open-Meteo' }),
    ].join('')
  }

  /** Backend-Query für die Wasserbilanz aus den Schlag-Eigenschaften. */
  function wbQuery(sel: FieldFeature, lat: number, lon: number): WbQuery {
    const p = sel.properties
    return { lat, lon, soilType: p.soilType, rootDepthM: p.rootDepthM, nfkMmPerM: p.nfkMmPerM }
  }

  async function refresh() {
    const sel = getSelected()
    if (!sel) return
    renderLoading()
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    const [lon, lat] = centroidLonLat(sel)

    // Wasserbilanz unabhängig (Backend-Compute) — Fehler hier bricht Wetter/Spritzfenster nicht ab.
    const wbPromise = fetchWaterBalance(wbQuery(sel, lat, lon), signal)

    let data: OpenMeteoData | null = null
    let alerts: DwdAlert[] | null = null
    let weatherErr: string | null = null
    try {
      data = await fetchOpenMeteo(lat, lon, signal)
      alerts = await fetchDwdAlerts(lat, lon, signal)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      weatherErr = (err as Error).message
    }
    const wb = await wbPromise
    if (signal.aborted) return
    renderCards(sel, data, alerts, weatherErr, wb)
  }

  /** Baut die Wasserbilanz-Karte aus dem Backend-Ergebnis (inkl. degradierter Zustände). */
  const titleCase = (s: string) =>
    s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  function waterBalanceCard(wb: WaterBalanceResult): CardSpec {
    const eyebrow = 'Bewässerung · Wasserbilanz'
    const icon = icons.water()
    // Degradierte Zustände bleiben RUHIG (info, nicht alert) — kein roter Feld-Alarm für einen
    // Abruf-/Versionsfehler; deckt sich mit wbStatus()='info' (Karte und Hinweiszählung stimmen überein).
    if (wb.kind === 'incompatible') {
      return { status: 'info', eyebrow, icon, stat: 'App veraltet', rec: 'Die Wasserbilanz-Schnittstelle hat sich geändert. Bitte die Seite neu laden.', src: 'DoldenBlick-API' }
    }
    if (wb.kind === 'error') {
      return { status: 'info', eyebrow, icon, stat: 'Nicht abrufbar', rec: `Wasserbilanz derzeit nicht abrufbar (${wb.message}). Bitte später erneut versuchen.`, src: 'DoldenBlick-API · Open-Meteo (FAO-56)' }
    }
    const d = wb.data
    const soilName = d.soil.soilType ? titleCase(d.soil.soilType) : `nFK ${d.soil.nfkMmPerM} mm/m`
    const note = `<span class="cardnote">FAO-56-Wurzelraum-Bilanz · Boden: ${soilName}. Orientierung, keine verbindliche Beregnungsanweisung; eigene Beregnung und Oberflächenabfluss sind nicht berücksichtigt.</span>`
    let rec: string
    if (d.status === 'alert' && d.recommendMm > 0) {
      rec = `Netto ≈ ${Math.round(d.recommendMm)} mm bis Feldkapazität (ggf. auf mehrere Gaben verteilen). ${note}`
    } else if (d.status === 'warn') {
      rec = `Noch keine Bewässerung nötig. ${note}`
    } else if (d.status === 'alert') {
      rec = `Trockenstress wahrscheinlich (Ks ${d.ks}). ${note}`
    } else {
      rec = `Wurzelraum gut versorgt. ${note}`
    }
    return {
      status: d.status,
      eyebrow,
      icon,
      stat: soilBalanceLabel(d.status, d.recommendMm),
      rec,
      viz: soilWaterViz({ dr: d.dr, raw: d.raw, taw: d.taw, ks: d.ks, days: d.window.days }),
      src: 'DoldenBlick-API · Open-Meteo (FAO-56 ET₀)',
    }
  }

  /** Status der Wasserbilanz für die Hinweiszählung (nicht-ok = kein Feld-Hinweis). */
  function wbStatus(wb: WaterBalanceResult): Status {
    return wb.kind === 'ok' ? wb.data.status : 'info'
  }

  function renderCards(
    sel: FieldFeature,
    data: OpenMeteoData | null,
    alerts: DwdAlert[] | null,
    weatherErr: string | null,
    wb: WaterBalanceResult,
  ) {
    const now = new Date()
    let weatherStatus: Status = 'info'
    let sprayStatus: Status = 'info'
    let weatherSpecs: CardSpec[]

    if (data) {
      const weather = assessWeather(data, alerts, now)
      const spray = evaluateSprayWindow(data.hourly, now)
      weatherStatus = weather.status
      sprayStatus = spray.status
      const weatherSrc =
        weather.warningSource === 'dwd'
          ? 'DWD / Bright Sky'
          : weather.alertsReachable
            ? 'Open-Meteo (aus Vorhersage abgeleitet)'
            : 'Open-Meteo (abgeleitet · amtliche Warnungen nicht abrufbar)'
      weatherSpecs = [
        {
          status: weather.status,
          eyebrow: 'Wetter & Warnungen',
          icon: icons.weather(),
          stat: weather.headline,
          rec: `${weather.detail} <span class="cardnote">Kein Echtzeit-Alarm — für Frost/Hagel/Sturm die DWD-WarnWetterApp nutzen.</span>`,
          src: weatherSrc,
        },
        {
          status: spray.status,
          eyebrow: 'Spritzfenster',
          icon: icons.spray(),
          stat: spray.headline,
          rec: spray.detail,
          viz: barsViz(spray.hours, 'Nächste 24 h · grün = geeignet (Wind, trocken, ΔT 2–8 °C)'),
          src: 'Open-Meteo',
        },
      ]
    } else {
      const msg = weatherErr ?? 'unbekannt'
      const unavailable = (eyebrow: string, icon: string, src: string): CardSpec => ({
        status: 'alert', eyebrow, icon, stat: 'Nicht abrufbar',
        rec: `Daten konnten nicht geladen werden (${msg}). Bitte später erneut versuchen.`, src,
      })
      weatherSpecs = [
        unavailable('Wetter & Warnungen', icons.weather(), 'Open-Meteo · DWD'),
        unavailable('Spritzfenster', icons.spray(), 'Open-Meteo'),
      ]
    }

    const specs: CardSpec[] = [...weatherSpecs, waterBalanceCard(wb)]
    root.querySelector<HTMLDivElement>('#cards')!.innerHTML = specs.map(cardHtml).join('')
    const fc = root.querySelector<HTMLDivElement>('#fc7')
    if (fc) fc.innerHTML = data ? forecastStrip(data.daily, now) : ''
    updateGridHint(sel)
    if (data) updateSubhead(sel, [weatherStatus, sprayStatus, wbStatus(wb)])
    else
      root.querySelector<HTMLDivElement>('#subhead')!.textContent =
        `${getFields().length} Schläge · Daten für den gewählten Schlag derzeit nicht vollständig abrufbar`
  }

  /** Ehrlichkeitshinweis: liegt der gewählte Schlag mit Nachbarn in derselben ~2-km-Zelle? */
  function updateGridHint(sel: FieldFeature) {
    const selKey = gridCellKey(centroidLonLat(sel))
    const shared = getFields().filter(
      (f) => f.properties.id !== sel.properties.id && gridCellKey(centroidLonLat(f)) === selKey,
    ).length
    const gh = root.querySelector<HTMLDivElement>('#gridhint')!
    if (shared > 0) {
      gh.textContent = `Wetter- und Spritzfenster-Werte sind regionale Rasterwerte (~2 km) — sie gelten für ${shared + 1} benachbarte Schläge in derselben Modellzelle. Die Wasserbilanz nutzt zusätzlich den schlagindividuellen Boden.`
      gh.classList.add('show')
    } else {
      gh.textContent = ''
      gh.classList.remove('show')
    }
  }

  /** Per-Schlag-Zeile (Auswahl + offene Hinweise des gewählten Schlags). */
  function updateSubhead(sel: FieldFeature, statuses: Status[]) {
    const hints = countHints(statuses)
    root.querySelector<HTMLDivElement>('#subhead')!.textContent =
      `ausgewählt: ${sel.properties.name} (${sel.properties.sorte}) · ${
        hints === 0 ? 'keine offenen Hinweise' : `${hints} Hinweis${hints > 1 ? 'e' : ''}`
      }`
  }

  /**
   * Ganzbetrieblicher Tageskopf „N Hinweise für morgen". Holt Open-Meteo einmal pro
   * DISTINKTER Rasterzelle (benachbarte Schläge teilen sich die Zelle) für Wetter/Spritzfenster
   * und die Wasserbilanz je Schlag aus dem Backend; zählt Schläge mit ≥1 warn/alert.
   */
  async function refreshFarm() {
    const all = getFields()
    if (!all.length) return
    farmController?.abort()
    farmController = new AbortController()
    const signal = farmController.signal
    const repByCell = new Map<string, FieldFeature>()
    for (const f of all) {
      const k = gridCellKey(centroidLonLat(f))
      if (!repByCell.has(k)) repByCell.set(k, f)
    }
    const sum = root.querySelector<HTMLDivElement>('#summary')!
    try {
      const now = new Date()
      const dataByCell = new Map<string, OpenMeteoData | null>()
      const alertsByCell = new Map<string, DwdAlert[] | null>()
      // Wetter je Zelle — eine fehlschlagende Zelle darf den Tageskopf NICHT einfrieren.
      await Promise.all(
        [...repByCell].map(async ([k, f]) => {
          const [lon, lat] = centroidLonLat(f)
          try {
            const d = await fetchOpenMeteo(lat, lon, signal)
            const a = await fetchDwdAlerts(lat, lon, signal)
            dataByCell.set(k, d)
            alertsByCell.set(k, a)
          } catch {
            dataByCell.set(k, null)
            alertsByCell.set(k, null)
          }
        }),
      )
      // Wasserbilanz je Schlag (Backend) — wirft nie (Result-Union).
      const wbByField = new Map<string, WaterBalanceResult>()
      await Promise.all(
        all.map(async (f) => {
          const [lon, lat] = centroidLonLat(f)
          wbByField.set(f.properties.id, await fetchWaterBalance(wbQuery(f, lat, lon), signal))
        }),
      )
      if (signal.aborted) return
      let hinted = 0
      for (const f of all) {
        const k = gridCellKey(centroidLonLat(f))
        const data = dataByCell.get(k)
        const statuses: Status[] = []
        if (data) {
          statuses.push(assessWeather(data, alertsByCell.get(k) ?? null, now).status)
          statuses.push(evaluateSprayWindow(data.hourly, now).status)
        }
        statuses.push(wbStatus(wbByField.get(f.properties.id) ?? { kind: 'error', message: '' }))
        if (countHints(statuses) > 0) hinted++
      }
      const anyWeather = [...dataByCell.values()].some(Boolean)
      sum.className = `summary${hinted === 0 && anyWeather ? ' good' : ''}`
      sum.innerHTML = `<span class="d"></span>${
        hinted === 0 ? 'Keine offenen Hinweise' : `${hinted} Hinweis${hinted > 1 ? 'e' : ''}`
      } für morgen · ${all.length} Schläge${anyWeather ? '' : ' · Wetter derzeit nicht abrufbar'}`
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      // Terminaler, ehrlicher Zustand statt eingefrorenem „Daten werden geladen …".
      sum.className = 'summary'
      sum.innerHTML = `<span class="d"></span>Tagesüberblick derzeit nicht abrufbar · ${all.length} Schläge`
    }
  }

  subscribe(() => {
    renderFieldList()
    map.setSelected(getSelected()?.properties.id ?? null)
    refresh()
  })

  setTimeout(() => map.resize(), 50)
  refresh()
  refreshFarm()
}
