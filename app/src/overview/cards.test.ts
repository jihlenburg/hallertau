import { describe, it, expect } from 'vitest'
import { balanceLabel, roadmapStrip, countHints } from './cards'

describe('balanceLabel — Wasserbilanz als Tendenz (keine Dosierung)', () => {
  it('nennt keinen mm-Wert als Überschrift, sondern eine Tendenz', () => {
    expect(balanceLabel('good')).toMatch(/ausgeglichen/i)
    expect(balanceLabel('warn')).toMatch(/trocknet/i)
    expect(balanceLabel('alert')).toMatch(/Trockenstress/i)
  })

  it('enthält keine Ziffer (mm-Dosis nicht in der Überschrift)', () => {
    for (const s of ['good', 'warn', 'alert'] as const) {
      expect(balanceLabel(s)).not.toMatch(/\d/)
    }
  })
})

describe('roadmapStrip', () => {
  it('nennt alle drei künftigen Quellen', () => {
    const html = roadmapStrip()
    expect(html).toMatch(/Peronospora|Krankheitsdruck/i)
    expect(html).toMatch(/Sentinel|Feld-Check/i)
    expect(html).toMatch(/Wachstum|Phänologie/i)
  })
})

describe('countHints', () => {
  it('zählt warn und alert, ignoriert good/info/loading', () => {
    expect(countHints(['good', 'good', 'good'])).toBe(0)
    expect(countHints(['warn', 'good', 'alert'])).toBe(2)
    expect(countHints(['info', 'good'])).toBe(0)
  })
})
