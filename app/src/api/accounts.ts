/**
 * Client-Anbindung an den Accounts-Dienst (Auth + Onboarding).
 *
 * Dünner, getippter HTTP-Client — keine UI-Logik.
 * Alle Requests verwenden `credentials:'include'` (Session-Cookie).
 * Fehlerhafte Antworten werden nie als throw weitergegeben, sondern als
 * `{kind:'error', message}` zurückgegeben (vgl. fieldVigor.ts / waterBalance.ts).
 *
 * Passkey-Zeremonie läuft via @simplewebauthn/browser (startRegistration /
 * startAuthentication), die Optionen kommen vom Backend und das Ergebnis
 * wird ans Backend zurückgesendet.
 */
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

/** Major-Vertragsversion, gegen die dieser Client gebaut ist. */
export const CLIENT_API_VERSION = 1

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  createdAt: string
}

export interface Farm {
  id: string
  name: string
  betriebsnummer?: string
}

/** Reduziertes Schlag-Objekt wie vom Backend zurückgegeben. */
export interface Schlag {
  id: string
  name: string
  [key: string]: unknown
}

export interface MeData {
  user: User
  farm: Farm | null
  schlaege: Schlag[]
}

export type MagicLinkResult = { kind: 'ok' } | { kind: 'error'; message: string }
export type VerifyResult = { kind: 'ok'; user: User } | { kind: 'error'; message: string }
export type MeResult = { kind: 'ok'; data: MeData } | { kind: 'error'; message: string }
export type FarmResult = { kind: 'ok'; farm: Farm } | { kind: 'error'; message: string }
export type SchlaegeResult = { kind: 'ok' } | { kind: 'error'; message: string }
/** aborted = Nutzer hat die Browser-Zeremonie abgebrochen (NotAllowedError). */
export type PasskeyResult = { kind: 'ok' } | { kind: 'aborted' } | { kind: 'error'; message: string }

// ── Interne Fetch-Helfer ───────────────────────────────────────────────────────

const HEADERS = {
  'content-type': 'application/json',
  'X-Client-API': String(CLIENT_API_VERSION),
}

async function apiPost(url: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: HEADERS,
    credentials: 'include',
    body: JSON.stringify(body),
    signal,
  })
}

async function apiGet(url: string, signal?: AbortSignal): Promise<Response> {
  return fetch(url, {
    headers: { 'X-Client-API': String(CLIENT_API_VERSION) },
    credentials: 'include',
    signal,
  })
}

/**
 * Klassifiziert einen Error als Browser-Abbruch durch den Nutzer.
 *
 * Primär: DOMException mit name 'NotAllowedError' — das ist der Standard-Fehler
 * wenn der Nutzer den Authenticator-Dialog schließt oder verweigert.
 * Sekundär: Substring-Fallback für ältere Browser / Mock-Environments.
 *
 * Bewusst NICHT auf 'abort' oder 'cancel' als primären Kriterien: diese Strings
 * kommen auch von AbortController-Abbrüchen, was eine andere Fehlerkategorie ist.
 */
function isUserAbort(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'NotAllowedError') return true
  const msg = (err as Error)?.message ?? ''
  return msg.includes('NotAllowedError')
}

// ── Auth: Magic-Link ──────────────────────────────────────────────────────────

/**
 * Fordert einen Magic-Link per E-Mail an.
 * Backend: POST /api/auth/magic-link { email }
 */
export async function requestMagicLink(email: string, signal?: AbortSignal): Promise<MagicLinkResult> {
  try {
    const res = await apiPost('/api/auth/magic-link', { email }, signal)
    if (!res.ok) return { kind: 'error', message: `HTTP ${res.status}` }
    return { kind: 'ok' }
  } catch (err) {
    return { kind: 'error', message: (err as Error).message }
  }
}

/**
 * Verifiziert das Token aus dem Magic-Link.
 * Backend: POST /api/auth/verify { token }
 * Gibt bei Erfolg den eingeloggten User zurück.
 */
export async function verifyToken(token: string, signal?: AbortSignal): Promise<VerifyResult> {
  try {
    const res = await apiPost('/api/auth/verify', { token }, signal)
    if (!res.ok) return { kind: 'error', message: `HTTP ${res.status}` }
    const user = (await res.json()) as User
    return { kind: 'ok', user }
  } catch (err) {
    return { kind: 'error', message: (err as Error).message }
  }
}

