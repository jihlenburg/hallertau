import { describe, it, expect } from 'vitest'
import { buildApp } from './app.js'
import { API_VERSION, MIN_CLIENT_VERSION } from './version.js'

describe('rs app', () => {
  it('GET /api/rs/health → ok + X-API-Version', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/rs/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', service: 'doldenblick-rs', apiVersion: API_VERSION })
    expect(res.headers['x-api-version']).toBe(String(API_VERSION))
    await app.close()
  })
  it('GET /api/rs/version → Vertragsversion', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/rs/version' })
    expect(res.json()).toEqual({ service: 'doldenblick-rs', apiVersion: API_VERSION, minClientVersion: MIN_CLIENT_VERSION })
    await app.close()
  })
})
