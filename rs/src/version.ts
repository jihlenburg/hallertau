// API-Vertragsversion (Major) der RS-`/api`-Oberfläche. Erhöhen bei BREAKING Änderungen.
export const API_VERSION = 1
export const MIN_CLIENT_VERSION = 1

/** Kompatibel, wenn keine Angabe (Preflight möglich) oder version ∈ [MIN, API_VERSION]. */
export function isClientCompatible(clientVersion: number | undefined): boolean {
  if (clientVersion == null || !Number.isFinite(clientVersion)) return true
  return clientVersion >= MIN_CLIENT_VERSION && clientVersion <= API_VERSION
}