// ── Onboarding ────────────────────────────────────────────────────────────────

/**
 * Gibt den aktuellen Onboarding-Stand des eingeloggten Nutzers zurück.
 * Backend: GET /api/onboarding/me → { user, farm, schlaege }
 */
export async function getMe(signal?: AbortSignal): Promise<MeResult> {
  try {
    const res = await apiGet('/api/onboarding/me', signal)
    if (!res.ok) return { kind: 'error', message: `HTTP ${res.status}` }
    const data = (await res.json()) as MeData
    return { kind: 'ok', data }
  } catch (err) {
    return { kind: 'error', message: (err as Error).message }
  }
}

/**
 * Speichert den Betrieb (Name + optionale Betriebsnummer).
 * Backend: POST /api/onboarding/farm { name, betriebsnummer? }
 */
export async function saveFarm(
  farm: { name: string; betriebsnummer?: string },
  signal?: AbortSignal,
): Promise<FarmResult> {
  try {
    const res = await apiPost('/api/onboarding/farm', farm, signal)
    if (!res.ok) return { kind: 'error', message: `HTTP ${res.status}` }
    const saved = (await res.json()) as Farm
    return { kind: 'ok', farm: saved }
  } catch (err) {
    return { kind: 'error', message: (err as Error).message }
  }
}

/**
 * Speichert die Schläge als GeoJSON-Feature-Array.
 * Backend: POST /api/onboarding/schlaege { features }
 */
export async function saveSchlaege(features: unknown[], signal?: AbortSignal): Promise<SchlaegeResult> {
  try {
    const res = await apiPost('/api/onboarding/schlaege', { features }, signal)
    if (!res.ok) return { kind: 'error', message: `HTTP ${res.status}` }
    return { kind: 'ok' }
  } catch (err) {
    return { kind: 'error', message: (err as Error).message }
  }
}

// ── Auth: Passkey ─────────────────────────────────────────────────────────────

/**
 * Registriert einen neuen Passkey für den eingeloggten Nutzer.
 * Ablauf: POST register-options → Browser-Zeremonie → POST register-verify
 */
export async function registerPasskey(signal?: AbortSignal): Promise<PasskeyResult> {
  try {
    // 1. Optionen vom Backend holen
    const optRes = await apiPost('/api/auth/passkey/register-options', {}, signal)
    if (!optRes.ok) return { kind: 'error', message: `HTTP ${optRes.status}` }
    const optionsJSON = (await optRes.json()) as Parameters<typeof startRegistration>[0]['optionsJSON']

    // 2. Browser-Zeremonie (öffnet ggf. plattformspezifischen Authenticator-Dialog)
    const credential = await startRegistration({ optionsJSON })

    // 3. Ergebnis beim Backend verifizieren
    const verRes = await apiPost('/api/auth/passkey/register-verify', credential, signal)
    if (!verRes.ok) return { kind: 'error', message: `HTTP ${verRes.status}` }
    return { kind: 'ok' }
  } catch (err) {
    if (isUserAbort(err)) return { kind: 'aborted' }
    return { kind: 'error', message: (err as Error).message }
  }
}

/**
 * Authentifiziert via Passkey.
 * Ablauf: POST auth-options {email?} → Browser-Zeremonie → POST auth-verify
 *
 * @param email Optionale E-Mail für kontengebundene Passkeys (discoverable credentials
 *   funktionieren auch ohne — dann leeres Objekt an auth-options schicken).
 */
export async function authPasskey(email?: string, signal?: AbortSignal): Promise<PasskeyResult> {
  try {
    // 1. Optionen vom Backend holen
    const optRes = await apiPost('/api/auth/passkey/auth-options', email ? { email } : {}, signal)
    if (!optRes.ok) return { kind: 'error', message: `HTTP ${optRes.status}` }
    const optionsJSON = (await optRes.json()) as Parameters<typeof startAuthentication>[0]['optionsJSON']

    // 2. Browser-Zeremonie
    const assertion = await startAuthentication({ optionsJSON })

    // 3. Verifizieren
    const verRes = await apiPost('/api/auth/passkey/auth-verify', assertion, signal)
    if (!verRes.ok) return { kind: 'error', message: `HTTP ${verRes.status}` }
    return { kind: 'ok' }
  } catch (err) {
    if (isUserAbort(err)) return { kind: 'aborted' }
    return { kind: 'error', message: (err as Error).message }
  }
}
