// Kleiner In-Memory-TTL-Cache. Cacht die PROMISE (bündelt gleichzeitige identische
// Anfragen) und löscht bei Fehler (Fehler werden NICHT gecacht). Zeit injizierbar (Tests).
export interface TtlCache<T> {
  get(key: string, loader: () => Promise<T>): Promise<T>
  size(): number
}

export function createTtlCache<T>(opts: { ttlMs: number; now?: () => number; max?: number }): TtlCache<T> {
  const ttl = opts.ttlMs
  const now = opts.now ?? (() => Date.now())
  const max = opts.max ?? 500
  const store = new Map<string, { exp: number; val: Promise<T> }>()

  return {
    get(key, loader) {
      const hit = store.get(key)
      if (hit && hit.exp > now()) return hit.val
      const val = loader().catch((err) => {
        // Fehlschläge nicht cachen — nächster Aufruf darf erneut laden.
        if (store.get(key)?.val === val) store.delete(key)
        throw err
      })
      store.set(key, { exp: now() + ttl, val })
      // einfache Kappung: ältesten Eintrag entfernen
      if (store.size > max) {
        const oldest = store.keys().next().value
        if (oldest !== undefined) store.delete(oldest)
      }
      return val
    },
    size: () => store.size,
  }
}
