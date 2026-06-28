import { describe, it, expect } from 'vitest'
import { buildApp } from './app.js'
import { API_VERSION, MIN_CLIENT_VERSION } from './version.js'

describe('app', () => {
  it('GET /api/health → ok inkl. apiVersion + X-API-Version-Header', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', service: 'doldenblick-api', apiVersion: API_VERSION })
    expect(res.headers['x-api-version']).toBe(String(API_VERSION))
    await app.close()
  })

  it('GET /api/version → Vertragsversion zum Preflight', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/version' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      service: 'doldenblick-api',
      apiVersion: API_VERSION,
      minClientVersion: MIN_CLIENT_VERSION,
    })
    await app.close()
  })

  it('Datenroute mit inkompatibler Client-Version → 426 Upgrade Required', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/water-balance?lat=48.42&lon=11.78',
      headers: { 'x-client-api': String(API_VERSION + 1) },
    })
    expect(res.statusCode).toBe(426)
    expect(res.json()).toMatchObject({ apiVersion: API_VERSION, minClientVersion: MIN_CLIENT_VERSION })
    await app.close()
  })

  it('Preflight-Routen bleiben auch für inkompatible Clients erreichbar', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/version',
      headers: { 'x-client-api': '0' },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
