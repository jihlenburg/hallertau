import { describe, it, expect, vi } from 'vitest'
import { createCdseAuth } from './auth.js'

const tokenRes = (token: string, expires = 1800) =>
  new Response(JSON.stringify({ access_token: token, expires_in: expires, token_type: 'Bearer' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const mockFetch = (fn: (u: RequestInfo | URL, i?: RequestInit) => Promise<Response>) =>
  vi.fn(fn) as unknown as typeof fetch

describe('createCdseAuth', () => {
  it('holt ein Token und cacht es innerhalb der Gültigkeit', async () => {
    let t = 1_000_000
    const f = vi.fn(async () => tokenRes('tok-1'))
    const auth = createCdseAuth({ clientId: 'id', clientSecret: 'sec', now: () => t, fetchImpl: f as unknown as typeof fetch })
    expect(await auth.getToken()).toBe('tok-1')
    t += 1_000_000 // +1000 s, < 1800−60 → noch gültig
    expect(await auth.getToken()).toBe('tok-1')
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('erneuert nach Ablauf (mit Skew)', async () => {
    let t = 0
    let n = 0
    const f = vi.fn(async () => tokenRes(`tok-${++n}`))
    const auth = createCdseAuth({ clientId: 'id', clientSecret: 'sec', now: () => t, fetchImpl: f as unknown as typeof fetch })
    expect(await auth.getToken()).toBe('tok-1')
    t = 1_800_000 // abgelaufen
    expect(await auth.getToken()).toBe('tok-2')
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('sendet client-credentials an den Token-Endpoint', async () => {
    const f = mockFetch(async () => tokenRes('tok'))
    const auth = createCdseAuth({ clientId: 'cid', clientSecret: 'csecret', fetchImpl: f })
    await auth.getToken()
    const [url, init] = (f as unknown as { mock: { calls: [RequestInfo | URL, RequestInit?][] } }).mock.calls[0]
    expect(String(url)).toContain('/protocol/openid-connect/token')
    expect(init?.method).toBe('POST')
    const body = String(init?.body)
    expect(body).toContain('grant_type=client_credentials')
    expect(body).toContain('client_id=cid')
  })

  it('wirft bei non-200', async () => {
    const f = vi.fn(async () => new Response('{"error":"invalid_client"}', { status: 401 }))
    const auth = createCdseAuth({ clientId: 'id', clientSecret: 'bad', fetchImpl: f as unknown as typeof fetch })
    await expect(auth.getToken()).rejects.toThrow(/401/)
  })
})
