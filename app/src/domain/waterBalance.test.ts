import { describe, it, expect } from 'vitest'
import { computeWaterBalance } from './waterBalance'

describe('computeWaterBalance', () => {
  it('rechnet ETc = ΣET0·Kc und Defizit = ETc − Niederschlag', () => {
    const wb = computeWaterBalance([4, 4, 4, 4, 4, 4, 4], [1, 1, 1, 1, 1, 1, 1], 1.05)
    expect(wb.etc).toBeCloseTo(29.4, 1) // 28 * 1.05
    expect(wb.precip).toBe(7)
    expect(wb.deficit).toBeCloseTo(22.4, 1)
    expect(wb.status).toBe('alert')
  })

  it('meldet gut bei ausgeglichener Bilanz', () => {
    const wb = computeWaterBalance([1, 1, 1, 1, 1, 1, 1], [5, 0, 0, 0, 0, 0, 0], 1.05)
    expect(wb.status).toBe('good')
    expect(wb.deficit).toBeLessThan(5)
  })

  it('meldet Achtung im mittleren Bereich', () => {
    const wb = computeWaterBalance([2, 2, 2, 2, 2, 2, 2], [2, 0, 0, 0, 0, 0, 0], 1.05)
    expect(wb.status).toBe('warn')
  })
})
