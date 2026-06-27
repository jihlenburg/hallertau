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
 * Tendenz-Überschrift für die Wasserbilanz. BEWUSST ohne mm-Zahl: ein „Defizit X mm"
 * als Schlagzeile liest sich wie eine Beregnungsdosis (mm ist die Dosiereinheit der
 * Beregnungskanone), obwohl es nur eine speicherfreie klimatische Bilanz ist. Die
 * Zahlen erscheinen weiterhin — kleiner und gerahmt — in der Visualisierung.
 */
export function balanceLabel(status: Status): string {
  switch (status) {
    case 'good': return 'Wasserbilanz ausgeglichen'
    case 'warn': return 'Boden trocknet ab'
    case 'alert': return 'Trockenstress wahrscheinlich'
    default: return 'Wasserbilanz'
  }
}

/** Balken-Anzeige für die Wasserbilanz (Defizit relativ zur ETc). */
export function meterViz(deficit: number, etc: number, precip: number): string {
  const pct = etc > 0 ? Math.min(100, Math.max(0, (deficit / etc) * 100)) : 0
  const color = deficit > 20 ? 'var(--alert)' : deficit > 5 ? 'var(--warn)' : 'var(--good)'
  const balance = deficit > 0 ? `klim. Defizit ~${deficit.toFixed(0)} mm` : `Überschuss ~${(-deficit).toFixed(0)} mm`
  return `
    <div class="meter"><span style="width:${pct.toFixed(0)}%;background:${color}"></span></div>
    <div class="barlabel">${balance} · ETc 7 T: ${etc.toFixed(0)} mm · Regen 7 T: ${precip.toFixed(0)} mm</div>`
}
