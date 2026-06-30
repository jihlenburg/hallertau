// API-Vertragsversion (Major) der Accounts-`/api`-Oberfläche. Erhöhen bei BREAKING Änderungen.
export const VERSION = '0.1.0'
export const CONTRACT = 1
export const MIN_CLIENT_CONTRACT = 1

/** Kompatibel, wenn keine Angabe (Preflight möglich) oder version ∈ [MIN, CONTRACT]. */
export function isClientCompatible(clientContract: number | undefined): boolean {
  if (clientContract == null || !Number.isFinite(clientContract)) return true
  return clientContract >= MIN_CLIENT_CONTRACT && clientContract <= CONTRACT
}
