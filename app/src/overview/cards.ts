import type { Status } from '../types'
import { wmoCategory, type WmoCategory } from '../domain/wmo'

export interface CardSpec {
  status: Status | 'loading'
  eyebrow: string
  icon: string
  stat: string
  rec: string
  src: string
  pending?: boolean
  viz?: string
}

export function cardHtml(c: CardSpec): string {
  const cls = c.status === 'loading' ? 'card loading' : `card ${c.status}`
  return `
    <div class="${cls}${c.pending ? ' muted' : ''}">
      <div class="head">
        <span class="chip">${c.icon}</span>
        <span class="ey">${c.eyebrow}</span>
        <span class="sdot"></span>
      </div>
      <div class="stat">${c.stat}</div>
      <div class="rec">${c.rec}${c.pending ? '<br><span class="pending">KOMMT NOCH</span>' : ''}</div>
      ${c.viz ? `<div class="viz">${c.viz}</div>` : ''}
      <div class="src">Quelle: ${c.src}</div>
    </div>`
}

/** Zählt offene Hinweise (warn/alert) in einer Statusliste — z. B. die Karten eines Schlags. */
export function countHints(statuses: Status[]): number {
  return statuses.filter((s) => s === 'warn' || s === 'alert').length
}

/**
 * Roadmap-Streifen statt leerer „KOMMT NOCH"-Kacheln im Antwort-Raster: hält die
 * Ehrlichkeit (nennt jede künftige Quelle), kippt das Signal aber von „3 von 6 leer"
 * zu „3 Antworten + Ausblick". Ersetzt die früheren Platzhalter-Karten.
 */
export function roadmapStrip(): string {
  const item = (label: string, src: string) => `<span class="rm"><b>${label}</b> · ${src}</span>`
  return `<div class="roadmap-in">
      <span class="roadmap-h">Bald verfügbar</span>
      ${item('Krankheitsdruck · Peronospora', 'LfL Hüll')}
      ${item('Feld-Check', 'Sentinel')}
      ${item('Wachstum & Erntefenster', 'Phänologie')}
    </div>`
}

