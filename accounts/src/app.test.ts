import { describe, it, expect } from 'vitest'
import { buildApp } from './app.js'
import { VERSION, CONTRACT } from './version.js'

describe('accounts app', () => {
  it('health', async () => {
    const app = buildApp()
    const r = await app.inject({ method: 'GET', url: '/api/accounts/health' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ status: 'ok' })
    await app.close()
  })

  it('GET /api/accounts/version → Vertragsversion', async () => {
    const app = buildApp()
    const r = await app.inject({ method: 'GET', url: '/api/accounts/version' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ name: 'doldenblick-accounts', version: VERSION, contract: CONTRACT })
    await app.close()
  })
})
