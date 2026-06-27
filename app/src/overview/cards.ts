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

/** Balken-Visualisierung für die Spritzfenster-Stunden (grün = geeignet). */
export function barsViz(values: { ok: boolean }[], label: string): string {
  const slice = values.slice(0, 24)
  const bars = slice
    .map((v) => `<i class="${v.ok ? 'hot' : ''}" style="height:${v.ok ? 100 : 45}%"></i>`)
    .join('')
  return `<div class="bars">${bars}</div><div class="barlabel">${label}</div>`
}

/** Balken-Anzeige für die Wasserbilanz (Defizit relativ zur ETc). */
export function meterViz(deficit: number, etc: number, precip: number): string {
  const pct = etc > 0 ? Math.min(100, Math.max(0, (deficit / etc) * 100)) : 0
  const color = deficit > 20 ? 'var(--alert)' : deficit > 5 ? 'var(--warn)' : 'var(--good)'
  return `
    <div class="meter"><span style="width:${pct.toFixed(0)}%;background:${color}"></span></div>
    <div class="barlabel">ETc 7 T: ${etc.toFixed(0)} mm · Regen 7 T: ${precip.toFixed(0)} mm</div>`
}
