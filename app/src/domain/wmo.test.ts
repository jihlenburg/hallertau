import { describe, it, expect } from 'vitest'
import { wmo, wmoCategory } from './wmo'

describe('wmo', () => {
  it('liefert deutsche Kurztexte + Schwere', () => {
    expect(wmo(0).text).toMatch(/klar/)
    expect(wmo(95).thunder).toBe(true)
    expect(wmo(65).severe).toBe(true)
  })
})

describe('wmoCategory', () => {
  it('ordnet Codes der Wetterklasse zu', () => {
    expect(wmoCategory(0)).toBe('clear')
    expect(wmoCategory(1)).toBe('clear')
    expect(wmoCategory(2)).toBe('partly')
    expect(wmoCategory(3)).toBe('cloud')
    expect(wmoCategory(48)).toBe('fog')
    expect(wmoCategory(63)).toBe('rain')
    expect(wmoCategory(81)).toBe('rain')
    expect(wmoCategory(73)).toBe('snow')
    expect(wmoCategory(86)).toBe('snow')
    expect(wmoCategory(95)).toBe('storm')
    expect(wmoCategory(99)).toBe('storm')
  })
})