// ===== 7-Tage-Vorhersagestreifen (Karten-Panel) =====
interface DailyForecast {
  time: string[]
  weather_code: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  precipitation_probability_max: number[]
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const isoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

const fcSvg = (inner: string) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${inner}</svg>`
const FC_CLOUD = '<path d="M7 16.5h9a3 3 0 0 0 .2-6A4.2 4.2 0 0 0 8.1 9 3.2 3.2 0 0 0 7 16.5z" fill="#b9c6bd"/>'

/** Kompaktes Wetterglyph je Klasse (bewusst minimal, signage-tauglich). */
function fcGlyph(cat: WmoCategory): string {
  switch (cat) {
    case 'clear': return fcSvg('<circle cx="12" cy="12" r="5.5" fill="#e3b24e"/>')
    case 'partly': return fcSvg('<circle cx="9" cy="10" r="4" fill="#e3b24e"/>' + FC_CLOUD)
    case 'cloud': return fcSvg(FC_CLOUD)
    case 'fog': return fcSvg(FC_CLOUD + '<path d="M6 19h12M8 21h8" stroke="#b9c6bd" stroke-width="1.4" stroke-linecap="round"/>')
    case 'rain': return fcSvg(FC_CLOUD + '<path d="M9 18.5l-1 2.5M13 18.5l-1 2.5" stroke="#2f6fb0" stroke-width="1.7" stroke-linecap="round"/>')
    case 'snow': return fcSvg(FC_CLOUD + '<circle cx="9" cy="20" r="1" fill="#7aa6d0"/><circle cx="13" cy="20" r="1" fill="#7aa6d0"/>')
    case 'storm': return fcSvg(FC_CLOUD + '<path d="M12 17l-2.2 3.2H12l-1 2.8 3.2-3.8H12z" fill="#c8902a"/>')
  }
}

/**
 * 7-Tage-Vorhersagestreifen ab „heute" aus den Open-Meteo-Tageswerten.
 * Pro Tag: Wochentag · Wetterglyph · Max/Min · Regenwahrscheinlichkeit.
 */
export function forecastStrip(daily: DailyForecast, now: Date): string {
  const today = isoDate(now)
  let start = daily.time.findIndex((t) => t >= today)
  if (start < 0) start = 0
  const cells: string[] = []
  for (let i = start; i < Math.min(start + 7, daily.time.length); i++) {
    const d = new Date(daily.time[i] + 'T12:00')
    const wd = i === start ? 'Heute' : d.toLocaleDateString('de-DE', { weekday: 'short' })
    const max = daily.temperature_2m_max[i]
    const min = daily.temperature_2m_min[i]
    const maxS = isFinite(max) ? `${Math.round(max)}°` : '–'
    const minS = isFinite(min) ? `${Math.round(min)}°` : '–'
    const pp = Math.round(daily.precipitation_probability_max[i] ?? 0)
    cells.push(
      `<div class="fc"><span class="fcd">${wd}</span>${fcGlyph(wmoCategory(daily.weather_code[i] ?? 0))}` +
        `<span class="fct">${maxS}<i>${minS}</i></span><span class="fcp">${pp > 0 ? pp + ' %' : '·'}</span></div>`,
    )
  }
  return `<div class="fc7">${cells.join('')}</div>`
}

/** Balken-Visualisierung für die Spritzfenster-Stunden (grün = geeignet). */
export function barsViz(values: { ok: boolean }[], label: string): string {
  const slice = values.slice(0, 24)
  const bars = slice
    .map((v) => `<i class="${v.ok ? 'hot' : ''}" style="height:${v.ok ? 100 : 45}%"></i>`)
    .join('')
  return `<div class="bars">${bars}</div><div class="barlabel">${label}</div>`
}

/**
 * Überschrift der Wasserbilanz. Anders als die alte klimatische Tendenz ist dies ein
 * echtes FAO-56-Wurzelraum-Modell (Backend) — die mm-Gabe IST jetzt eine sinnvolle
 * Dosis („auf Feldkapazität auffüllen"), daher darf/soll sie im Alert in die Schlagzeile.
 */
export function soilBalanceLabel(status: Status, recommendMm: number): string {
  switch (status) {
    case 'good': return 'Wasserhaushalt im grünen Bereich'
    case 'warn': return 'Boden trocknet ab'
    case 'alert':
      return recommendMm > 0 ? `≈ ${Math.round(recommendMm)} mm bewässern` : 'Trockenstress wahrscheinlich'
    default: return 'Wasserbilanz'
  }
}

/**
 * Wurzelraum-„Eimer": Verarmung Dr relativ zur nutzbaren Kapazität TAW, mit Auslöser-
 * marke bei RAW. Voll (rechts) = Welkepunkt; leer (links) = Feldkapazität.
 */
export function soilWaterViz(b: { dr: number; raw: number; taw: number; ks: number; days: number }): string {
  const pct = b.taw > 0 ? Math.min(100, Math.max(0, (b.dr / b.taw) * 100)) : 0
  const rawPct = b.taw > 0 ? Math.min(100, Math.max(0, (b.raw / b.taw) * 100)) : 0
  const color = b.dr >= b.raw ? 'var(--alert)' : b.dr >= 0.5 * b.raw ? 'var(--warn)' : 'var(--good)'
  const stress = b.ks < 1 ? ` · Wasserstress (Ks ${b.ks})` : ''
  // Fachbegriffe (Dr/RAW/TAW) nur im title für Power-User; sichtbarer Text bleibt einfach.
  const title = `FAO-56: Verarmung Dr ${b.dr.toFixed(0)} mm · Auslöser RAW ${b.raw.toFixed(0)} mm · nutzbare Kapazität TAW ${b.taw.toFixed(0)} mm`
  return `
    <div class="meter meter-soil" title="${title}">
      <span style="width:${pct.toFixed(0)}%;background:${color}"></span>
      <i class="mark" style="left:${rawPct.toFixed(0)}%" title="Auslöser ab ${b.raw.toFixed(0)} mm"></i>
    </div>
    <div class="barlabel">Verarmung ${b.dr.toFixed(0)} von ${b.taw.toFixed(0)} mm · Auslöser ab ${b.raw.toFixed(0)} mm${stress} · Fenster ${b.days} Tage</div>`
}
