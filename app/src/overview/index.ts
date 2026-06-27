import { FieldMap } from '../map'
import { asCollection, getFields, getSelected, selectField, subscribe } from '../state'
import { centroidLonLat } from '../domain/fields'
import { gridCellKey } from '../domain/grid'
import { fetchOpenMeteo, lastNDaysIndices, type OpenMeteoData } from '../api/openMeteo'
import { fetchDwdAlerts, type DwdAlert } from '../api/brightSky'
import { assessWeather } from '../domain/weather'
import { evaluateSprayWindow } from '../domain/sprayWindow'
import { computeWaterBalance, KC_HOPS } from '../domain/waterBalance'
import { cardHtml, barsViz, meterViz, balanceLabel, roadmapStrip, countHints, type CardSpec } from './cards'
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
          <div class="toggles"><button class="tg" id="tg-dop">Luftbild</button></div>
        </div>
        <div id="map"></div>
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

  renderFieldList()
  let controller: AbortController | null = null
  let farmController: AbortController | null = null

  function renderFieldList() {
    const sel = getSelected()?.properties.id
    const list = root.querySelector<HTMLUListElement>('#flist')!
    list.innerHTML = getFields()
      .map(
        (f) => `<li data-id="${f.properties.id}" class="${f.properties.id === sel ? 'sel' : ''}">
          <span class="fn">${f.properties.name}</span>
          <span class="fm">${f.properties.sorte} · ${f.properties.flaeche_ha.toFixed(1)} ha</span>
        </li>`,
      )
      .join('')
    list.querySelectorAll<HTMLLIElement>('li').forEach((li) =>
      li.addEventListener('click', () => selectField(li.dataset.id!)),
    )
  }

  function renderLoading() {
    const cards = root.querySelector<HTMLDivElement>('#cards')!
    cards.innerHTML = [
      cardHtml({ status: 'loading', eyebrow: 'Wetter & Warnungen', icon: icons.weather('#6b7d72'), stat: 'lädt …', rec: 'Vorhersage wird abgerufen.', src: 'Open-Meteo · DWD' }),
      cardHtml({ status: 'loading', eyebrow: 'Spritzfenster', icon: icons.spray('#6b7d72'), stat: 'lädt …', rec: 'Stundenwerte werden ausgewertet.', src: 'Open-Meteo' }),
      cardHtml({ status: 'loading', eyebrow: 'Bewässerung · Wasserbilanz', icon: icons.water('#6b7d72'), stat: 'lädt …', rec: 'ET₀ wird berechnet.', src: 'Open-Meteo' }),
    ].join('')
  }

  async function refresh() {
    const sel = getSelected()
    if (!sel) return
    renderLoading()
    controller?.abort()
    controller = new AbortController()
    const [lon, lat] = centroidLonLat(sel)
    try {
      const data = await fetchOpenMeteo(lat, lon, controller.signal)
      const alerts = await fetchDwdAlerts(lat, lon, controller.signal)
      renderCards(sel, data, alerts)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      renderError((err as Error).message)
    }
  }

  function renderCards(sel: FieldFeature, data: OpenMeteoData, alerts: DwdAlert[] | null) {
    const now = new Date()
    const weather = assessWeather(data, alerts, now)
    const spray = evaluateSprayWindow(data.hourly, now)

    const idx = lastNDaysIndices(data.daily.time, 7, now)
    const et0 = idx.map((i) => data.daily.et0_fao_evapotranspiration[i])
    const precip = idx.map((i) => data.daily.precipitation_sum[i])
    const wb = computeWaterBalance(et0, precip, KC_HOPS)

    const weatherSrc =
      weather.warningSource === 'dwd'
        ? 'DWD / Bright Sky'
        : weather.alertsReachable
          ? 'Open-Meteo (aus Vorhersage abgeleitet)'
          : 'Open-Meteo (abgeleitet · amtliche Warnungen nicht abrufbar)'

    const specs: CardSpec[] = [
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
      {
        status: wb.status,
        eyebrow: 'Bewässerung · Wasserbilanz',
        icon: icons.water(),
        stat: balanceLabel(wb.status),
        rec: `Klimatische Wasserbilanz (7 T): ETc = ET₀ · Kc(${wb.kc}) − Niederschlag. <span class="cardnote">Kein Bodenmodell — Tendenz, keine Beregnungsmenge.</span>`,
        viz: meterViz(wb.deficit, wb.etc, wb.precip),
        src: 'Open-Meteo · ET₀ (FAO-56)',
      },
    ]

    root.querySelector<HTMLDivElement>('#cards')!.innerHTML = specs.map(cardHtml).join('')
    updateGridHint(sel)
    updateSubhead(sel, [weather.status, spray.status, wb.status])
  }

  /** Ehrlichkeitshinweis: liegt der gewählte Schlag mit Nachbarn in derselben ~2-km-Zelle? */
  function updateGridHint(sel: FieldFeature) {
    const selKey = gridCellKey(centroidLonLat(sel))
    const shared = getFields().filter(
      (f) => f.properties.id !== sel.properties.id && gridCellKey(centroidLonLat(f)) === selKey,
    ).length
    const gh = root.querySelector<HTMLDivElement>('#gridhint')!
    if (shared > 0) {
      gh.textContent = `Wetter-, Spritz- und Bewässerungswerte sind regionale Rasterwerte (~2 km) — sie gelten für ${shared + 1} benachbarte Schläge in derselben Modellzelle.`
      gh.classList.add('show')
    } else {
      gh.textContent = ''
      gh.classList.remove('show')
    }
  }

  function renderError(msg: string) {
    const unavailable = (eyebrow: string, icon: string, src: string): CardSpec => ({
      status: 'alert',
      eyebrow,
      icon,
      stat: 'Nicht abrufbar',
      rec: `Daten konnten nicht geladen werden (${msg}). Bitte später erneut versuchen.`,
      src,
    })
    root.querySelector<HTMLDivElement>('#cards')!.innerHTML = [
      unavailable('Wetter & Warnungen', icons.weather(), 'Open-Meteo · DWD'),
      unavailable('Spritzfenster', icons.spray(), 'Open-Meteo'),
      unavailable('Bewässerung · Wasserbilanz', icons.water(), 'Open-Meteo · ET₀ (FAO-56)'),
    ]
      .map(cardHtml)
      .join('')
    root.querySelector<HTMLDivElement>('#subhead')!.textContent =
      `${getFields().length} Schläge · Daten für den gewählten Schlag derzeit nicht abrufbar`
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
   * Ganzbetrieblicher Tageskopf „N Hinweise für morgen" (wie im Konzept). Holt
   * Open-Meteo einmal pro DISTINKTER Rasterzelle (benachbarte Schläge teilen sich
   * die Zelle) und zählt Schläge mit mindestens einem warn/alert. Schlägt der Abruf
   * fehl, bleibt die neutrale Lade-Anzeige stehen (per-Schlag-Karten zeigen Details).
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
    try {
      const now = new Date()
      const dataByCell = new Map<string, OpenMeteoData>()
      const alertsByCell = new Map<string, DwdAlert[] | null>()
      await Promise.all(
        [...repByCell].map(async ([k, f]) => {
          const [lon, lat] = centroidLonLat(f)
          dataByCell.set(k, await fetchOpenMeteo(lat, lon, signal))
          alertsByCell.set(k, await fetchDwdAlerts(lat, lon, signal))
        }),
      )
      let hinted = 0
      for (const f of all) {
        const k = gridCellKey(centroidLonLat(f))
        const data = dataByCell.get(k)
        if (!data) continue
        const idx = lastNDaysIndices(data.daily.time, 7, now)
        const fieldStatuses: Status[] = [
          assessWeather(data, alertsByCell.get(k) ?? null, now).status,
          evaluateSprayWindow(data.hourly, now).status,
          computeWaterBalance(
            idx.map((i) => data.daily.et0_fao_evapotranspiration[i]),
            idx.map((i) => data.daily.precipitation_sum[i]),
            KC_HOPS,
          ).status,
        ]
        if (countHints(fieldStatuses) > 0) hinted++
      }
      const sum = root.querySelector<HTMLDivElement>('#summary')!
      sum.className = `summary${hinted === 0 ? ' good' : ''}`
      sum.innerHTML = `<span class="d"></span>${
        hinted === 0 ? 'Keine offenen Hinweise' : `${hinted} Hinweis${hinted > 1 ? 'e' : ''}`
      } für morgen · ${all.length} Schläge`
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      // still — Detailkarten zeigen die Lage je Schlag.
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
