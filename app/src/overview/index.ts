import { FieldMap } from '../map'
import { asCollection, getFields, getSelected, selectField, subscribe } from '../state'
import { centroidLonLat } from '../domain/fields'
import { fetchOpenMeteo, lastNDaysIndices, type OpenMeteoData } from '../api/openMeteo'
import { fetchDwdAlerts, type DwdAlert } from '../api/brightSky'
import { assessWeather } from '../domain/weather'
import { evaluateSprayWindow } from '../domain/sprayWindow'
import { computeWaterBalance, KC_HOPS } from '../domain/waterBalance'
import { cardHtml, barsViz, meterViz, type CardSpec } from './cards'
import { icons } from '../ui/icons'
import type { FieldFeature } from '../types'

export function mountOverview(root: HTMLElement): void {
  const fields = getFields()
  const total = fields.reduce((s, f) => s + (f.properties.flaeche_ha || 0), 0)

  root.innerHTML = `
    <div class="hello">Guten Abend, Familie Huber</div>
    <div class="subhead" id="subhead">${fields.length} Schläge · ${total.toFixed(1)} ha · abendlicher Feld-Check</div>
    <div class="summary" id="summary"><span class="d"></span>Daten werden geladen …</div>
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
    </div>`

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
      placeholders(),
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

    const weatherSrc = weather.warningSource === 'dwd' ? 'DWD / Bright Sky' : 'Open-Meteo (aus Vorhersage abgeleitet)'

    const specs: CardSpec[] = [
      {
        status: weather.status,
        eyebrow: 'Wetter & Warnungen',
        icon: icons.weather(),
        stat: weather.headline,
        rec: weather.detail,
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
        stat: wb.deficit > 0 ? `Defizit ${wb.deficit.toFixed(0)} mm` : `Bilanz +${(-wb.deficit).toFixed(0)} mm`,
        rec: `Klimatische Bilanz (7 T): ETc = ET₀ · Kc(${wb.kc}) − Niederschlag. Kein Bodenmodell.`,
        viz: meterViz(wb.deficit, wb.etc, wb.precip),
        src: 'Open-Meteo · ET₀ (FAO-56)',
      },
    ]

    root.querySelector<HTMLDivElement>('#cards')!.innerHTML = specs.map(cardHtml).join('') + placeholders()
    updateSummary(sel, [weather.status, spray.status, wb.status])
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
    root.querySelector<HTMLDivElement>('#cards')!.innerHTML =
      [
        unavailable('Wetter & Warnungen', icons.weather(), 'Open-Meteo · DWD'),
        unavailable('Spritzfenster', icons.spray(), 'Open-Meteo'),
        unavailable('Bewässerung · Wasserbilanz', icons.water(), 'Open-Meteo · ET₀ (FAO-56)'),
      ]
        .map(cardHtml)
        .join('') + placeholders()
    const sum = root.querySelector<HTMLDivElement>('#summary')!
    sum.className = 'summary'
    sum.innerHTML = '<span class="d"></span>Daten derzeit nicht abrufbar'
  }

  function updateSummary(sel: FieldFeature, statuses: string[]) {
    const hints = statuses.filter((s) => s === 'warn' || s === 'alert').length
    const sum = root.querySelector<HTMLDivElement>('#summary')!
    sum.className = `summary${hints === 0 ? ' good' : ''}`
    sum.innerHTML = `<span class="d"></span>${hints === 0 ? 'Keine offenen Hinweise' : `${hints} Hinweis${hints > 1 ? 'e' : ''}`} für „${sel.properties.name}“`
    root.querySelector<HTMLDivElement>('#subhead')!.textContent =
      `${getFields().length} Schläge · ausgewählt: ${sel.properties.name} (${sel.properties.sorte})`
  }

  subscribe(() => {
    renderFieldList()
    map.setSelected(getSelected()?.properties.id ?? null)
    refresh()
  })

  setTimeout(() => map.resize(), 50)
  refresh()
}

function placeholders(): string {
  return [
    cardHtml({ status: 'info', eyebrow: 'Krankheitsdruck · Peronospora', icon: icons.perono('#255d97'), stat: 'In Vorbereitung', rec: 'LfL-Warndienst (Hüll) wird angebunden.', pending: true, src: 'LfL Bayern' }),
    cardHtml({ status: 'info', eyebrow: 'Feld-Check · Satellit', icon: icons.sat('#255d97'), stat: 'In Vorbereitung', rec: 'Sentinel-Vitalität (regionales Screening) folgt.', pending: true, src: 'Copernicus / Sentinel' }),
    cardHtml({ status: 'info', eyebrow: 'Wachstum & Erntefenster', icon: icons.growth(), stat: 'In Vorbereitung', rec: 'Phänologie/GTS-Modell folgt.', pending: true, src: 'Open-Meteo · DWD' }),
  ].join('')
}
