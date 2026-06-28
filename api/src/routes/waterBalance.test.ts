import { describe, it, expect } from 'vitest'
import { buildApp } from '../app.js'
import type { DailySeries } from '../sources/openMeteo.js'

// 10 Juli-Tage, 5 mm ET0, kein Regen → Kc=1.05 ⇒ dr 52.5, status warn (vgl. Series-Test).
const julyDates = Array.from({ length: 10 }, (_, i) => `2026-07-${String(10 + i).padStart(2, '0')}`)
const stubSeries: DailySeries = { dates: julyDates, et0: julyDates.map(() => 5), precip: julyDates.map(() => 0) }
const stubFetch = async (): Promise<DailySeries> => stubSeries

const appWith = () => buildApp({ fetchDaily: stubFetch })

describe('GET /api/water-balance', () => {
  it('rechnet mit Default-Boden (Lehm, nFK 180) und liefert Status/Fenster/Provenienz', async () => {
    const app = appWith()
    const res = await app.inject({ method: 'GET', url: '/api/water-balance?lat=48.42&lon=11.78&asOf=2026-07-19' })
    expect(res.statusCode).toBe(200)
    const b = res.json()
    expect(b.apiVersion).toBe(1)
    expect(b.card).toBe('water-balance')
    expect(b.dr).toBeCloseTo(52.5, 1)
    expect(b.status).toBe('warn')
    expect(b.taw).toBe(180)
    expect(b.raw).toBe(90)
    expect(b.soil).toMatchObject({ soilType: 'lehm', nfkMmPerM: 180, rootDepthM: 1 })
    expect(b.window).toEqual({ from: '2026-07-10', to: '2026-07-19', days: 10 })
    expect(Array.isArray(b.caveats)).toBe(true)
    expect(b.caveats.length).toBeGreaterThan(0)
    await app.close()
  })

  it('berücksichtigt soilType=sand (nFK 90 → taw 90)', async () => {
    const app = appWith()
    const res = await app.inject({
      method: 'GET',
      url: '/api/water-balance?lat=48.42&lon=11.78&asOf=2026-07-19&soilType=sand',
    })
    expect(res.statusCode).toBe(200)
    const b = res.json()
    expect(b.soil).toMatchObject({ soilType: 'sand', nfkMmPerM: 90 })
    expect(b.taw).toBe(90)
    await app.close()
  })

  it('400 bei fehlendem lat/lon', async () => {
    const app = appWith()
    const res = await app.inject({ method: 'GET', url: '/api/water-balance?lat=48.42' })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('400 bei unplausibler Koordinate', async () => {
    const app = appWith()
    const res = await app.inject({ method: 'GET', url: '/api/water-balance?lat=999&lon=11.78' })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('502 wenn die Datenquelle scheitert', async () => {
    const app = buildApp({
      fetchDaily: async () => {
        throw new Error('Open-Meteo: HTTP 503')
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/water-balance?lat=48.42&lon=11.78&asOf=2026-07-19' })
    expect(res.statusCode).toBe(502)
    await app.close()
  })
})
