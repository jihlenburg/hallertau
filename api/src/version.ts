// API-Vertragsversion (Major) der `/api`-Oberfläche.
// Erhöhen bei BREAKING Changes am Request/Response-Vertrag, damit Client und
// Backend Inkompatibilität erkennen können (additive Felder erhöhen NICHT).
export const API_VERSION = 1

// Älteste Client-Major, die der Server noch bedient (Rollout-Fenster).
export const MIN_CLIENT_VERSION = 1

/**
 * Ist eine vom Client deklarierte Major-Version mit diesem Server kompatibel?
 * - Keine Angabe (undefined/NaN) → true (Client darf via `/api/version` preflighten).
 * - Sonst kompatibel, wenn MIN_CLIENT_VERSION ≤ version ≤ API_VERSION.
 *   (Kleiner = Client zu alt; größer = Server veraltet — beides inkompatibel.)
 */
export function isClientCompatible(clientVersion: number | undefined): boolean {
  if (clientVersion == null || !Number.isFinite(clientVersion)) return true
  return clientVersion >= MIN_CLIENT_VERSION && clientVersion <= API_VERSION
}
