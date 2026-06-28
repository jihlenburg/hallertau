import { describe, it, expect } from 'vitest'
import { API_VERSION, MIN_CLIENT_VERSION, isClientCompatible } from './version.js'

describe('API-Vertragsversion', () => {
  it('API_VERSION ist eine positive Ganzzahl, MIN ≤ API', () => {
    expect(Number.isInteger(API_VERSION)).toBe(true)
    expect(API_VERSION).toBeGreaterThan(0)
    expect(MIN_CLIENT_VERSION).toBeLessThanOrEqual(API_VERSION)
  })

  it('ohne Angabe (undefined/NaN) → kompatibel (Client preflightet via /api/version)', () => {
    expect(isClientCompatible(undefined)).toBe(true)
    expect(isClientCompatible(NaN)).toBe(true)
  })

  it('exakte aktuelle Version → kompatibel', () => {
    expect(isClientCompatible(API_VERSION)).toBe(true)
  })

  it('zu alt (< MIN) → inkompatibel', () => {
    expect(isClientCompatible(MIN_CLIENT_VERSION - 1)).toBe(false)
  })

  it('neuer als der Server (> API_VERSION) → inkompatibel (Server veraltet)', () => {
    expect(isClientCompatible(API_VERSION + 1)).toBe(false)
  })
})
