/**
 * Unit test for sendMagicLinkEmail — no real network calls.
 * Asserts URL, X-Postmark-Server-Token header, From field, and MessageStream.
 */

import { describe, it, expect, vi } from 'vitest'
import { sendMagicLinkEmail } from './postmark.js'

describe('sendMagicLinkEmail', () => {
  function makeFakeFetch(statusOk = true) {
    return vi.fn().mockResolvedValue({
      ok:         statusOk,
      status:     statusOk ? 200 : 422,
      statusText: statusOk ? 'OK' : 'Unprocessable Entity',
    } as Response)
  }

  const TO   = 'bauer@hallertau.de'
  const LINK = 'https://doldenblick.de/onboarding/verify?token=abcd1234'
  const TOKEN = 'postmark-server-token-test'

  it('calls the Postmark API URL via POST', async () => {
    const fetchImpl = makeFakeFetch()
    await sendMagicLinkEmail(TO, LINK, { fetchImpl, token: TOKEN })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.postmarkapp.com/email')
  })

  it('sets X-Postmark-Server-Token header to the injected token', async () => {
    const fetchImpl = makeFakeFetch()
    await sendMagicLinkEmail(TO, LINK, { fetchImpl, token: TOKEN })

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['X-Postmark-Server-Token']).toBe(TOKEN)
  })

  it('sends From as noreply@doldenblick.de', async () => {
    const fetchImpl = makeFakeFetch()
    await sendMagicLinkEmail(TO, LINK, { fetchImpl, token: TOKEN })

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.From).toBe('noreply@doldenblick.de')
  })

  it('sets MessageStream to "outbound"', async () => {
    const fetchImpl = makeFakeFetch()
    await sendMagicLinkEmail(TO, LINK, { fetchImpl, token: TOKEN })

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.MessageStream).toBe('outbound')
  })

  it('throws when Postmark returns a non-2xx status', async () => {
    const fetchImpl = makeFakeFetch(false)
    await expect(
      sendMagicLinkEmail(TO, LINK, { fetchImpl, token: TOKEN }),
    ).rejects.toThrow(/Postmark/)
  })
})
