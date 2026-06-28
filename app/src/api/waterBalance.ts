// Client-Anbindung an den Backend-Wasserbilanz-Dienst (Strong Separation:
// der Client RECHNET NICHT mehr — er ruft same-origin /api/water-balance und rendert).
// Dev: Vite-Proxy → live Backend; Prod: nginx proxyt /api/* loopback-intern.
import type { Status } from '../types'

/** Major-Vertragsversion, gegen die dieser Client gebaut ist (vgl. api/src/version.ts). */
export const CLIENT_API_VERSION = 1

export interface WaterBalanceData {
  apiVersion: number
  status: Status
  /** Wurzelraum-Verarmung Dr (mm); 0 = Feldkapazität, TAW = Welkepunkt. */
  dr: number
  /** Wasserstress-Koeffizient Ks (0..1). */
  ks: number
  deficit: number
  /** Empfohlene Netto-Gabe (mm); 0 wenn nicht nötig. */
  recommendMm: number
  taw: number
  raw: number
  window: { from: string; to: string; days: number }
  soil: { soilType?: string; nfkMmPerM: number; rootDepthM: number }
  asOf: string
  caveats: string[]
}

export type WaterBalanceResult =
  | { kind: 'ok'; data: WaterBalanceData }
  | { kind: 'incompatible' }
  | { kind: 'error'; message: string }

export interface WbQuery {
  lat: number
  lon: number
  soilType?: string
  rootDepthM?: number
  nfkMmPerM?: number
}

export async function fetchWaterBalance(q: WbQuery, signal?: AbortSignal): Promise<WaterBalanceResult> {
  const params = new URLSearchParams({ lat: q.lat.toFixed(4), lon: q.lon.toFixed(4) })
  if (q.soilType) params.set('soilType', q.soilType)
  if (q.rootDepthM != null) params.set('rootDepthM', String(q.rootDepthM))
  if (q.nfkMmPerM != null) params.set('nfkMmPerM', String(q.nfkMmPerM))
  try {
    const res = await fetch(`/api/water-balance?${params.toString()}`, {
      signal,
      headers: { 'X-Client-API': String(CLIENT_API_VERSION) },
    })
    if (res.status === 426) return { kind: 'incompatible' }
    if (!res.ok) return { kind: 'error', message: `HTTP ${res.status}` }
    const data = (await res.json()) as WaterBalanceData
    return { kind: 'ok', data }
  } catch (err) {
    return { kind: 'error', message: (err as Error).message }
  }
}
