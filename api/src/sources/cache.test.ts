import { describe, it, expect, vi } from 'vitest'
import { createTtlCache } from './cache.js'

describe('createTtlCache', () => {
  it('liefert denselben Wert innerhalb der TTL ohne erneutes Laden', async () => {
    let t = 1000
    const cache = createTtlCache<number>({ ttlMs: 100, now: () => t })
    const loader = vi.fn(async () => 42)
    expect(await cache.get('k', loader)).toBe(42)
    t = 1050 // innerhalb TTL
    expect(await cache.get('k', loader)).toBe(42)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('lädt nach Ablauf der TTL neu', async () => {
    let t = 0
    const cache = createTtlCache<number>({ ttlMs: 100, now: () => t })
    const loader = vi.fn(async () => t)
    await cache.get('k', loader)
    t = 150 // abgelaufen
    await cache.get('k', loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('trennt Schlüssel', async () => {
    const cache = createTtlCache<string>({ ttlMs: 100, now: () => 0 })
    expect(await cache.get('a', async () => 'A')).toBe('A')
    expect(await cache.get('b', async () => 'B')).toBe('B')
  })

  it('cacht Fehler NICHT (nächster Aufruf versucht erneut)', async () => {
    const cache = createTtlCache<number>({ ttlMs: 1000, now: () => 0 })
    const loader = vi.fn(async () => {
      throw new Error('boom')
    })
    await expect(cache.get('k', loader)).rejects.toThrow('boom')
    const ok = vi.fn(async () => 7)
    expect(await cache.get('k', ok)).toBe(7) // erneuter Versuch, nicht der gecachte Fehler
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('bündelt gleichzeitige identische Anfragen (ein Loader-Aufruf)', async () => {
    const cache = createTtlCache<number>({ ttlMs: 1000, now: () => 0 })
    const loader = vi.fn(
      () => new Promise<number>((res) => setTimeout(() => res(5), 5)),
    )
    const [a, b] = await Promise.all([cache.get('k', loader), cache.get('k', loader)])
    expect(a).toBe(5)
    expect(b).toBe(5)
    expect(loader).toHaveBeenCalledTimes(1)
  })
})
