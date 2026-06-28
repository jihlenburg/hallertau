import type { Status } from '../types'

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
