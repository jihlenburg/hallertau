// CDSE-OAuth2 (Client-Credentials) mit In-Memory-Token-Cache. Liest keine Secrets selbst —
// clientId/clientSecret werden injiziert (Server: aus process.env.COPERNICUS_CLIENT_ID/SECRET).
const TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
const SKEW_MS = 60_000 // vor Ablauf erneuern

export interface CdseAuthOpts {
  clientId: string
  clientSecret: string
  tokenUrl?: string
  now?: () => number
  fetchImpl?: typeof fetch
}

export interface CdseAuth {
  getToken(): Promise<string>
}

export function createCdseAuth(opts: CdseAuthOpts): CdseAuth {
  const now = opts.now ?? (() => Date.now())
  const doFetch = opts.fetchImpl ?? fetch
  const url = opts.tokenUrl ?? TOKEN_URL
  let cache: { token: string; expiresAt: number } | null = null

  return {
    async getToken(): Promise<string> {
      if (cache && cache.expiresAt > now() + SKEW_MS) return cache.token
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
      })
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!res.ok) throw new Error(`CDSE token: HTTP ${res.status}`)
      const j = (await res.json()) as { access_token: string; expires_in: number }
      cache = { token: j.access_token, expiresAt: now() + j.expires_in * 1000 }
      return cache.token
    },
  }
}
