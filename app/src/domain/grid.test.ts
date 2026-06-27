import { describe, it, expect } from 'vitest'
import { gridCellKey } from './grid'

describe('gridCellKey', () => {
  it('ordnet eng benachbarte Punkte (~30 m) derselben Rasterzelle zu', () => {
    expect(gridCellKey([11.7772, 48.4263])).toBe(gridCellKey([11.7775, 48.4265]))
  })

  it('trennt weit entfernte Punkte (>2 km) in verschiedene Zellen', () => {
    expect(gridCellKey([11.7772, 48.4263])).not.toBe(gridCellKey([11.85, 48.5]))
  })
})
